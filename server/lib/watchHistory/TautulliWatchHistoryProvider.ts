import TautulliAPI from '@server/api/tautulli';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import type { UserWatchDataResponse } from '@server/interfaces/api/userInterfaces';
import { getSettings } from '@server/lib/settings';
import {
  WatchHistoryError,
  WatchHistoryErrorCode,
} from '@server/lib/watchHistory/errors';
import type { WatchHistoryProvider } from '@server/lib/watchHistory/WatchHistoryProvider';
import { findIndex, sortBy } from 'lodash';
import { In } from 'typeorm';

export class TautulliWatchHistoryProvider implements WatchHistoryProvider {
  public async getUserWatchData(
    userId: number
  ): Promise<UserWatchDataResponse> {
    const settings = getSettings().tautulli;

    if (!settings.hostname || !settings.port || !settings.apiKey) {
      throw new WatchHistoryError({
        code: WatchHistoryErrorCode.ProviderNotConfigured,
        message: 'Tautulli API not configured.',
        statusCode: 404,
      });
    }

    const user = await getRepository(User).findOneOrFail({
      where: { id: userId },
      select: { id: true, plexId: true },
    });

    if (!user.plexId) {
      throw new WatchHistoryError({
        code: WatchHistoryErrorCode.UserNotSupported,
        message: 'User does not have a linked Plex account.',
        statusCode: 404,
      });
    }

    try {
      const tautulli = new TautulliAPI(settings);
      const watchStats = await tautulli.getUserWatchStats(user);
      const watchHistory = await tautulli.getUserWatchHistory(user);

      const recentlyWatched = sortBy(
        await getRepository(Media).find({
          where: [
            {
              mediaType: MediaType.MOVIE,
              ratingKey: In(
                watchHistory
                  .filter((record) => record.media_type === 'movie')
                  .map((record) => record.rating_key)
              ),
            },
            {
              mediaType: MediaType.MOVIE,
              ratingKey4k: In(
                watchHistory
                  .filter((record) => record.media_type === 'movie')
                  .map((record) => record.rating_key)
              ),
            },
            {
              mediaType: MediaType.TV,
              ratingKey: In(
                watchHistory
                  .filter((record) => record.media_type === 'episode')
                  .map((record) => record.grandparent_rating_key)
              ),
            },
            {
              mediaType: MediaType.TV,
              ratingKey4k: In(
                watchHistory
                  .filter((record) => record.media_type === 'episode')
                  .map((record) => record.grandparent_rating_key)
              ),
            },
          ],
        }),
        [
          (media) =>
            findIndex(
              watchHistory,
              (record) =>
                (!!media.ratingKey &&
                  parseInt(media.ratingKey) ===
                    (record.media_type === 'movie'
                      ? record.rating_key
                      : record.grandparent_rating_key)) ||
                (!!media.ratingKey4k &&
                  parseInt(media.ratingKey4k) ===
                    (record.media_type === 'movie'
                      ? record.rating_key
                      : record.grandparent_rating_key))
            ),
        ]
      );

      return {
        recentlyWatched,
        playCount: watchStats.total_plays,
      };
    } catch (e) {
      throw new WatchHistoryError({
        code: WatchHistoryErrorCode.FetchFailed,
        message: 'Failed to fetch Tautulli watch history.',
        statusCode: 500,
        cause: e,
      });
    }
  }
}
