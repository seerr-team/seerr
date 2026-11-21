import { ApiErrorCode } from '@server/constants/error';
import { MediaServerType } from '@server/constants/server';
import { getSettings } from '@server/lib/settings';
import { EmbyWatchHistoryProvider } from '@server/lib/watchHistory/EmbyWatchHistoryProvider';
import { JellyfinWatchHistoryProvider } from '@server/lib/watchHistory/JellyfinWatchHistoryProvider';
import { TautulliWatchHistoryProvider } from '@server/lib/watchHistory/TautulliWatchHistoryProvider';
import type { WatchHistoryProvider } from '@server/lib/watchHistory/WatchHistoryProvider';
import { ApiError } from '@server/types/error';

export const getWatchHistoryProvider = (): WatchHistoryProvider => {
  const settings = getSettings();

  switch (settings.main.mediaServerType) {
    case MediaServerType.PLEX:
      return new TautulliWatchHistoryProvider();

    case MediaServerType.JELLYFIN:
      return new JellyfinWatchHistoryProvider();

    case MediaServerType.EMBY:
      return new EmbyWatchHistoryProvider();

    default:
      throw new ApiError(404, ApiErrorCode.Unknown);
  }
};
