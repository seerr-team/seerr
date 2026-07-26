import { MediaServerType } from '@server/constants/server';
import type Media from '@server/entity/Media';
import type { User } from '@server/entity/User';
import { resolveVisibleJellyfinItemIds } from '@server/lib/jellyfinsharing';
import { resolveVisiblePlexRatingKeys } from '@server/lib/plexsharing';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

/**
 * The set of media server item ids a restricted user is allowed to see, or
 * `null` when the user is unrestricted and availability needs no filtering.
 */
export type VisibleMediaIds = Set<string> | null;

interface CacheEntry {
  expiresAt: number;
  ids: VisibleMediaIds;
}

/**
 * Resolving the visible ids costs a handful of media server requests, so the
 * result is cached per user. Sharing rules change rarely, and a stale entry
 * only delays a restriction by a few minutes.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<number, CacheEntry>();

export const clearLibrarySharingCache = (userId?: number): void => {
  if (userId === undefined) {
    cache.clear();
    return;
  }

  cache.delete(userId);
};

const resolve = async (user: User): Promise<VisibleMediaIds> => {
  switch (getSettings().main.mediaServerType) {
    case MediaServerType.PLEX:
      return resolveVisiblePlexRatingKeys(user);
    case MediaServerType.JELLYFIN:
    case MediaServerType.EMBY:
      return resolveVisibleJellyfinItemIds(user);
    default:
      return null;
  }
};

export const getVisibleMediaIds = async (
  user: User
): Promise<VisibleMediaIds> => {
  const cached = cache.get(user.id);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.ids;
  }

  try {
    const ids = await resolve(user);
    cache.set(user.id, { ids, expiresAt: Date.now() + CACHE_TTL_MS });
    return ids;
  } catch (e) {
    logger.error('Failed to resolve media server sharing restrictions', {
      label: 'Media Server Sharing',
      userId: user.id,
      errorMessage: e.message,
    });
    // Fail open: a transient media server error must not hide the whole library.
    return null;
  }
};

/**
 * Returns the identifiers a media item carries on the configured media server,
 * for the regular and the 4K version.
 */
export const getMediaServerItemIds = (
  media: Media
): { id?: string | null; id4k?: string | null } => {
  if (getSettings().main.mediaServerType === MediaServerType.PLEX) {
    return { id: media.ratingKey, id4k: media.ratingKey4k };
  }

  return { id: media.jellyfinMediaId, id4k: media.jellyfinMediaId4k };
};
