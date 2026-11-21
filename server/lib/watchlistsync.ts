import type { PlexWatchlistItem } from '@server/api/plextv';
import PlexTvAPI from '@server/api/plextv';
import TheMovieDb from '@server/api/themoviedb';
import { MediaStatus, MediaType } from '@server/constants/media';
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
import { WatchlistSyncEntry } from '@server/entity/WatchlistSyncEntry';
import { WatchlistSyncEntrySeason } from '@server/entity/WatchlistSyncEntrySeason';
import logger from '@server/logger';
import { In } from 'typeorm';
import { Permission } from './permissions';

const CLOCK_SKEW_SECONDS = 300;

class WatchlistSync {
  public running = false;

  public async syncWatchlist() {
    if (this.running) {
      logger.warn('Watchlist sync is already running, skipping this run', {
        label: 'Watchlist Sync',
      });
      return;
    }

    this.running = true;

    try {
      const userRepository = getRepository(User);

      // Get users who actually have plex tokens
      const users = await userRepository
        .createQueryBuilder('user')
        .addSelect('user.plexToken')
        .leftJoinAndSelect('user.settings', 'settings')
        .where("user.plexToken != ''")
        .getMany();

      for (const user of users) {
        try {
          await this.syncUserWatchlist(user);
        } catch (e) {
          logger.error('Failed to sync watchlist for user', {
            label: 'Watchlist Sync',
            userId: user.id,
            errorMessage: e instanceof Error ? e.message : String(e),
          });
        }
      }
    } finally {
      this.running = false;
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

    const plexTvApi = new PlexTvAPI(user.plexToken);

    const response = await plexTvApi.getWatchlist({ size: 20 });

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
            .leftJoinAndSelect('request.seasons', 'seasons')
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

    if (!unavailableItems.length) {
      return;
    }

    const entries = await getRepository(WatchlistSyncEntry).find({
      where: {
        requestedBy: { id: user.id },
        tmdbId: In(unavailableItems.map((i) => i.tmdbId)),
      },
    });

    const entriesByKey = new Map(
      entries.map((e) => [`${e.mediaType}:${e.tmdbId}`, e])
    );

    const autoRequestsByKey = new Map<string, MediaRequest[]>();
    for (const request of existingAutoRequests) {
      if (!request.media) {
        continue;
      }

      const key = `${request.media.mediaType}:${request.media.tmdbId}`;
      autoRequestsByKey.set(key, [
        ...(autoRequestsByKey.get(key) ?? []),
        request,
      ]);
    }

    const tmdb = new TheMovieDb();

    for (const mediaItem of unavailableItems) {
      const mediaType =
        mediaItem.type === 'show' ? MediaType.TV : MediaType.MOVIE;
      const key = `${mediaType}:${mediaItem.tmdbId}`;

      let entryStamp: number | null = null;
      let handledSeasons: number[] = [];
      let candidateSeasons: number[] = [];

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

        const watchlistedAt = await plexTvApi.getWatchlistedAt(
          mediaItem.ratingKey
        );

        if (!watchlistedAt) {
          logger.warn('Skipping watchlist item without a watchlisted date', {
            label: 'Watchlist Sync',
            userId: user.id,
            mediaTitle: mediaItem.title,
          });
          continue;
        }

        entryStamp = watchlistedAt;

        const entry = entriesByKey.get(key);
        const rearmed = !!entry && entry.watchlistedAt !== watchlistedAt;
        let handledPreviously = false;

        if (entry && rearmed) {
          logger.info('Watchlist entry re-added, requesting again', {
            label: 'Watchlist Sync',
            userId: user.id,
            mediaTitle: mediaItem.title,
            previousWatchlistedAt: entry.watchlistedAt,
            watchlistedAt,
          });
        }

        if (entry && !rearmed) {
          handledSeasons = entry.seasons.map((s) => s.seasonNumber);
        } else if (!entry) {
          // An auto-request made after the watchlist add means sync already acted on this entry.
          const priorRequests = (autoRequestsByKey.get(key) ?? []).filter(
            (r) =>
              Math.floor(r.createdAt.getTime() / 1000) >=
              watchlistedAt - CLOCK_SKEW_SECONDS
          );

          handledPreviously = priorRequests.length > 0;
          handledSeasons = this.mergeSeasons(
            priorRequests.flatMap((r) =>
              (r.seasons ?? []).map((s) => s.seasonNumber)
            )
          );
        }

        if (mediaType === MediaType.MOVIE) {
          if (entry && !rearmed) {
            continue;
          }

          if (handledPreviously) {
            await this.saveEntry(user, mediaItem, mediaType, watchlistedAt, []);
            continue;
          }

          await MediaRequest.request(
            {
              mediaId: mediaItem.tmdbId,
              mediaType,
              tvdbId: mediaItem.tvdbId,
              is4k: false,
            },
            user,
            { isAutoRequest: true }
          );

          await this.saveEntry(user, mediaItem, mediaType, watchlistedAt, []);

          logger.info("Created media request from user's Plex Watchlist", {
            label: 'Watchlist Sync',
            userId: user.id,
            mediaTitle: mediaItem.title,
          });

          continue;
        }

        // Mirrors how 'all' expands in MediaRequest.request, which always drops season 0.
        const tmdbShow = await tmdb.getTvShow({ tvId: mediaItem.tmdbId });
        candidateSeasons = tmdbShow.seasons
          .filter((season) => season.season_number !== 0)
          .map((season) => season.season_number);

        const requestedSeasons = candidateSeasons.filter(
          (season) => !handledSeasons.includes(season)
        );

        if (!requestedSeasons.length) {
          if (!entry || rearmed || handledPreviously) {
            await this.saveEntry(
              user,
              mediaItem,
              mediaType,
              watchlistedAt,
              this.mergeSeasons(handledSeasons, candidateSeasons)
            );
          }
          continue;
        }

        await MediaRequest.request(
          {
            mediaId: mediaItem.tmdbId,
            mediaType,
            seasons: requestedSeasons,
            tvdbId: mediaItem.tvdbId,
            is4k: false,
          },
          user,
          { isAutoRequest: true }
        );

        await this.saveEntry(
          user,
          mediaItem,
          mediaType,
          watchlistedAt,
          this.mergeSeasons(handledSeasons, candidateSeasons)
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
          // Nothing new was requested but the entry has still been acted on, so record it.
          case DuplicateMediaRequestError:
          case NoSeasonsAvailableError:
            if (entryStamp) {
              await this.saveEntry(
                user,
                mediaItem,
                mediaType,
                entryStamp,
                mediaType === MediaType.TV
                  ? this.mergeSeasons(handledSeasons, candidateSeasons)
                  : []
              );
            }

            logger.debug('Failed to create media request from watchlist', {
              label: 'Watchlist Sync',
              userId: user.id,
              mediaTitle: mediaItem.title,
              errorMessage: e.message,
            });
            break;
          // Leave the entry untracked so a later sync can retry
          case RequestPermissionError:
          case QuotaRestrictedError:
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

  private mergeSeasons(...seasons: number[][]): number[] {
    return [...new Set(seasons.flat())];
  }

  private async saveEntry(
    user: User,
    mediaItem: PlexWatchlistItem,
    mediaType: MediaType,
    watchlistedAt: number,
    seasons: number[]
  ): Promise<void> {
    const entryRepository = getRepository(WatchlistSyncEntry);

    try {
      const entry =
        (await entryRepository.findOne({
          where: {
            requestedBy: { id: user.id },
            tmdbId: mediaItem.tmdbId,
            mediaType,
          },
        })) ??
        new WatchlistSyncEntry({
          requestedBy: user,
          tmdbId: mediaItem.tmdbId,
          mediaType,
        });

      // Reuse the persisted rows so re-saving an entry does not collide with
      // the unique constraint on its seasons.
      const existingSeasons = entry.seasons ?? [];

      entry.watchlistedAt = watchlistedAt;
      entry.seasons = seasons.map(
        (seasonNumber) =>
          existingSeasons.find((s) => s.seasonNumber === seasonNumber) ??
          new WatchlistSyncEntrySeason({ seasonNumber })
      );

      await entryRepository.save(entry);
    } catch (e) {
      // A concurrent run may have written the same entry first
      logger.warn('Failed to record watchlist entry', {
        label: 'Watchlist Sync',
        userId: user.id,
        mediaTitle: mediaItem.title,
        errorMessage: e.message,
      });
    }
  }
}

const watchlistSync = new WatchlistSync();

export default watchlistSync;
