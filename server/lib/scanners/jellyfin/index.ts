import type { JellyfinLibraryItem } from '@server/api/jellyfin';
import JellyfinAPI from '@server/api/jellyfin';
import { getMetadataProvider } from '@server/api/metadata';
import TheMovieDb from '@server/api/themoviedb';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type {
  TmdbKeyword,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import { MediaStatus, MediaType } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import type { Library } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import AsyncLock from '@server/utils/asyncLock';
import { getHostname } from '@server/utils/getHostname';
import { randomUUID as uuid } from 'crypto';
import { uniqWith } from 'lodash';

const BUNDLE_SIZE = 20;
const UPDATE_RATE = 4 * 1000;

interface SyncStatus {
  running: boolean;
  progress: number;
  total: number;
  currentLibrary: Library;
  libraries: Library[];
}

class JellyfinScanner {
  private sessionId: string;
  private tmdb: TheMovieDb;
  private jfClient: JellyfinAPI;
  private items: JellyfinLibraryItem[] = [];
  private progress = 0;
  private libraries: Library[];
  private currentLibrary: Library;
  private running = false;
  private isRecentOnly = false;
  private enable4kMovie = false;
  private enable4kShow = false;
  private asyncLock = new AsyncLock();

  constructor({ isRecentOnly }: { isRecentOnly?: boolean } = {}) {
    this.tmdb = new TheMovieDb();

    this.isRecentOnly = isRecentOnly ?? false;
  }

  private async getExisting(tmdbId: number, mediaType: MediaType) {
    const mediaRepository = getRepository(Media);

    const existing = await mediaRepository.findOne({
      where: { tmdbId: tmdbId, mediaType },
    });

    return existing;
  }

  private async processMovie(jellyfinitem: JellyfinLibraryItem) {
    const mediaRepository = getRepository(Media);

    try {
      const metadata = await this.jfClient.getItemData(jellyfinitem.Id);
      const newMedia = new Media();

      if (!metadata?.Id) {
        logger.debug('No Id metadata for this title. Skipping', {
          label: 'Jellyfin Sync',
          jellyfinItemId: jellyfinitem.Id,
        });
        return;
      }

      newMedia.tmdbId = Number(metadata.ProviderIds.Tmdb ?? null);
      newMedia.imdbId = metadata.ProviderIds.Imdb;
      if (newMedia.imdbId && !isNaN(newMedia.tmdbId)) {
        const tmdbMovie = await this.tmdb.getMediaByImdbId({
          imdbId: newMedia.imdbId,
        });
        newMedia.tmdbId = tmdbMovie.id;
      }
      if (!newMedia.tmdbId) {
        throw new Error('Unable to find TMDb ID');
      }

      const has4k = metadata.MediaSources?.some((MediaSource) => {
        return MediaSource.MediaStreams.filter(
          (MediaStream) => MediaStream.Type === 'Video'
        ).some((MediaStream) => {
          return (MediaStream.Width ?? 0) > 2000;
        });
      });

      const hasOtherResolution = metadata.MediaSources?.some((MediaSource) => {
        return MediaSource.MediaStreams.filter(
          (MediaStream) => MediaStream.Type === 'Video'
        ).some((MediaStream) => {
          return (MediaStream.Width ?? 0) <= 2000;
        });
      });

      await this.asyncLock.dispatch(newMedia.tmdbId, async () => {
        const existing = await this.getExisting(
          newMedia.tmdbId,
          MediaType.MOVIE
        );

        if (existing) {
          let changedExisting = false;

          if (
            (hasOtherResolution || (!this.enable4kMovie && has4k)) &&
            existing.status !== MediaStatus.AVAILABLE
          ) {
            existing.status = MediaStatus.AVAILABLE;
            existing.mediaAddedAt = new Date(metadata.DateCreated ?? '');
            changedExisting = true;
          }

          if (
            has4k &&
            this.enable4kMovie &&
            existing.status4k !== MediaStatus.AVAILABLE
          ) {
            existing.status4k = MediaStatus.AVAILABLE;
            changedExisting = true;
          }

          if (!existing.mediaAddedAt && !changedExisting) {
            existing.mediaAddedAt = new Date(metadata.DateCreated ?? '');
            changedExisting = true;
          }

          if (
            (hasOtherResolution || (has4k && !this.enable4kMovie)) &&
            existing.jellyfinMediaId !== metadata.Id
          ) {
            existing.jellyfinMediaId = metadata.Id;
            changedExisting = true;
          }

          if (
            has4k &&
            this.enable4kMovie &&
            existing.jellyfinMediaId4k !== metadata.Id
          ) {
            existing.jellyfinMediaId4k = metadata.Id;
            changedExisting = true;
          }

          if (changedExisting) {
            await mediaRepository.save(existing);
            this.log(
              `Request for ${metadata.Name} exists. New media types set to AVAILABLE`,
              'info'
            );
          } else {
            this.log(
              `Title already exists and no new media types found ${metadata.Name}`
            );
          }
        } else {
          newMedia.status =
            hasOtherResolution || (!this.enable4kMovie && has4k)
              ? MediaStatus.AVAILABLE
              : MediaStatus.UNKNOWN;
          newMedia.status4k =
            has4k && this.enable4kMovie
              ? MediaStatus.AVAILABLE
              : MediaStatus.UNKNOWN;
          newMedia.mediaType = MediaType.MOVIE;
          newMedia.mediaAddedAt = new Date(metadata.DateCreated ?? '');
          newMedia.jellyfinMediaId =
            hasOtherResolution || (!this.enable4kMovie && has4k)
              ? metadata.Id
              : null;
          newMedia.jellyfinMediaId4k =
            has4k && this.enable4kMovie ? metadata.Id : null;
          await mediaRepository.save(newMedia);
          this.log(`Saved ${metadata.Name}`);
        }
      });
    } catch (e) {
      this.log(
        `Failed to process Jellyfin item, id: ${jellyfinitem.Id}`,
        'error',
        {
          errorMessage: e.message,
          jellyfinitem,
        }
      );
    }
  }

  private async getTvShow({
    tmdbId,
    tvdbId,
  }: {
    tmdbId?: number;
    tvdbId?: number;
  }): Promise<TmdbTvDetails> {
    let tvShow;

    if (tmdbId) {
      tvShow = await this.tmdb.getTvShow({
        tvId: Number(tmdbId),
      });
    } else if (tvdbId) {
      tvShow = await this.tmdb.getShowByTvdbId({
        tvdbId: Number(tvdbId),
      });
    } else {
      throw new Error('No ID provided');
    }

    const metadataProvider = tvShow.keywords.results.some(
      (keyword: TmdbKeyword) => keyword.id === ANIME_KEYWORD_ID
    )
      ? await getMetadataProvider('anime')
      : await getMetadataProvider('tv');

    if (!(metadataProvider instanceof TheMovieDb)) {
      tvShow = await metadataProvider.getTvShow({
        tvId: Number(tmdbId),
      });
    }

    return tvShow;
  }

  private async processShow(jellyfinitem: JellyfinLibraryItem) {
    const mediaRepository = getRepository(Media);

    let tvShow: TmdbTvDetails | null = null;

    try {
      const Id =
        jellyfinitem.SeriesId ?? jellyfinitem.SeasonId ?? jellyfinitem.Id;
      const metadata = await this.jfClient.getItemData(Id);

      if (!metadata?.Id) {
        logger.debug('No Id metadata for this title. Skipping', {
          label: 'Jellyfin Sync',
          jellyfinItemId: jellyfinitem.Id,
        });
        return;
      }

      if (metadata.ProviderIds.Tmdb) {
        try {
          tvShow = await this.getTvShow({
            tmdbId: Number(metadata.ProviderIds.Tmdb),
          });
        } catch {
          this.log('Unable to find TMDb ID for this title.', 'debug', {
            jellyfinitem,
          });
        }
      }
      if (!tvShow && metadata.ProviderIds.Tvdb) {
        try {
          tvShow = await this.getTvShow({
            tvdbId: Number(metadata.ProviderIds.Tvdb),
          });
        } catch {
          this.log('Unable to find TVDb ID for this title.', 'debug', {
            jellyfinitem,
          });
        }
      }

      if (tvShow) {
        await this.asyncLock.dispatch(tvShow.id, async () => {
          if (!tvShow) {
            // this will never execute, but typescript thinks somebody could reset tvShow from
            // outer scope back to null before this async gets called
            return;
          }

          // Lets get the available seasons from Jellyfin
          const seasons = tvShow.seasons;
          const media = await this.getExisting(tvShow.id, MediaType.TV);

          const newSeasons: Season[] = [];

          const currentStandardSeasonAvailable = (
            media?.seasons.filter(
              (season) => season.status === MediaStatus.AVAILABLE
            ) ?? []
          ).length;
          const current4kSeasonAvailable = (
            media?.seasons.filter(
              (season) => season.status4k === MediaStatus.AVAILABLE
            ) ?? []
          ).length;

          for (const season of seasons) {
            const JellyfinSeasons = await this.jfClient.getSeasons(Id);
            const matchedJellyfinSeason = JellyfinSeasons.find(
              (md) => Number(md.IndexNumber) === season.season_number
            );

            const existingSeason = media?.seasons.find(
              (es) => es.seasonNumber === season.season_number
            );

            // Check if we found the matching season and it has all the available episodes
            if (matchedJellyfinSeason) {
              // If we have a matched Jellyfin season, get its children metadata so we can check details
              const episodes = await this.jfClient.getEpisodes(
                Id,
                matchedJellyfinSeason.Id
              );

              //Get count of episodes that are HD and 4K
              let totalStandard = 0;
              let total4k = 0;

              //use for loop to make sure this loop _completes_ in full
              //before the next section
              for (const episode of episodes) {
                let episodeCount = 1;

                // count number of combined episodes
                if (
                  episode.IndexNumber !== undefined &&
                  episode.IndexNumberEnd !== undefined
                ) {
                  episodeCount =
                    episode.IndexNumberEnd - episode.IndexNumber + 1;
                }

                if (!this.enable4kShow) {
                  totalStandard += episodeCount;
                } else {
                  const ExtendedEpisodeData = await this.jfClient.getItemData(
                    episode.Id
                  );

                  ExtendedEpisodeData?.MediaSources?.some((MediaSource) => {
                    return MediaSource.MediaStreams.some((MediaStream) => {
                      if (MediaStream.Type === 'Video') {
                        if ((MediaStream.Width ?? 0) >= 2000) {
                          total4k += episodeCount;
                        } else {
                          totalStandard += episodeCount;
                        }
                      }
                    });
                  });
                }
              }

              if (
                media &&
                (totalStandard > 0 || (total4k > 0 && !this.enable4kShow)) &&
                media.jellyfinMediaId !== Id
              ) {
                media.jellyfinMediaId = Id;
              }

              if (
                media &&
                total4k > 0 &&
                this.enable4kShow &&
                media.jellyfinMediaId4k !== Id
              ) {
                media.jellyfinMediaId4k = Id;
              }

              if (existingSeason) {
                // These ternary statements look super confusing, but they are simply
                // setting the status to AVAILABLE if all of a type is there, partially if some,
                // and then not modifying the status if there are 0 items
                existingSeason.status =
                  totalStandard >= season.episode_count ||
                  existingSeason.status === MediaStatus.AVAILABLE
                    ? MediaStatus.AVAILABLE
                    : totalStandard > 0
                    ? MediaStatus.PARTIALLY_AVAILABLE
                    : existingSeason.status;
                existingSeason.status4k =
                  (this.enable4kShow && total4k >= season.episode_count) ||
                  existingSeason.status4k === MediaStatus.AVAILABLE
                    ? MediaStatus.AVAILABLE
                    : this.enable4kShow && total4k > 0
                    ? MediaStatus.PARTIALLY_AVAILABLE
                    : existingSeason.status4k;
              } else {
                newSeasons.push(
                  new Season({
                    seasonNumber: season.season_number,
                    // This ternary is the same as the ones above, but it just falls back to "UNKNOWN"
                    // if we dont have any items for the season
                    status:
                      totalStandard >= season.episode_count
                        ? MediaStatus.AVAILABLE
                        : totalStandard > 0
                        ? MediaStatus.PARTIALLY_AVAILABLE
                        : MediaStatus.UNKNOWN,
                    status4k:
                      this.enable4kShow && total4k >= season.episode_count
                        ? MediaStatus.AVAILABLE
                        : this.enable4kShow && total4k > 0
                        ? MediaStatus.PARTIALLY_AVAILABLE
                        : MediaStatus.UNKNOWN,
                  })
                );
              }
            }
          }

          // Remove extras season. We dont count it for determining availability
          const filteredSeasons = tvShow.seasons.filter(
            (season) => season.season_number !== 0
          );

          const isAllStandardSeasons =
            newSeasons.filter(
              (season) => season.status === MediaStatus.AVAILABLE
            ).length +
              (media?.seasons.filter(
                (season) => season.status === MediaStatus.AVAILABLE
              ).length ?? 0) >=
            filteredSeasons.length;

          const isAll4kSeasons =
            newSeasons.filter(
              (season) => season.status4k === MediaStatus.AVAILABLE
            ).length +
              (media?.seasons.filter(
                (season) => season.status4k === MediaStatus.AVAILABLE
              ).length ?? 0) >=
            filteredSeasons.length;

          if (media) {
            // Update existing
            media.seasons = [...media.seasons, ...newSeasons];

            const newStandardSeasonAvailable = (
              media.seasons.filter(
                (season) => season.status === MediaStatus.AVAILABLE
              ) ?? []
            ).length;

            const new4kSeasonAvailable = (
              media.seasons.filter(
                (season) => season.status4k === MediaStatus.AVAILABLE
              ) ?? []
            ).length;

            // If at least one new season has become available, update
            // the lastSeasonChange field so we can trigger notifications
            if (newStandardSeasonAvailable > currentStandardSeasonAvailable) {
              this.log(
                `Detected ${
                  newStandardSeasonAvailable - currentStandardSeasonAvailable
                } new standard season(s) for ${tvShow.name}`,
                'debug'
              );
              media.lastSeasonChange = new Date();
              media.mediaAddedAt = new Date(metadata.DateCreated ?? '');
            }

            if (new4kSeasonAvailable > current4kSeasonAvailable) {
              this.log(
                `Detected ${
                  new4kSeasonAvailable - current4kSeasonAvailable
                } new 4K season(s) for ${tvShow.name}`,
                'debug'
              );
              media.lastSeasonChange = new Date();
            }

            if (!media.mediaAddedAt) {
              media.mediaAddedAt = new Date(metadata.DateCreated ?? '');
            }

            // If the show is already available, and there are no new seasons, dont adjust
            // the status
            const shouldStayAvailable =
              media.status === MediaStatus.AVAILABLE &&
              newSeasons.filter(
                (season) => season.status !== MediaStatus.UNKNOWN
              ).length === 0;
            const shouldStayAvailable4k =
              media.status4k === MediaStatus.AVAILABLE &&
              newSeasons.filter(
                (season) => season.status4k !== MediaStatus.UNKNOWN
              ).length === 0;

            media.status =
              isAllStandardSeasons || shouldStayAvailable
                ? MediaStatus.AVAILABLE
                : media.seasons.some(
                    (season) => season.status !== MediaStatus.UNKNOWN
                  )
                ? MediaStatus.PARTIALLY_AVAILABLE
                : MediaStatus.UNKNOWN;
            media.status4k =
              (isAll4kSeasons || shouldStayAvailable4k) && this.enable4kShow
                ? MediaStatus.AVAILABLE
                : this.enable4kShow &&
                  media.seasons.some(
                    (season) => season.status4k !== MediaStatus.UNKNOWN
                  )
                ? MediaStatus.PARTIALLY_AVAILABLE
                : MediaStatus.UNKNOWN;
            await mediaRepository.save(media);
            this.log(`Updating existing title: ${tvShow.name}`);
          } else {
            const newMedia = new Media({
              mediaType: MediaType.TV,
              seasons: newSeasons,
              tmdbId: tvShow.id,
              tvdbId: tvShow.external_ids.tvdb_id,
              mediaAddedAt: new Date(metadata.DateCreated ?? ''),
              jellyfinMediaId: isAllStandardSeasons ? Id : null,
              jellyfinMediaId4k:
                isAll4kSeasons && this.enable4kShow ? Id : null,
              status: isAllStandardSeasons
                ? MediaStatus.AVAILABLE
                : newSeasons.some(
                    (season) => season.status !== MediaStatus.UNKNOWN
                  )
                ? MediaStatus.PARTIALLY_AVAILABLE
                : MediaStatus.UNKNOWN,
              status4k:
                isAll4kSeasons && this.enable4kShow
                  ? MediaStatus.AVAILABLE
                  : this.enable4kShow &&
                    newSeasons.some(
                      (season) => season.status4k !== MediaStatus.UNKNOWN
                    )
                  ? MediaStatus.PARTIALLY_AVAILABLE
                  : MediaStatus.UNKNOWN,
            });
            await mediaRepository.save(newMedia);
            this.log(`Saved ${tvShow.name}`);
          }
        });
      } else {
        this.log(
          `No information found for the show: ${metadata.Name}`,
          'debug',
          {
            jellyfinitem,
          }
        );
      }
    } catch (e) {
      this.log(
        `Failed to process Jellyfin item. Id: ${
          jellyfinitem.SeriesId ?? jellyfinitem.SeasonId ?? jellyfinitem.Id
        }`,
        'error',
        {
          errorMessage: e.message,
          jellyfinitem,
        }
      );
    }
  }

  private async processItems(slicedItems: JellyfinLibraryItem[]) {
    await Promise.all(
      slicedItems.map(async (item) => {
        if (item.Type === 'Movie') {
          await this.processMovie(item);
        } else if (item.Type === 'Series') {
          await this.processShow(item);
        }
      })
    );
  }

  private async loop({
    start = 0,
    end = BUNDLE_SIZE,
    sessionId,
  }: {
    start?: number;
    end?: number;
    sessionId?: string;
  } = {}) {
    const slicedItems = this.items.slice(start, end);

    if (!this.running) {
      throw new Error('Sync was aborted.');
    }

    if (this.sessionId !== sessionId) {
      throw new Error('New session was started. Old session aborted.');
    }

    if (start < this.items.length) {
      this.progress = start;
      await this.processItems(slicedItems);

      await new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          this.loop({
            start: start + BUNDLE_SIZE,
            end: end + BUNDLE_SIZE,
            sessionId,
          })
            .then(() => resolve())
            .catch((e) => reject(new Error(e.message)));
        }, UPDATE_RATE)
      );
    }
  }

  private log(
    message: string,
    level: 'info' | 'error' | 'debug' | 'warn' = 'debug',
    optional?: Record<string, unknown>
  ): void {
    logger[level](message, { label: 'Jellyfin Sync', ...optional });
  }

  public async run(): Promise<void> {
    const settings = getSettings();

    if (
      settings.main.mediaServerType != MediaServerType.JELLYFIN &&
      settings.main.mediaServerType != MediaServerType.EMBY
    ) {
      return;
    }

    const sessionId = uuid();
    this.sessionId = sessionId;
    logger.info('Jellyfin Sync Starting', {
      sessionId,
      label: 'Jellyfin Sync',
    });
    try {
      this.running = true;
      const userRepository = getRepository(User);
      const admin = await userRepository.findOne({
        where: { id: 1 },
        select: ['id', 'jellyfinUserId', 'jellyfinDeviceId'],
        order: { id: 'ASC' },
      });

      if (!admin) {
        return this.log('No admin configured. Jellyfin sync skipped.', 'warn');
      }

      this.jfClient = new JellyfinAPI(
        getHostname(),
        settings.jellyfin.apiKey,
        admin.jellyfinDeviceId
      );

      this.jfClient.setUserId(admin.jellyfinUserId ?? '');

      this.libraries = settings.jellyfin.libraries.filter(
        (library) => library.enabled
      );

      this.enable4kMovie = settings.radarr.some((radarr) => radarr.is4k);
      if (this.enable4kMovie) {
        this.log(
          'At least one 4K Radarr server was detected. 4K movie detection is now enabled',
          'info'
        );
      }

      this.enable4kShow = settings.sonarr.some((sonarr) => sonarr.is4k);
      if (this.enable4kShow) {
        this.log(
          'At least one 4K Sonarr server was detected. 4K series detection is now enabled',
          'info'
        );
      }

      if (this.isRecentOnly) {
        for (const library of this.libraries) {
          this.currentLibrary = library;
          this.log(
            `Beginning to process recently added for library: ${library.name}`,
            'info'
          );
          const libraryItems = await this.jfClient.getRecentlyAdded(library.id);

          // Bundle items up by rating keys
          this.items = uniqWith(libraryItems, (mediaA, mediaB) => {
            if (mediaA.SeriesId && mediaB.SeriesId) {
              return mediaA.SeriesId === mediaB.SeriesId;
            }

            if (mediaA.SeasonId && mediaB.SeasonId) {
              return mediaA.SeasonId === mediaB.SeasonId;
            }

            return mediaA.Id === mediaB.Id;
          });

          await this.loop({ sessionId });
        }
      } else {
        for (const library of this.libraries) {
          this.currentLibrary = library;
          this.log(`Beginning to process library: ${library.name}`, 'info');
          this.items = await this.jfClient.getLibraryContents(library.id);
          await this.loop({ sessionId });
        }
      }
      this.log(
        this.isRecentOnly
          ? 'Recently Added Scan Complete'
          : 'Full Scan Complete',
        'info'
      );
    } catch (e) {
      logger.error('Sync interrupted', {
        label: 'Jellyfin Sync',
        errorMessage: e.message,
      });
    } finally {
      // If a new scanning session hasnt started, set running back to false
      if (this.sessionId === sessionId) {
        this.running = false;
      }
    }
  }

  public status(): SyncStatus {
    return {
      running: this.running,
      progress: this.progress,
      total: this.items.length,
      currentLibrary: this.currentLibrary,
      libraries: this.libraries,
    };
  }

  public cancel(): void {
    this.running = false;
  }
}

export const jellyfinFullScanner = new JellyfinScanner();
export const jellyfinRecentScanner = new JellyfinScanner({
  isRecentOnly: true,
});
