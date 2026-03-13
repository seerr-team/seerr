import { MediaServerType } from '@server/constants/server';
import type {
  JellyfinServerSettings,
  MediaServerSettings,
  PlexServerSettings,
} from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';

export const isJellyfinLikeMediaServerType = (
  mediaServerType?: number
): mediaServerType is MediaServerType.JELLYFIN | MediaServerType.EMBY =>
  mediaServerType === MediaServerType.JELLYFIN ||
  mediaServerType === MediaServerType.EMBY;

export const getPlexServers = (): PlexServerSettings[] => {
  return getSettings().plexServers;
};

export const getJellyfinServers = (
  mediaServerType?: MediaServerType.JELLYFIN | MediaServerType.EMBY
): JellyfinServerSettings[] => {
  return getSettings().jellyfinServers.filter((server) =>
    mediaServerType ? server.mediaServerType === mediaServerType : true
  );
};

export const getMediaServerById = (
  serverId?: string | null
): MediaServerSettings | undefined => {
  if (!serverId) {
    return undefined;
  }

  return getSettings()
    .getMediaServers()
    .find((server) => server.id === serverId);
};

export const hasMediaServerType = (
  mediaServerType: MediaServerType
): boolean => {
  return getSettings().getMediaServerTypes().includes(mediaServerType);
};

export const hasPlexServers = (): boolean => getPlexServers().length > 0;

export const hasJellyfinLikeServers = (): boolean =>
  getJellyfinServers().length > 0;
