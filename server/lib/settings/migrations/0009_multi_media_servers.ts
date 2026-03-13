import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import type {
  AllSettings,
  JellyfinServerSettings,
  JellyfinSettings,
  PlexServerSettings,
  PlexSettings,
} from '@server/lib/settings';
import { randomUUID } from 'crypto';

const hasLegacyPlexConfig = (settings: any): boolean =>
  Boolean(
    settings.plex?.ip ||
    settings.plex?.machineId ||
    settings.plex?.libraries?.length
  );

const hasLegacyJellyfinConfig = (settings: any): boolean =>
  Boolean(
    settings.jellyfin?.ip ||
    settings.jellyfin?.serverId ||
    settings.jellyfin?.libraries?.length
  );

const normalizePlexServer = (
  server: Partial<PlexServerSettings>
): PlexServerSettings => ({
  id: server.id ?? randomUUID(),
  mediaServerType: MediaServerType.PLEX,
  name: server.name ?? '',
  machineId: server.machineId,
  ip: server.ip ?? '',
  port: server.port ?? 32400,
  useSsl: server.useSsl ?? false,
  libraries: server.libraries ?? [],
  webAppUrl: server.webAppUrl,
});

const normalizeJellyfinServer = (
  server: Partial<JellyfinServerSettings>,
  fallbackMediaServerType:
    | MediaServerType.JELLYFIN
    | MediaServerType.EMBY = MediaServerType.JELLYFIN
): JellyfinServerSettings => ({
  id: server.id ?? randomUUID(),
  mediaServerType:
    server.mediaServerType === MediaServerType.EMBY ||
    server.mediaServerType === MediaServerType.JELLYFIN
      ? server.mediaServerType
      : fallbackMediaServerType,
  name: server.name ?? '',
  ip: server.ip ?? '',
  port: server.port ?? 8096,
  useSsl: server.useSsl ?? false,
  urlBase: server.urlBase ?? '',
  externalHostname: server.externalHostname ?? '',
  jellyfinForgotPasswordUrl: server.jellyfinForgotPasswordUrl ?? '',
  libraries: server.libraries ?? [],
  serverId: server.serverId ?? '',
  apiKey: server.apiKey ?? '',
});

const getPrimaryMediaServerType = (settings: any): MediaServerType => {
  const configuredMediaServerType = settings.main.mediaServerType as
    | MediaServerType.PLEX
    | MediaServerType.JELLYFIN
    | MediaServerType.EMBY
    | undefined;
  const mediaServerTypes = [
    ...new Set(
      [
        ...(settings.plexServers ?? []).map(
          (server: any) => server.mediaServerType
        ),
        ...(settings.jellyfinServers ?? []).map(
          (server: any) => server.mediaServerType
        ),
      ].filter(
        (
          mediaServerType
        ): mediaServerType is
          | MediaServerType.PLEX
          | MediaServerType.JELLYFIN
          | MediaServerType.EMBY => mediaServerType !== undefined
      )
    ),
  ];

  if (
    configuredMediaServerType !== undefined &&
    mediaServerTypes.includes(configuredMediaServerType)
  ) {
    return configuredMediaServerType;
  }

  if (mediaServerTypes.length === 1) {
    return mediaServerTypes[0];
  }

  return MediaServerType.NOT_CONFIGURED;
};

const syncLegacyPrimaryServers = (settings: any): void => {
  if (settings.plexServers?.length === 1 && hasLegacyPlexConfig(settings)) {
    const primaryPlexServer = settings.plexServers[0];
    settings.plexServers[0] = normalizePlexServer({
      ...primaryPlexServer,
      ...(settings.plex as Partial<PlexSettings>),
      id: primaryPlexServer.id,
      mediaServerType: MediaServerType.PLEX,
    });
  }

  if (
    settings.jellyfinServers?.length === 1 &&
    hasLegacyJellyfinConfig(settings)
  ) {
    const primaryJellyfinServer = settings.jellyfinServers[0];
    settings.jellyfinServers[0] = normalizeJellyfinServer(
      {
        ...primaryJellyfinServer,
        ...(settings.jellyfin as Partial<JellyfinSettings>),
        id: primaryJellyfinServer.id,
        mediaServerType:
          primaryJellyfinServer.mediaServerType === MediaServerType.EMBY
            ? MediaServerType.EMBY
            : MediaServerType.JELLYFIN,
      },
      primaryJellyfinServer.mediaServerType
    );
  }
};

const backfillLegacyJellyfinUsers = async (settings: any): Promise<void> => {
  if (
    settings.jellyfinServers?.length !== 1 ||
    !settings.jellyfinServers[0].id
  ) {
    return;
  }

  const [primaryServer] = settings.jellyfinServers;
  const userRepository = getRepository(User);
  const legacyUsers = await userRepository
    .createQueryBuilder('user')
    .where('user.jellyfinUserId IS NOT NULL')
    .andWhere("(user.jellyfinServerId IS NULL OR user.jellyfinServerId = '')")
    .getMany();

  for (const user of legacyUsers) {
    // Users reference Seerr's configured server entry ID, not Jellyfin's
    // native serverId, so we backfill against primaryServer.id here.
    user.jellyfinServerId = primaryServer.id;
    await userRepository.save(user);
  }
};

const migrateMultiMediaServers = async (settings: any): Promise<AllSettings> => {
  if (!Array.isArray(settings.plexServers)) {
    settings.plexServers = [];
  }

  if (!Array.isArray(settings.jellyfinServers)) {
    settings.jellyfinServers = [];
  }

  settings.plexServers = settings.plexServers.map((server: any) =>
    normalizePlexServer(server)
  );

  settings.jellyfinServers = settings.jellyfinServers.map((server: any) =>
    normalizeJellyfinServer(
      server,
      settings.main?.mediaServerType === MediaServerType.EMBY
        ? MediaServerType.EMBY
        : MediaServerType.JELLYFIN
    )
  );

  if (settings.plexServers.length === 0 && hasLegacyPlexConfig(settings)) {
    settings.plexServers.push(normalizePlexServer(settings.plex ?? {}));
  }

  if (
    settings.jellyfinServers.length === 0 &&
    hasLegacyJellyfinConfig(settings)
  ) {
    settings.jellyfinServers.push(
      normalizeJellyfinServer(
        settings.jellyfin ?? {},
        settings.main?.mediaServerType === MediaServerType.EMBY
          ? MediaServerType.EMBY
          : MediaServerType.JELLYFIN
      )
    );
  }

  syncLegacyPrimaryServers(settings);
  await backfillLegacyJellyfinUsers(settings);

  if (!settings.main) {
    settings.main = {};
  }

  settings.main.mediaServerType = getPrimaryMediaServerType(settings);

  return settings;
};

export default migrateMultiMediaServers;
