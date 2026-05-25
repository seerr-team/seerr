import type { JellyfinPlayedItem } from '@server/api/jellyfin';
import JellyfinAPI from '@server/api/jellyfin';
import { ApiErrorCode } from '@server/constants/error';
import { MediaType } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import type { UserWatchDataResponse } from '@server/interfaces/api/userInterfaces';
import { getSettings } from '@server/lib/settings';
import type { WatchHistoryProvider } from '@server/lib/watchHistory/WatchHistoryProvider';
import { ApiError } from '@server/types/error';
import { getHostname } from '@server/utils/getHostname';
import { sortBy } from 'lodash';
import { In } from 'typeorm';

const getTmdbId = (item: JellyfinPlayedItem): number | undefined => {
  const rawTmdbId = item.ProviderIds?.Tmdb ?? item.ProviderIds?.TheMovieDb;

  if (!rawTmdbId) {
    return undefined;
  }

  const tmdbId = Number(rawTmdbId);

  return Number.isNaN(tmdbId) ? undefined : tmdbId;
};

const getMediaType = (item: JellyfinPlayedItem): MediaType | undefined => {
  if (item.Type === 'Movie') {
    return MediaType.MOVIE;
  }

  if (item.Type === 'Series') {
    return MediaType.TV;
  }

  return undefined;
};

export class JellyfinWatchHistoryProvider implements WatchHistoryProvider {
  protected readonly mediaServerType: MediaServerType =
    MediaServerType.JELLYFIN;
  protected readonly mediaServerName: string = 'Jellyfin';

  public async getUserWatchData(
    userId: number
  ): Promise<UserWatchDataResponse> {
    const settings = getSettings();

    if (settings.main.mediaServerType !== this.mediaServerType) {
      throw new ApiError(404, ApiErrorCode.Unknown);
    }

    if (!settings.jellyfin.apiKey) {
      throw new ApiError(404, ApiErrorCode.InvalidAuthToken);
    }

    const user = await getRepository(User).findOneOrFail({
      where: { id: userId },
      select: {
        id: true,
        jellyfinUserId: true,
        jellyfinDeviceId: true,
        jellyfinAuthToken: true,
      },
    });

    if (!user.jellyfinUserId) {
      throw new ApiError(404, ApiErrorCode.Unknown);
    }

    const authToken = user.jellyfinAuthToken ?? settings.jellyfin.apiKey;

    const jellyfin = new JellyfinAPI(
      getHostname(),
      authToken,
      user.jellyfinDeviceId ?? undefined
    );

    jellyfin.setUserId(user.jellyfinUserId);

    const playedItemsResponse = await jellyfin.getPlayedItems({
      userId: user.jellyfinUserId,
      limit: 100,
    });

    const playedItems = playedItemsResponse.Items.filter((item) => {
      return !!getMediaType(item) && !!getTmdbId(item);
    });

    const movieTmdbIds = playedItems
      .filter((item) => getMediaType(item) === MediaType.MOVIE)
      .map((item) => getTmdbId(item))
      .filter((tmdbId): tmdbId is number => typeof tmdbId === 'number');

    const tvTmdbIds = playedItems
      .filter((item) => getMediaType(item) === MediaType.TV)
      .map((item) => getTmdbId(item))
      .filter((tmdbId): tmdbId is number => typeof tmdbId === 'number');

    const where = [];

    if (movieTmdbIds.length > 0) {
      where.push({
        mediaType: MediaType.MOVIE,
        tmdbId: In(movieTmdbIds),
      });
    }

    if (tvTmdbIds.length > 0) {
      where.push({
        mediaType: MediaType.TV,
        tmdbId: In(tvTmdbIds),
      });
    }

    if (where.length === 0) {
      return {
        recentlyWatched: [],
        playCount: 0,
      };
    }

    const order = new Map(
      playedItems.map((item, index) => {
        return [`${getMediaType(item)}:${getTmdbId(item)}`, index];
      })
    );

    const matchedMedia = await getRepository(Media).find({ where });

    const recentlyWatched = sortBy(matchedMedia, [
      (media) =>
        order.get(`${media.mediaType}:${media.tmdbId}`) ??
        Number.MAX_SAFE_INTEGER,
    ]);

    const playCount = playedItems.reduce((sum, item) => {
      return sum + (item.UserData?.PlayCount ?? 0);
    }, 0);

    return {
      recentlyWatched,
      playCount,
    };
  }
}
