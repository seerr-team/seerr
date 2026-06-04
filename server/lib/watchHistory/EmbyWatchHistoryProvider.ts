import { MediaServerType } from '@server/constants/server';
import { JellyfinWatchHistoryProvider } from '@server/lib/watchHistory/JellyfinWatchHistoryProvider';

export class EmbyWatchHistoryProvider extends JellyfinWatchHistoryProvider {
  protected readonly mediaServerType = MediaServerType.EMBY;
  protected readonly mediaServerName = 'Emby';
}
