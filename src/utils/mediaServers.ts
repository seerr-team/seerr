import { MediaServerType } from '@server/constants/server';
import type { PublicSettingsResponse } from '@server/interfaces/api/settingsInterfaces';

export type PublicMediaServer = PublicSettingsResponse['mediaServers'][number];

export const getMediaServerTypeName = (
  mediaServerType: number
): string | undefined => {
  switch (mediaServerType) {
    case MediaServerType.PLEX:
      return 'Plex';
    case MediaServerType.JELLYFIN:
      return 'Jellyfin';
    case MediaServerType.EMBY:
      return 'Emby';
    default:
      return undefined;
  }
};

export const getConfiguredMediaServerTypeLabel = (
  settings: Pick<PublicSettingsResponse, 'mediaServerTypes'>
): string =>
  settings.mediaServerTypes
    .map((mediaServerType) => getMediaServerTypeName(mediaServerType))
    .filter((name): name is string => Boolean(name))
    .join(' / ') || 'Media Server';

export const getMediaServerDisplayName = (
  server: Pick<PublicMediaServer, 'mediaServerType' | 'name'>
): string => {
  const typeName =
    getMediaServerTypeName(server.mediaServerType) ?? 'Media Server';

  return server.name && server.name.toLowerCase() !== typeName.toLowerCase()
    ? `${typeName}: ${server.name}`
    : typeName;
};

export const getJellyfinLikeServers = (
  settings: Pick<PublicSettingsResponse, 'mediaServers'>
): PublicMediaServer[] =>
  settings.mediaServers.filter(
    (server) =>
      server.mediaServerType === MediaServerType.JELLYFIN ||
      server.mediaServerType === MediaServerType.EMBY
  );
