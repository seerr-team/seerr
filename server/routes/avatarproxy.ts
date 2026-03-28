import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import ImageProxy from '@server/lib/imageproxy';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { getAppVersion } from '@server/utils/appVersion';
import { getHostname } from '@server/utils/getHostname';
import axios from 'axios';
import { Router } from 'express';
import gravatarUrl from 'gravatar-url';
import { createHash } from 'node:crypto';

const router = Router();

const avatarImageProxies = new Map<string, ImageProxy>();

export function clearAvatarImageProxyCache(serverId: string) {
  for (const cacheKey of avatarImageProxies.keys()) {
    if (cacheKey.startsWith(`${serverId}:`)) {
      avatarImageProxies.delete(cacheKey);
    }
  }
}

const getJellyfinServer = (serverId?: string) => {
  const settings = getSettings();

  if (serverId) {
    return settings.jellyfinServers.find((server) => server.id === serverId);
  }

  return settings.getPrimaryJellyfinLikeServer();
};

async function initAvatarImageProxy(serverId?: string) {
  const server = getJellyfinServer(serverId);

  if (!server) {
    throw new Error('No Jellyfin or Emby server configured.');
  }

  const userRepository = getRepository(User);
  const admin = await userRepository.findOne({
    where: { id: 1 },
    select: ['id', 'jellyfinUserId', 'jellyfinDeviceId'],
    order: { id: 'ASC' },
  });
  const deviceId = admin?.jellyfinDeviceId || 'BOT_seerr';
  const cacheKey = `${server.id}:${server.apiKey}:${deviceId}`;
  const cachedProxy = avatarImageProxies.get(cacheKey);
  if (cachedProxy) {
    return cachedProxy;
  }

  const imageProxy = new ImageProxy('avatar', '', {
    headers: {
      'X-Emby-Authorization': `MediaBrowser Client="Seerr", Device="Seerr", DeviceId="${deviceId}", Version="${getAppVersion()}", Token="${server.apiKey}"`,
    },
  });

  avatarImageProxies.set(cacheKey, imageProxy);

  return imageProxy;
}

function getJellyfinAvatarUrl(userId: string, serverId?: string) {
  const server = getJellyfinServer(serverId);

  if (!server) {
    throw new Error('No Jellyfin or Emby server configured.');
  }

  return server.mediaServerType === MediaServerType.JELLYFIN
    ? `${getHostname(server)}/UserImage?UserId=${userId}`
    : `${getHostname(server)}/Users/${userId}/Images/Primary?quality=90`;
}

function computeImageHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function checkAvatarChanged(
  user: User
): Promise<{ changed: boolean; etag?: string }> {
  try {
    if (!user || !user.jellyfinUserId) {
      return { changed: false };
    }

    const server = getJellyfinServer(user.jellyfinServerId ?? undefined);
    if (!server) {
      return { changed: false };
    }

    const jellyfinAvatarUrl = getJellyfinAvatarUrl(
      user.jellyfinUserId,
      server.id
    );

    let headResponse;
    try {
      headResponse = await axios.head(jellyfinAvatarUrl);
      if (headResponse.status !== 200) {
        return { changed: false };
      }
    } catch {
      return { changed: false };
    }

    let remoteVersion: string;
    if (server.mediaServerType === MediaServerType.JELLYFIN) {
      const remoteLastModifiedStr = headResponse.headers['last-modified'] || '';
      remoteVersion = (
        Date.parse(remoteLastModifiedStr) || Date.now()
      ).toString();
    } else if (server.mediaServerType === MediaServerType.EMBY) {
      remoteVersion =
        headResponse.headers['etag']?.replace(/"/g, '') ||
        Date.now().toString();
    } else {
      remoteVersion = Date.now().toString();
    }

    if (user.avatarVersion && user.avatarVersion === remoteVersion) {
      return { changed: false, etag: user.avatarETag ?? undefined };
    }

    const avatarImageCache = await initAvatarImageProxy(server.id);
    await avatarImageCache.clearCachedImage(jellyfinAvatarUrl);
    const imageData = await avatarImageCache.getImage(
      jellyfinAvatarUrl,
      gravatarUrl(user.email || 'none', { default: 'mm', size: 200 })
    );

    const newHash = computeImageHash(imageData.imageBuffer);

    const hasChanged = user.avatarETag !== newHash;

    user.avatarVersion = remoteVersion;
    if (hasChanged) {
      user.avatarETag = newHash;
    }

    await getRepository(User).save(user);

    return { changed: hasChanged, etag: newHash };
  } catch (error) {
    logger.error('Error checking avatar changes', {
      errorMessage: error.message,
    });
    return { changed: false };
  }
}

router.get('/:jellyfinUserId', async (req, res) => {
  try {
    const requestedServerId = req.query.serverId?.toString();
    const user = await getRepository(User).findOne({
      where: { jellyfinUserId: req.params.jellyfinUserId },
    });
    let server;

    if (requestedServerId) {
      server = getJellyfinServer(requestedServerId);

      if (!server) {
        return res
          .status(404)
          .json({ message: 'Jellyfin or Emby server not found.' });
      }
    } else {
      server = getJellyfinServer(user?.jellyfinServerId ?? undefined);
    }

    if (!req.params.jellyfinUserId.match(/^[a-f0-9]{32}$/)) {
      throw new Error(
        `Provided URL is not ${
          server?.mediaServerType === MediaServerType.JELLYFIN
            ? 'a Jellyfin'
            : 'an Emby'
        } avatar.`
      );
    }

    if (!server) {
      throw new Error('No Jellyfin or Emby server configured.');
    }

    const avatarImageCache = await initAvatarImageProxy(server.id);

    const userEtag = req.headers['if-none-match'];

    const versionParam = req.query.v;

    const fallbackUrl = gravatarUrl(user?.email || 'none', {
      default: 'mm',
      size: 200,
    });

    const jellyfinAvatarUrl = getJellyfinAvatarUrl(
      req.params.jellyfinUserId,
      server.id
    );

    let imageData = await avatarImageCache.getImage(
      jellyfinAvatarUrl,
      fallbackUrl
    );

    if (imageData.meta.extension === 'json') {
      // this is a 404
      imageData = await avatarImageCache.getImage(fallbackUrl);
    }

    if (userEtag && userEtag === `"${imageData.meta.etag}"` && !versionParam) {
      return res.status(304).end();
    }

    res.writeHead(200, {
      'Content-Type': `image/${imageData.meta.extension}`,
      'Content-Length': imageData.imageBuffer.length,
      'Cache-Control': `public, max-age=${imageData.meta.curRevalidate}`,
      ETag: `"${imageData.meta.etag}"`,
      'OS-Cache-Key': imageData.meta.cacheKey,
      'OS-Cache-Status': imageData.meta.cacheMiss ? 'MISS' : 'HIT',
    });

    res.end(imageData.imageBuffer);
  } catch (e) {
    logger.error('Failed to proxy avatar image', {
      errorMessage: e.message,
    });
  }
});

export default router;
