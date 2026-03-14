import JellyfinAPI from '@server/api/jellyfin';
import PlexAPI from '@server/api/plexapi';
import PlexTvAPI from '@server/api/plextv';
import TautulliAPI from '@server/api/tautulli';
import { ApiErrorCode } from '@server/constants/error';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import type { PlexConnection } from '@server/interfaces/api/plexInterfaces';
import type {
  LogMessage,
  LogsResultsResponse,
  SettingsAboutResponse,
} from '@server/interfaces/api/settingsInterfaces';
import { scheduledJobs } from '@server/job/schedule';
import type { AvailableCacheIds } from '@server/lib/cache';
import cacheManager from '@server/lib/cache';
import ImageProxy from '@server/lib/imageproxy';
import { Permission } from '@server/lib/permissions';
import { jellyfinFullScanner } from '@server/lib/scanners/jellyfin';
import { plexFullScanner } from '@server/lib/scanners/plex';
import type {
  JellyfinServerSettings,
  JobId,
  Library,
  MainSettings,
  PlexServerSettings,
} from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { clearAvatarImageProxyCache } from '@server/routes/avatarproxy';
import discoverSettingRoutes from '@server/routes/settings/discover';
import { ApiError } from '@server/types/error';
import { appDataPath } from '@server/utils/appDataVolume';
import { getAppVersion } from '@server/utils/appVersion';
import { dnsCache } from '@server/utils/dnsCache';
import { getHostname } from '@server/utils/getHostname';
import type { DnsEntries, DnsStats } from 'dns-caching';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import { escapeRegExp, merge, omit, set, sortBy } from 'lodash';
import { rescheduleJob } from 'node-schedule';
import { randomUUID } from 'node:crypto';
import path from 'path';
import semver from 'semver';
import { URL } from 'url';
import metadataRoutes from './metadata';
import notificationRoutes from './notifications';
import radarrRoutes from './radarr';
import sonarrRoutes from './sonarr';

const settingsRoutes = Router();

settingsRoutes.use('/notifications', notificationRoutes);
settingsRoutes.use('/radarr', radarrRoutes);
settingsRoutes.use('/sonarr', sonarrRoutes);
settingsRoutes.use('/discover', discoverSettingRoutes);
settingsRoutes.use('/metadatas', metadataRoutes);

const filteredMainSettings = (
  user: User,
  main: MainSettings
): Partial<MainSettings> => {
  if (!user?.hasPermission(Permission.ADMIN)) {
    return omit(main, 'apiKey');
  }

  return main;
};

const getPlexServerFromRequest = ({
  serverId,
}: {
  serverId?: string;
} = {}): PlexServerSettings | undefined => {
  const settings = getSettings();

  if (serverId) {
    return settings.plexServers.find((server) => server.id === serverId);
  }

  return settings.getPrimaryPlexServer();
};

const getJellyfinServerFromRequest = ({
  serverId,
}: {
  serverId?: string;
} = {}): JellyfinServerSettings | undefined => {
  const settings = getSettings();

  if (serverId) {
    return settings.jellyfinServers.find((server) => server.id === serverId);
  }

  return settings.getPrimaryJellyfinLikeServer();
};

settingsRoutes.get('/main', (req, res, next) => {
  const settings = getSettings();

  if (!req.user) {
    return next({ status: 400, message: 'User missing from request.' });
  }

  res.status(200).json(filteredMainSettings(req.user, settings.main));
});

settingsRoutes.post('/main', async (req, res) => {
  const settings = getSettings();

  settings.main = merge(settings.main, req.body);
  await settings.save();

  return res.status(200).json(settings.main);
});

settingsRoutes.get('/network', (req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.network);
});

settingsRoutes.post('/network', async (req, res) => {
  const settings = getSettings();

  settings.network = merge(settings.network, req.body);
  await settings.save();

  return res.status(200).json(settings.network);
});

settingsRoutes.post('/main/regenerate', async (req, res, next) => {
  const settings = getSettings();

  const main = await settings.regenerateApiKey();

  if (!req.user) {
    return next({ status: 500, message: 'User missing from request.' });
  }

  return res.status(200).json(filteredMainSettings(req.user, main));
});

settingsRoutes.get('/plex', (req, res) => {
  const requestedServerId = req.query.serverId?.toString();
  const server = getPlexServerFromRequest({
    serverId: requestedServerId,
  });

  if (requestedServerId && !server) {
    return res.status(404).json({ error: 'Plex server not found' });
  }

  res.status(200).json(server ?? getSettings().plex);
});

settingsRoutes.get('/plex/login', async (req, res) => {
  if (req.user?.id !== 1) {
    return res.status(200).json({
      authenticated: false,
      isOwner: false,
    });
  }

  const userRepository = getRepository(User);
  const owner = await userRepository.findOne({
    select: { id: true, plexToken: true },
    where: { id: 1 },
  });

  return res.status(200).json({
    authenticated: Boolean(owner?.plexToken),
    isOwner: true,
  });
});

settingsRoutes.post('/plex/login', async (req, res, next) => {
  const userRepository = getRepository(User);
  const body = req.body as { authToken?: string };

  if (req.user?.id !== 1) {
    return next({
      status: 403,
      message: 'Only the owner can authenticate Plex for settings.',
    });
  }

  if (!body.authToken) {
    return next({
      status: 400,
      message: 'Authentication token required.',
    });
  }

  try {
    const plexTv = new PlexTvAPI(body.authToken);
    const account = await plexTv.getUser();

    await userRepository.update(
      { id: 1 },
      {
        plexToken: account.authToken,
      }
    );

    return res.status(204).send();
  } catch (e) {
    logger.error('Something went wrong authenticating Plex for settings', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to authenticate with Plex.',
    });
  }
});

settingsRoutes.post('/plex', async (req, res, next) => {
  if (req.user?.id !== 1) {
    return next({
      status: 403,
      message: 'Only the owner can configure Plex servers.',
    });
  }

  const userRepository = getRepository(User);
  const settings = getSettings();
  let plexServerId: string | undefined;
  try {
    const existingServer = req.body.id
      ? getPlexServerFromRequest({ serverId: req.body.id })
      : undefined;
    const admin = await userRepository.findOneOrFail({
      select: { id: true, plexToken: true },
      where: { id: 1 },
    });

    const plexServer: PlexServerSettings = {
      ...(existingServer
        ? existingServer
        : {
            id: req.body.id ?? randomUUID(),
            mediaServerType: MediaServerType.PLEX,
          }),
      ...req.body,
      mediaServerType: MediaServerType.PLEX,
    };
    plexServerId = plexServer.id;

    const plexClient = new PlexAPI({
      plexSettings: plexServer,
      plexToken: admin.plexToken,
    });

    const result = await plexClient.getStatus();

    if (!result?.MediaContainer?.machineIdentifier) {
      throw new Error('Server not found');
    }

    plexServer.machineId = result.MediaContainer.machineIdentifier;
    plexServer.name = result.MediaContainer.friendlyName;

    settings.upsertPlexServer(plexServer);

    await settings.save();
  } catch (e) {
    logger.error('Something went wrong testing Plex connection', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to connect to Plex.',
    });
  }

  return res
    .status(200)
    .json(
      getPlexServerFromRequest({ serverId: plexServerId }) ?? settings.plex
    );
});

settingsRoutes.get('/plex/servers', (_req, res) => {
  return res.status(200).json(getSettings().plexServers);
});

settingsRoutes.delete('/plex/servers/:serverId', async (req, res, next) => {
  const settings = getSettings();
  if (
    !settings.plexServers.some((server) => server.id === req.params.serverId)
  ) {
    return next({ status: 404, message: 'Plex server not found.' });
  }

  if (req.user?.id !== 1) {
    return next({
      status: 403,
      message: 'Only the settings owner may delete Plex servers.',
    });
  }

  const removedServer = settings.removePlexServer(req.params.serverId);

  if (!removedServer) {
    return next({ status: 404, message: 'Plex server not found.' });
  }

  await settings.save();

  return res.status(200).json(removedServer);
});

settingsRoutes.get('/plex/devices/servers', async (req, res, next) => {
  const userRepository = getRepository(User);

  if (req.user?.id !== 1) {
    return next({
      status: 403,
      message: 'Only the owner can access Plex server discovery.',
    });
  }

  try {
    const admin = await userRepository.findOneOrFail({
      select: { id: true, plexToken: true },
      where: { id: 1 },
    });

    if (!admin.plexToken) {
      return next({
        status: 409,
        message: 'Plex account authentication required.',
      });
    }

    const plexTvClient = admin.plexToken
      ? new PlexTvAPI(admin.plexToken)
      : null;
    const devices = (await plexTvClient?.getDevices())?.filter((device) => {
      return device.provides.includes('server') && device.owned;
    });
    const settings = getSettings();

    if (devices) {
      await Promise.all(
        devices.map(async (device) => {
          const plexDirectConnections: PlexConnection[] = [];

          device.connection.forEach((connection) => {
            const url = new URL(connection.uri);

            if (url.hostname !== connection.address) {
              const plexDirectConnection = { ...connection };
              plexDirectConnection.address = url.hostname;
              plexDirectConnections.push(plexDirectConnection);

              // Connect to IP addresses over HTTP
              connection.protocol = 'http';
            }
          });

          plexDirectConnections.forEach((plexDirectConnection) => {
            device.connection.push(plexDirectConnection);
          });

          await Promise.all(
            device.connection.map(async (connection) => {
              const plexDeviceSettings = {
                ...settings.plex,
                ip: connection.address,
                port: connection.port,
                useSsl: connection.protocol === 'https',
              };
              const plexClient = new PlexAPI({
                plexToken: admin.plexToken,
                plexSettings: plexDeviceSettings,
                timeout: 5000,
              });

              try {
                await plexClient.getStatus();
                connection.status = 200;
                connection.message = 'OK';
              } catch (e) {
                connection.status = 500;
                connection.message = e.message.split(':')[0];
              }
            })
          );
        })
      );
    }
    return res.status(200).json(devices);
  } catch (e) {
    logger.error('Something went wrong retrieving Plex server list', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve Plex server list.',
    });
  }
});

settingsRoutes.get('/plex/library', async (req, res) => {
  if (req.query.sync && req.user?.id !== 1) {
    return res.status(403).json({
      message: 'Only the owner can sync Plex libraries from settings.',
    });
  }

  const settings = getSettings();
  const server = getPlexServerFromRequest({
    serverId: req.query.serverId?.toString(),
  });

  if (!server) {
    if (req.query.serverId) {
      return res.status(404).json({ error: 'Plex server not found' });
    }

    return res.status(200).json([]);
  }

  if (req.query.sync) {
    const userRepository = getRepository(User);
    const admin = await userRepository.findOneOrFail({
      select: { id: true, plexToken: true },
      where: { id: 1 },
    });
    const plexapi = new PlexAPI({
      plexSettings: server,
      plexToken: admin.plexToken,
    });

    await plexapi.syncLibraries(server.id);
  }

  const enabledLibraries = req.query.enable
    ? (req.query.enable as string).split(',')
    : [];

  if (!settings.plexServers.some((plexServer) => plexServer.id === server.id)) {
    return res.status(404).json({ message: 'Plex server not found.' });
  }

  const updated = settings.updatePlexServer(server.id, (plexServer) => ({
    ...plexServer,
    libraries: plexServer.libraries.map((library) => ({
      ...library,
      enabled: enabledLibraries.includes(library.id),
    })),
  }));

  if (!updated) {
    return res.status(404).json({ message: 'Plex server not found.' });
  }

  await settings.save();
  return res
    .status(200)
    .json(
      settings.plexServers.find((plexServer) => plexServer.id === server.id)
        ?.libraries ?? []
    );
});

settingsRoutes.get('/plex/sync', (_req, res) => {
  return res.status(200).json(plexFullScanner.status());
});

settingsRoutes.post('/plex/sync', (req, res) => {
  if (req.user?.id !== 1) {
    return res.status(403).json({
      message: 'Only the owner can run Plex scans from settings.',
    });
  }

  if (req.body.cancel) {
    plexFullScanner.cancel();
  } else if (req.body.start) {
    plexFullScanner.run();
  }
  return res.status(200).json(plexFullScanner.status());
});

settingsRoutes.get('/jellyfin', (req, res) => {
  const requestedServerId = req.query.serverId?.toString();
  const server = getJellyfinServerFromRequest({
    serverId: requestedServerId,
  });

  if (requestedServerId && !server) {
    return res.status(404).json({ error: 'Jellyfin server not found' });
  }

  res.status(200).json(server ?? getSettings().jellyfin);
});

settingsRoutes.post('/jellyfin', async (req, res, next) => {
  const userRepository = getRepository(User);
  const settings = getSettings();
  let jellyfinServerId: string | undefined;
  const { username, password, serverType, ...jellyfinServerBody } =
    req.body as Partial<JellyfinServerSettings> & {
      username?: string;
      password?: string;
      serverType?: MediaServerType.JELLYFIN | MediaServerType.EMBY;
    };

  try {
    const existingServer = req.body.id
      ? getJellyfinServerFromRequest({
          serverId: req.body.id,
        })
      : undefined;
    const admin = await userRepository.findOneOrFail({
      where: { id: 1 },
      select: ['id', 'jellyfinUserId', 'jellyfinDeviceId'],
      order: { id: 'ASC' },
    });
    const resolvedServerId = req.body.id ?? existingServer?.id ?? randomUUID();
    const resolvedMediaServerType =
      req.body.mediaServerType ??
      serverType ??
      existingServer?.mediaServerType ??
      MediaServerType.JELLYFIN;
    const jellyfinServerBase: JellyfinServerSettings = existingServer ?? {
      id: resolvedServerId,
      mediaServerType: resolvedMediaServerType,
      name: '',
      ip: '',
      port: 8096,
      useSsl: false,
      urlBase: '',
      externalHostname: '',
      jellyfinForgotPasswordUrl: '',
      libraries: [],
      serverId: '',
      apiKey: '',
    };

    const jellyfinServer: JellyfinServerSettings = {
      ...jellyfinServerBase,
      id: resolvedServerId,
      ...jellyfinServerBody,
      mediaServerType: resolvedMediaServerType,
    };
    jellyfinServerId = jellyfinServer.id;
    const jellyfinHostname = getHostname(jellyfinServer);
    const jellyfinDeviceId =
      admin.jellyfinDeviceId && admin.jellyfinDeviceId.length > 0
        ? admin.jellyfinDeviceId
        : Buffer.from('BOT_seerr').toString('base64');

    if (!jellyfinServer.apiKey && username && password) {
      const authClient = new JellyfinAPI(
        jellyfinHostname,
        undefined,
        jellyfinDeviceId,
        jellyfinServer.mediaServerType
      );
      const account = await authClient.login(username, password);

      if (!account.User.Policy.IsAdministrator) {
        throw new ApiError(403, ApiErrorCode.NotAdmin);
      }

      const authenticatedClient = new JellyfinAPI(
        jellyfinHostname,
        account.AccessToken,
        jellyfinDeviceId,
        jellyfinServer.mediaServerType
      );

      jellyfinServer.apiKey = await authenticatedClient.createApiToken('Seerr');
    }

    const jellyfinClient = new JellyfinAPI(
      jellyfinHostname,
      jellyfinServer.apiKey,
      jellyfinDeviceId,
      jellyfinServer.mediaServerType
    );

    const result = await jellyfinClient.getSystemInfo();

    if (!result?.Id) {
      throw new ApiError(result?.status, ApiErrorCode.InvalidUrl);
    }

    jellyfinServer.serverId = result.Id;
    jellyfinServer.name = result.ServerName;

    settings.upsertJellyfinServer(jellyfinServer);

    await settings.save();
  } catch (e) {
    if (e instanceof ApiError) {
      logger.error('Something went wrong testing Jellyfin connection', {
        label: 'API',
        status: e.statusCode,
        errorMessage: e.errorCode,
      });

      return next({
        status: e.statusCode,
        message:
          e.errorCode === ApiErrorCode.InvalidUrl ||
          e.errorCode === ApiErrorCode.InvalidCredentials ||
          e.errorCode === ApiErrorCode.NotAdmin ||
          e.errorCode === ApiErrorCode.InvalidAuthToken
            ? e.errorCode
            : ApiErrorCode.Unknown,
      });
    } else {
      logger.error('Something went wrong', {
        label: 'API',
        errorMessage: e.message,
      });

      return next({
        status: e.statusCode ?? 500,
        message: ApiErrorCode.Unknown,
      });
    }
  }

  const requestedServer = getJellyfinServerFromRequest({
    serverId: jellyfinServerId,
  });

  if (jellyfinServerId && !requestedServer) {
    return res.status(404).json({ error: 'Jellyfin server not found' });
  }

  return res.status(200).json(requestedServer ?? settings.jellyfin);
});

settingsRoutes.get('/jellyfin/library', async (req, res, next) => {
  const settings = getSettings();
  const server = getJellyfinServerFromRequest({
    serverId: req.query.serverId?.toString(),
  });

  if (!server) {
    if (req.query.serverId) {
      return res.status(404).json({ error: 'Jellyfin server not found' });
    }

    return res.status(200).json([]);
  }

  const serverIndex = settings.jellyfinServers.findIndex(
    (jellyfinServer) => jellyfinServer.id === server.id
  );

  if (serverIndex === -1 || !settings.jellyfinServers[serverIndex]) {
    return res.status(404).json({ error: 'Jellyfin server not found.' });
  }

  if (req.query.sync) {
    const userRepository = getRepository(User);
    const admin = await userRepository.findOneOrFail({
      select: ['id', 'jellyfinDeviceId', 'jellyfinUserId'],
      where: { id: 1 },
      order: { id: 'ASC' },
    });
    const jellyfinClient = new JellyfinAPI(
      getHostname(server),
      server.apiKey,
      admin.jellyfinDeviceId ?? '',
      server.mediaServerType
    );

    jellyfinClient.setUserId(admin.jellyfinUserId ?? '');

    const libraries = await jellyfinClient.getLibraries();

    if (libraries.length === 0) {
      // Check if no libraries are found due to the fallback to user views
      // This only affects LDAP users
      const account = await jellyfinClient.getUser();

      // Automatic Library grouping is not supported when user views are used to get library
      if (account.Configuration.GroupedFolders?.length > 0) {
        return next({
          status: 501,
          message: ApiErrorCode.SyncErrorGroupedFolders,
        });
      }

      return next({ status: 404, message: ApiErrorCode.SyncErrorNoLibraries });
    }

    const newLibraries: Library[] = libraries.map((library) => {
      const existing = server.libraries.find(
        (l) => l.id === library.key && l.name === library.title
      );

      return {
        id: library.key,
        name: library.title,
        enabled: existing?.enabled ?? false,
        type: library.type,
      };
    });

    const updated = settings.updateJellyfinServer(
      server.id,
      (jellyfinServer) => ({
        ...jellyfinServer,
        libraries: newLibraries,
      })
    );

    if (!updated) {
      return res.status(404).json({ error: 'Jellyfin server not found.' });
    }
  }

  const enabledLibraries = req.query.enable
    ? (req.query.enable as string).split(',')
    : [];

  const updated = settings.updateJellyfinServer(
    server.id,
    (jellyfinServer) => ({
      ...jellyfinServer,
      libraries: jellyfinServer.libraries.map((library) => ({
        ...library,
        enabled: enabledLibraries.includes(library.id),
      })),
    })
  );

  if (!updated) {
    return res.status(404).json({ error: 'Jellyfin server not found.' });
  }

  await settings.save();
  return res
    .status(200)
    .json(
      settings.jellyfinServers.find(
        (jellyfinServer) => jellyfinServer.id === server.id
      )?.libraries ?? []
    );
});

settingsRoutes.get('/jellyfin/servers', (_req, res) => {
  return res.status(200).json(getSettings().jellyfinServers);
});

settingsRoutes.delete('/jellyfin/servers/:serverId', async (req, res, next) => {
  const settings = getSettings();
  if (
    !settings.jellyfinServers.some(
      (server) => server.id === req.params.serverId
    )
  ) {
    return next({ status: 404, message: 'Jellyfin server not found.' });
  }

  const linkedUserCount = await getRepository(User).count({
    where: { jellyfinServerId: req.params.serverId },
  });

  if (linkedUserCount > 0) {
    return next({
      status: 409,
      message: 'Cannot delete Jellyfin server: linked users exist.',
    });
  }

  const removedServer = settings.removeJellyfinServer(req.params.serverId);

  if (!removedServer) {
    return next({ status: 404, message: 'Jellyfin server not found.' });
  }

  clearAvatarImageProxyCache(removedServer.id);
  await settings.save();

  return res.status(200).json(removedServer);
});

settingsRoutes.get('/jellyfin/users', async (req, res) => {
  const server = getJellyfinServerFromRequest({
    serverId: req.query.serverId?.toString(),
  });

  if (!server) {
    if (req.query.serverId) {
      return res.status(404).json({ error: 'Jellyfin server not found' });
    }

    return res.status(200).json([]);
  }

  const userRepository = getRepository(User);
  const admin = await userRepository.findOneOrFail({
    select: ['id', 'jellyfinDeviceId', 'jellyfinUserId'],
    where: { id: 1 },
    order: { id: 'ASC' },
  });
  const jellyfinClient = new JellyfinAPI(
    getHostname(server),
    server.apiKey,
    admin.jellyfinDeviceId ?? '',
    server.mediaServerType
  );

  jellyfinClient.setUserId(admin.jellyfinUserId ?? '');
  const resp = await jellyfinClient.getUsers();
  const jellyfinUsers = resp.users.map((user) => ({
    username: user.Name || user.Id,
    id: user.Id,
    thumb: `/avatarproxy/${user.Id}?serverId=${server.id}`,
    email: user.Name || user.Id,
  }));

  const jellyfinUserIds = jellyfinUsers.map((user) => user.id);
  const existingUsers = jellyfinUserIds.length
    ? await userRepository
        .createQueryBuilder('user')
        .where('user.jellyfinUserId IN (:...jellyfinUserIds)', {
          jellyfinUserIds,
        })
        .getMany()
    : [];

  const users = jellyfinUsers.filter((user) => {
    const existingUser = existingUsers.find(
      (existing) =>
        existing.jellyfinUserId === user.id &&
        (!existing.jellyfinServerId || existing.jellyfinServerId === server.id)
    );

    return !existingUser;
  });

  return res.status(200).json(users);
});

settingsRoutes.get('/jellyfin/sync', (_req, res) => {
  return res.status(200).json(jellyfinFullScanner.status());
});

settingsRoutes.post('/jellyfin/sync', (req, res) => {
  if (req.body.cancel) {
    jellyfinFullScanner.cancel();
  } else if (req.body.start) {
    jellyfinFullScanner.run();
  }
  return res.status(200).json(jellyfinFullScanner.status());
});
settingsRoutes.get('/tautulli', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.tautulli);
});

settingsRoutes.post('/tautulli', async (req, res, next) => {
  const settings = getSettings();

  Object.assign(settings.tautulli, req.body);

  if (settings.tautulli.hostname) {
    try {
      const tautulliClient = new TautulliAPI(settings.tautulli);

      const result = await tautulliClient.getInfo();

      if (!semver.gte(semver.coerce(result?.tautulli_version) ?? '', '2.9.0')) {
        throw new Error('Tautulli version not supported');
      }

      await settings.save();
    } catch (e) {
      logger.error('Something went wrong testing Tautulli connection', {
        label: 'API',
        errorMessage: e.message,
      });
      return next({
        status: 500,
        message: 'Unable to connect to Tautulli.',
      });
    }
  }

  return res.status(200).json(settings.tautulli);
});

settingsRoutes.get(
  '/plex/users',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    const userRepository = getRepository(User);
    const qb = userRepository.createQueryBuilder('user');
    const requestedServerId = req.query.serverId?.toString();
    const plexServer = getPlexServerFromRequest({
      serverId: requestedServerId,
    });

    if (requestedServerId && !plexServer) {
      return next({
        status: 404,
        message: 'Plex server not found.',
      });
    }

    if (!plexServer) {
      return next({
        status: 404,
        message: 'No Plex server configured.',
      });
    }

    try {
      const admin = await userRepository.findOneOrFail({
        select: { id: true, plexToken: true },
        where: { id: 1 },
      });
      const plexApi = new PlexTvAPI(admin.plexToken ?? '');
      const plexUsers = (await plexApi.getUsers()).MediaContainer.User.map(
        (user) => user.$
      ).filter((user) => user.email);

      const unimportedPlexUsers: {
        id: string;
        title: string;
        username: string;
        email: string;
        thumb: string;
      }[] = [];

      const plexIds = plexUsers.map((plexUser) => plexUser.id);
      const plexEmails = plexUsers.map((plexUser) =>
        plexUser.email.toLowerCase()
      );
      if (!plexIds.length) plexIds.push('-1');
      if (!plexEmails.length) plexEmails.push('@');

      const existingUsers = await qb
        .where('user.plexId IN (:...plexIds)', { plexIds })
        .orWhere('user.email IN (:...plexEmails)', { plexEmails })
        .getMany();

      await Promise.all(
        plexUsers.map(async (plexUser) => {
          const existingUser = existingUsers.find(
            (user) =>
              user.plexId === parseInt(plexUser.id) ||
              user.email === plexUser.email.toLowerCase()
          );

          if (
            (!existingUser || !existingUser.plexId) &&
            (await plexApi.checkUserAccess(
              parseInt(plexUser.id),
              plexServer.machineId
            ))
          ) {
            unimportedPlexUsers.push(plexUser);
          }
        })
      );

      return res.status(200).json(sortBy(unimportedPlexUsers, 'username'));
    } catch (e) {
      logger.error('Something went wrong getting unimported Plex users', {
        label: 'API',
        errorMessage: e.message,
      });
      next({
        status: 500,
        message: 'Unable to retrieve unimported Plex users.',
      });
    }
  }
);

settingsRoutes.get(
  '/logs',
  rateLimit({ windowMs: 60 * 1000, max: 50 }),
  (req, res, next) => {
    const pageSize = req.query.take ? Number(req.query.take) : 25;
    const skip = req.query.skip ? Number(req.query.skip) : 0;
    const search = (req.query.search as string) ?? '';
    const searchRegexp = new RegExp(escapeRegExp(search), 'i');

    let filter: string[] = [];
    switch (req.query.filter) {
      case 'debug':
        filter.push('debug');
      // falls through
      case 'info':
        filter.push('info');
      // falls through
      case 'warn':
        filter.push('warn');
      // falls through
      case 'error':
        filter.push('error');
        break;
      default:
        filter = ['debug', 'info', 'warn', 'error'];
    }

    const logFile = process.env.CONFIG_DIRECTORY
      ? `${process.env.CONFIG_DIRECTORY}/logs/.machinelogs.json`
      : path.join(__dirname, '../../../config/logs/.machinelogs.json');
    const logs: LogMessage[] = [];
    const logMessageProperties = [
      'timestamp',
      'level',
      'label',
      'message',
      'data',
    ];

    const deepValueStrings = (obj: Record<string, unknown>): string[] => {
      const values = [];

      for (const val of Object.values(obj)) {
        if (typeof val === 'string') {
          values.push(val);
        } else if (typeof val === 'number') {
          values.push(val.toString());
        } else if (val !== null && typeof val === 'object') {
          values.push(...deepValueStrings(val as Record<string, unknown>));
        }
      }

      return values;
    };

    try {
      fs.readFileSync(logFile, 'utf-8')
        .split('\n')
        .forEach((line) => {
          if (!line.length) return;

          const logMessage = JSON.parse(line);

          if (!filter.includes(logMessage.level)) {
            return;
          }

          if (
            !Object.keys(logMessage).every((key) =>
              logMessageProperties.includes(key)
            )
          ) {
            Object.keys(logMessage)
              .filter((prop) => !logMessageProperties.includes(prop))
              .forEach((prop) => {
                set(logMessage, `data.${prop}`, logMessage[prop]);
              });
          }

          if (req.query.search) {
            if (
              // label and data are sometimes undefined
              !searchRegexp.test(logMessage.label ?? '') &&
              !searchRegexp.test(logMessage.message) &&
              !deepValueStrings(logMessage.data ?? {}).some((val) =>
                searchRegexp.test(val)
              )
            ) {
              return;
            }
          }

          logs.push(logMessage);
        });

      const displayedLogs = logs.reverse().slice(skip, skip + pageSize);

      return res.status(200).json({
        pageInfo: {
          pages: Math.ceil(logs.length / pageSize),
          pageSize,
          results: logs.length,
          page: Math.ceil(skip / pageSize) + 1,
        },
        results: displayedLogs,
      } as LogsResultsResponse);
    } catch (error) {
      logger.error('Something went wrong while retrieving logs', {
        label: 'Logs',
        errorMessage: error.message,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve logs.',
      });
    }
  }
);

settingsRoutes.get('/jobs', (_req, res) => {
  return res.status(200).json(
    scheduledJobs.map((job) => ({
      id: job.id,
      name: job.name,
      type: job.type,
      interval: job.interval,
      cronSchedule: job.cronSchedule,
      nextExecutionTime: job.job.nextInvocation(),
      running: job.running ? job.running() : false,
    }))
  );
});

settingsRoutes.post<{ jobId: string }>('/jobs/:jobId/run', (req, res, next) => {
  const scheduledJob = scheduledJobs.find((job) => job.id === req.params.jobId);

  if (!scheduledJob) {
    return next({ status: 404, message: 'Job not found.' });
  }

  scheduledJob.job.invoke();

  return res.status(200).json({
    id: scheduledJob.id,
    name: scheduledJob.name,
    type: scheduledJob.type,
    interval: scheduledJob.interval,
    cronSchedule: scheduledJob.cronSchedule,
    nextExecutionTime: scheduledJob.job.nextInvocation(),
    running: scheduledJob.running ? scheduledJob.running() : false,
  });
});

settingsRoutes.post<{ jobId: JobId }>(
  '/jobs/:jobId/cancel',
  (req, res, next) => {
    const scheduledJob = scheduledJobs.find(
      (job) => job.id === req.params.jobId
    );

    if (!scheduledJob) {
      return next({ status: 404, message: 'Job not found.' });
    }

    if (scheduledJob.cancelFn) {
      scheduledJob.cancelFn();
    }

    return res.status(200).json({
      id: scheduledJob.id,
      name: scheduledJob.name,
      type: scheduledJob.type,
      interval: scheduledJob.interval,
      cronSchedule: scheduledJob.cronSchedule,
      nextExecutionTime: scheduledJob.job.nextInvocation(),
      running: scheduledJob.running ? scheduledJob.running() : false,
    });
  }
);

settingsRoutes.post<{ jobId: JobId }>(
  '/jobs/:jobId/schedule',
  async (req, res, next) => {
    const scheduledJob = scheduledJobs.find(
      (job) => job.id === req.params.jobId
    );

    if (!scheduledJob) {
      return next({ status: 404, message: 'Job not found.' });
    }

    const result = rescheduleJob(scheduledJob.job, req.body.schedule);
    const settings = getSettings();

    if (result) {
      settings.jobs[scheduledJob.id].schedule = req.body.schedule;
      await settings.save();

      scheduledJob.cronSchedule = req.body.schedule;

      return res.status(200).json({
        id: scheduledJob.id,
        name: scheduledJob.name,
        type: scheduledJob.type,
        interval: scheduledJob.interval,
        cronSchedule: scheduledJob.cronSchedule,
        nextExecutionTime: scheduledJob.job.nextInvocation(),
        running: scheduledJob.running ? scheduledJob.running() : false,
      });
    } else {
      return next({ status: 400, message: 'Invalid job schedule.' });
    }
  }
);

settingsRoutes.get('/cache', async (_req, res) => {
  const cacheManagerCaches = cacheManager.getAllCaches();

  const apiCaches = Object.values(cacheManagerCaches).map((cache) => ({
    id: cache.id,
    name: cache.name,
    stats: cache.getStats(),
  }));

  const tmdbImageCache = await ImageProxy.getImageStats('tmdb');
  const avatarImageCache = await ImageProxy.getImageStats('avatar');

  const stats: DnsStats | undefined = dnsCache?.getStats();
  const entries: DnsEntries | undefined = dnsCache?.getCacheEntries();

  return res.status(200).json({
    apiCaches,
    imageCache: {
      tmdb: tmdbImageCache,
      avatar: avatarImageCache,
    },
    dnsCache: {
      stats,
      entries,
    },
  });
});

settingsRoutes.post<{ cacheId: AvailableCacheIds }>(
  '/cache/:cacheId/flush',
  (req, res, next) => {
    const cache = cacheManager.getCache(req.params.cacheId);

    if (cache) {
      cache.flush();
      return res.status(204).send();
    }

    next({ status: 404, message: 'Cache not found.' });
  }
);

settingsRoutes.post<{ dnsEntry: string }>(
  '/cache/dns/:dnsEntry/flush',
  (req, res, next) => {
    const dnsEntry = req.params.dnsEntry;

    if (dnsCache) {
      dnsCache.clear(dnsEntry);
      return res.status(204).send();
    }

    next({ status: 404, message: 'Cache not found.' });
  }
);

settingsRoutes.post(
  '/initialize',
  isAuthenticated(Permission.ADMIN),
  async (_req, res) => {
    const settings = getSettings();

    settings.public.initialized = true;
    await settings.save();

    return res.status(200).json(settings.public);
  }
);

settingsRoutes.get('/about', async (req, res) => {
  const mediaRepository = getRepository(Media);
  const mediaRequestRepository = getRepository(MediaRequest);

  const totalMediaItems = await mediaRepository.count();
  const totalRequests = await mediaRequestRepository.count();

  return res.status(200).json({
    version: getAppVersion(),
    totalMediaItems,
    totalRequests,
    tz: process.env.TZ,
    appDataPath: appDataPath(),
  } as SettingsAboutResponse);
});

export default settingsRoutes;
