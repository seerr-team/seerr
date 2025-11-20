import PlexTvAPI from '@server/api/plextv';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import {
  DuplicateMediaRequestError,
  MediaRequest,
  NoSeasonsAvailableError,
  QuotaRestrictedError,
  RequestPermissionError,
} from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import logger from '@server/logger';
import { Permission } from './permissions';

class WatchlistSync {
  public async syncWatchlist() {
    const userRepository = getRepository(User);

    // Get users who actually have plex tokens
    const users = await userRepository
      .createQueryBuilder('user')
      .addSelect('user.plexToken')
      .leftJoinAndSelect('user.settings', 'settings')
      .where("user.plexToken != ''")
      .getMany();

    for (const user of users) {
      await this.syncUserWatchlist(user);
    }
  }

  private async syncUserWatchlist(user: User) {
    if (!user.plexToken) {
      logger.warn('Skipping user watchlist sync for user without plex token', {
        label: 'Plex Watchlist Sync',
        user: user.displayName,
      });
      return;
    }

    if (
      !user.hasPermission(
        [
          Permission.AUTO_REQUEST,
          Permission.AUTO_REQUEST_MOVIE,
          Permission.AUTO_APPROVE_TV,
        ],
        { type: 'or' }
      )
    ) {
      return;
    }

    if (
      !user.settings?.watchlistSyncMovies &&
      !user.settings?.watchlistSyncTv
    ) {
      // Skip sync if user settings have it disabled
      return;
    }

    const plexTvApi = new PlexTvAPI(user.plexToken);

    const response = await plexTvApi.getWatchlist({ size: 20 });

    const mediaItems = await Media.getRelatedMedia(
      user,
      response.items.map((i) => i.tmdbId)
    );

    const unavailableItems = response.items.filter(
      // If we can find watchlist items in our database that are also available, we should exclude them
      (i) =>
        !mediaItems.find(
          (m) =>
            m.tmdbId === i.tmdbId &&
            ((m.status !== MediaStatus.UNKNOWN && m.mediaType === 'movie') ||
              (m.mediaType === 'tv' && m.status === MediaStatus.AVAILABLE))
        )
    );

    for (const mediaItem of unavailableItems) {
      try {
        logger.info("Creating media request from user's Plex Watchlist", {
          label: 'Watchlist Sync',
          userId: user.id,
          mediaTitle: mediaItem.title,
        });

        if (mediaItem.type === 'show' && !mediaItem.tvdbId) {
          throw new Error('Missing TVDB ID from Plex Metadata');
        }

        // Check if they have auto-request permissons and watchlist sync
        // enabled for the media type
        if (
          ((!user.hasPermission(
            [Permission.AUTO_REQUEST, Permission.AUTO_REQUEST_MOVIE],
            { type: 'or' }
          ) ||
            !user.settings?.watchlistSyncMovies) &&
            mediaItem.type === 'movie') ||
          ((!user.hasPermission(
            [Permission.AUTO_REQUEST, Permission.AUTO_REQUEST_TV],
            { type: 'or' }
          ) ||
            !user.settings?.watchlistSyncTv) &&
            mediaItem.type === 'show')
        ) {
          continue;
        }

        await MediaRequest.request(
          {
            mediaId: mediaItem.tmdbId,
            mediaType:
              mediaItem.type === 'show' ? MediaType.TV : MediaType.MOVIE,
            seasons: mediaItem.type === 'show' ? 'all' : undefined,
            tvdbId: mediaItem.tvdbId,
            is4k: false,
          },
          user,
          { isAutoRequest: true }
        );
      } catch (e) {
        if (!(e instanceof Error)) {
          continue;
        }

        switch (e.constructor) {
          // During watchlist sync, these errors aren't necessarily
          // a problem with Seerr. Since we are auto syncing these constantly, it's
          // possible they are unexpectedly at their quota limit, for example. So we'll
          // instead log these as debug messages.
          case RequestPermissionError:
          case DuplicateMediaRequestError:
          case QuotaRestrictedError:
          case NoSeasonsAvailableError:
            logger.debug('Failed to create media request from watchlist', {
              label: 'Watchlist Sync',
              userId: user.id,
              mediaTitle: mediaItem.title,
              errorMessage: e.message,
            });
            break;
          default:
            logger.error('Failed to create media request from watchlist', {
              label: 'Watchlist Sync',
              userId: user.id,
              mediaTitle: mediaItem.title,
              errorMessage: e.message,
            });
        }
      }
    }
  }
}

const watchlistSync = new WatchlistSync();

export default watchlistSync;
