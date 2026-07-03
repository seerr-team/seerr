import PlexTvAPI from '@server/api/plextv';
import { MediaStatus, MediaType } from '@server/constants/media';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import {
  BlocklistedMediaError,
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

    // Taken from auth.ts
    const mainUser = await userRepository.findOneOrFail({
      select: { id: true, plexToken: true },
      where: { id: 1 },
    });

    // Old imported plex users may not have plex uuids stored in the db
    const nullUsers = await userRepository
      .createQueryBuilder('user')
      .where('user.userType = :userType', { userType: UserType.PLEX })
      .andWhere('user.plexUuid IS NULL')
      .getMany();

    if (nullUsers.length > 0) {
      logger.warn(
        'Found plex users without assigned uuids. Obtaining corresponding uuids.',
        {
          label: 'Plex Watchlist Sync',
        }
      );

      const mainPlexTv = new PlexTvAPI(mainUser.plexToken ?? '');

      const plexHomeUsersResponse = await mainPlexTv.getHomeUsers();
      for (const rawUser of plexHomeUsersResponse.MediaContainer.User) {
        const account = rawUser.$;

        const user = await userRepository
          .createQueryBuilder('user')
          .where('user.plexId = :id', { id: account.id })
          .getOne();

        if (user) {
          user.plexUuid = account.uuid;
          await userRepository.save(user);
        }
      }
    }

    // Get users who actually have plex tokens
    const users = await userRepository
      .createQueryBuilder('user')
      .addSelect('user.plexToken')
      .addSelect('user.plexUuid')
      .leftJoinAndSelect('user.settings', 'settings')
      .where('user.userType = :userType', { userType: UserType.PLEX })
      .getMany();

    for (const user of users) {
      await this.syncUserWatchlist(user, mainUser.plexToken ?? '');
    }
  }

  private async syncUserWatchlist(user: User, mainPlexToken: string) {
    if (!user.plexUuid) {
      logger.warn('Skipping user watchlist sync for user without plex uuid', {
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
          Permission.AUTO_REQUEST_TV,
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

    // Token sync if the user has a token, else fallback to sync using the main user's token
    const plexTvApi = user.plexToken
      ? new PlexTvAPI(user.plexToken)
      : new PlexTvAPI(mainPlexToken);

    const response = await plexTvApi.getWatchlist(user.plexUuid);

    // endCursor will be undefined if the GQL query fails to return Watchlist data
    if (response.endCursor === undefined && user.settings) {
      user.settings.watchlistSyncMovies = false;
      user.settings.watchlistSyncTv = false;

      const userRepository = getRepository(User);
      await userRepository.save(user);

      logger.warn(
        'Disabling watchlist sync for user because access is denied',
        {
          label: 'Plex Watchlist Sync',
          user: user.displayName,
        }
      );
      return;
    }

    const mediaItems = await Media.getRelatedMedia(
      user,
      response.items.map((i) => ({
        tmdbId: i.tmdbId,
        mediaType: i.type === 'show' ? MediaType.TV : MediaType.MOVIE,
      }))
    );

    const watchlistTmdbIds = response.items.map((i) => i.tmdbId);

    const requestRepository = getRepository(MediaRequest);
    const existingAutoRequests: MediaRequest[] =
      watchlistTmdbIds.length > 0
        ? await requestRepository
            .createQueryBuilder('request')
            .leftJoinAndSelect('request.media', 'media')
            .where('request.requestedBy = :userId', { userId: user.id })
            .andWhere('request.isAutoRequest = true')
            .andWhere('media.tmdbId IN (:...tmdbIds)', {
              tmdbIds: watchlistTmdbIds,
            })
            .getMany()
        : [];

    const autoRequestedTmdbIds = new Set(
      existingAutoRequests
        .filter(
          (r) => r.media != null && r.media.status !== MediaStatus.DELETED
        )
        .map((r) => `${r.media.mediaType}:${r.media.tmdbId}`)
    );

    const unavailableItems = response.items.filter((i) => {
      const itemMediaType = i.type === 'show' ? MediaType.TV : MediaType.MOVIE;

      return (
        !autoRequestedTmdbIds.has(`${itemMediaType}:${i.tmdbId}`) &&
        !mediaItems.find(
          (m) =>
            m.tmdbId === i.tmdbId &&
            m.mediaType === itemMediaType &&
            (m.status === MediaStatus.BLOCKLISTED ||
              (itemMediaType === MediaType.MOVIE &&
                m.status !== MediaStatus.UNKNOWN &&
                m.status !== MediaStatus.DELETED) ||
              (itemMediaType === MediaType.TV &&
                m.status === MediaStatus.AVAILABLE))
        )
      );
    });

    for (const mediaItem of unavailableItems) {
      try {
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

        logger.info("Created media request from user's Plex Watchlist", {
          label: 'Watchlist Sync',
          userId: user.id,
          mediaTitle: mediaItem.title,
        });
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
          // Blocklisted media should be silently ignored during watchlist sync to avoid spam
          case BlocklistedMediaError:
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
