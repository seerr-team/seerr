import { MediaServerType } from '@server/constants/server';
import type {
  AllSettings,
  JellyfinServerSettings,
  PlexServerSettings,
} from '@server/lib/settings';
import { randomUUID } from 'crypto';
import type { LegacySettings } from './types';

const hasLegacyPlexConfig = (settings: LegacySettings): boolean =>
  Boolean(
    settings.plex?.ip ||
    settings.plex?.machineId ||
    settings.plex?.libraries?.length
  );

const hasLegacyJellyfinConfig = (settings: LegacySettings): boolean =>
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
    server.mediaServerType === MediaServerType.EMBY
      ? MediaServerType.EMBY
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

const migrateMultiMediaServers = (settings: LegacySettings): AllSettings => {
  if (!Array.isArray(settings.plexServers)) {
    settings.plexServers = [];
  }

  if (!Array.isArray(settings.jellyfinServers)) {
    settings.jellyfinServers = [];
  }

  settings.plexServers = settings.plexServers.map((server) =>
    normalizePlexServer(server)
  );

  settings.jellyfinServers = settings.jellyfinServers.map((server) =>
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

  if (!settings.main) {
    settings.main = {};
  }

  const primaryMediaServer =
    settings.plexServers[0] ?? settings.jellyfinServers[0];
  settings.main.mediaServerType =
    primaryMediaServer?.mediaServerType ?? MediaServerType.NOT_CONFIGURED;

  return settings as AllSettings;
};

export default migrateMultiMediaServers;
