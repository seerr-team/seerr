import type { JellyfinLibraryItem } from '@server/api/jellyfin';
import JellyfinAPI from '@server/api/jellyfin';
import type { PlexMetadata } from '@server/api/plexapi';
import PlexAPI from '@server/api/plexapi';
import RadarrAPI, { type RadarrMovie } from '@server/api/servarr/radarr';
import type { SonarrSeason, SonarrSeries } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type {
  TmdbTvDetails,
  TmdbTvScanDetails,
} from '@server/api/themoviedb/interfaces';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Episode from '@server/entity/Episode';
import Media from '@server/entity/Media';
import MediaRequest from '@server/entity/MediaRequest';
import type Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import { MetadataProviderType, getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { getHostname } from '@server/utils/getHostname';
import { In } from 'typeorm';

type CachedSonarrEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  hasFile: boolean;
};

class AvailabilitySync {
  public running = false;
  private plexClient: PlexAPI;
  private plexSeasonsCache: Record<string, PlexMetadata[]>;
  private plexEpisodeExistsCache: Record<string, boolean>;

  private jellyfinClient: JellyfinAPI;
  private jellyfinSeasonsCache: Record<string, JellyfinLibraryItem[]>;
  private jellyfinEpisodeExistsCache: Record<string, boolean>;

  private sonarrSeasonsCache: Record<string, SonarrSeason[]>;
  private sonarrEpisodesCache: Record<string, CachedSonarrEpisode[]>;
  private episodePresenceBySeasonTier: Map<string, Map<number, boolean>>;
  private radarrServers: RadarrSettings[];
  private sonarrServers: SonarrSettings[];
  private enable4kMovie: boolean;
  private enable4kShow: boolean;

  readonly tmdb = new TheMovieDb();

  async run() {
    const settings = getSettings();
    const mediaServerType = getSettings().main.mediaServerType;
    this.running = true;
    this.plexSeasonsCache = {};
    this.plexEpisodeExistsCache = {};
    this.jellyfinSeasonsCache = {};
    this.jellyfinEpisodeExistsCache = {};
    this.sonarrSeasonsCache = {};
    this.sonarrEpisodesCache = {};
    this.episodePresenceBySeasonTier = new Map();
    this.radarrServers = settings.radarr;
    this.sonarrServers = settings.sonarr;
    this.enable4kMovie = this.radarrServers.some((server) => server.is4k);
    this.enable4kShow = this.sonarrServers.some((server) => server.is4k);
    const episodeTrackingEnabled = settings.main.enableEpisodeAvailability;

    try {
      logger.info(`Starting availability sync...`, {
        label: 'AvailabilitySync',
      });
      const pageSize = 50;

      const userRepository = getRepository(User);

      // If it is plex admin is selected using plexToken if jellyfin admin is selected using jellyfinUserID

      let admin = null;

      if (mediaServerType === MediaServerType.PLEX) {
        admin = await userRepository.findOne({
          select: { id: true, plexToken: true },
          where: { id: 1 },
        });
      } else if (
        mediaServerType === MediaServerType.JELLYFIN ||
        mediaServerType === MediaServerType.EMBY
      ) {
        admin = await userRepository.findOne({
          where: { id: 1 },
          select: ['id', 'jellyfinUserId', 'jellyfinDeviceId'],
          order: { id: 'ASC' },
        });
      }

      switch (mediaServerType) {
        case MediaServerType.PLEX:
          if (admin && admin.plexToken) {
            this.plexClient = new PlexAPI({ plexToken: admin.plexToken });
          } else {
            logger.error('Plex admin is not configured.');
          }
          break;
        case MediaServerType.JELLYFIN:
        case MediaServerType.EMBY:
          if (admin) {
            this.jellyfinClient = new JellyfinAPI(
              getHostname(),
              settings.jellyfin.apiKey,
              admin.jellyfinDeviceId
            );

            this.jellyfinClient.setUserId(admin.jellyfinUserId ?? '');

            try {
              await this.jellyfinClient.getSystemInfo();
            } catch (e) {
              logger.error('Sync interrupted.', {
                label: 'AvailabilitySync',
                status: e.statusCode,
                error: e.name,
                errorMessage: e.errorCode,
              });

              this.running = false;
              return;
            }
          } else {
            logger.error('Jellyfin admin is not configured.');

            this.running = false;
            return;
          }
          break;
        default:
          logger.error('An admin is not configured.');

          this.running = false;
          return;
      }

      for await (const media of this.loadAvailableMediaPaginated(pageSize)) {
        if (!this.running) {
          throw new Error('Job aborted');
        }

        // Check plex, radarr, and sonarr for that specific media and
        // if unavailable, then we change the status accordingly.
        // If a non-4k or 4k version exists in at least one of the instances, we will only update that specific version
        if (media.mediaType === 'movie') {
          let movieExists = false;
          let movieExists4k = false;

          // if (mediaServerType === MediaServerType.PLEX) {
          //   await this.mediaExistsInPlex(media, false);
          // } else if (
          //   mediaServerType === MediaServerType.JELLYFIN ||
          //   mediaServerType === MediaServerType.EMBY
          // ) {
          //   await this.mediaExistsInJellyfin(media, false);
          // }

          const existsInRadarr = await this.mediaExistsInRadarr(media, false);
          const existsInRadarr4k = await this.mediaExistsInRadarr(media, true);

          // plex
          if (mediaServerType === MediaServerType.PLEX) {
            const { existsInPlex } = await this.mediaExistsInPlex(media, false);
            const { existsInPlex: existsInPlex4k } =
              await this.mediaExistsInPlex(media, true);

            if (existsInPlex || existsInRadarr) {
              movieExists = true;
              logger.debug(
                `The non-4K movie [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                {
                  label: 'AvailabilitySync',
                }
              );
            }

            if (existsInPlex4k || existsInRadarr4k) {
              movieExists4k = true;
              logger.debug(
                `The 4K movie [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                {
                  label: 'AvailabilitySync',
                }
              );
            }
          }

          //jellyfin
          if (
            mediaServerType === MediaServerType.JELLYFIN ||
            mediaServerType === MediaServerType.EMBY
          ) {
            const { existsInJellyfin } = await this.mediaExistsInJellyfin(
              media,
              false
            );
            const { existsInJellyfin: existsInJellyfin4k } =
              await this.mediaExistsInJellyfin(media, true);

            if (existsInJellyfin || existsInRadarr) {
              movieExists = true;
              logger.debug(
                `The non-4K movie [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                {
                  label: 'AvailabilitySync',
                }
              );
            }

            if (existsInJellyfin4k || existsInRadarr4k) {
              movieExists4k = true;
              logger.debug(
                `The 4K movie [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                {
                  label: 'AvailabilitySync',
                }
              );
            }
          }

          if (!movieExists && media.status === MediaStatus.AVAILABLE) {
            await this.mediaUpdater(media, false, mediaServerType);
          }

          if (!movieExists4k && media.status4k === MediaStatus.AVAILABLE) {
            await this.mediaUpdater(media, true, mediaServerType);
          }
        }

        // If both versions still exist in plex, we still need
        // to check through sonarr to verify season availability
        if (media.mediaType === 'tv') {
          let showExists = false;
          let showExists4k = false;

          // Fetch TMDB details once for season enrichment
          let tvShow: TmdbTvScanDetails | TmdbTvDetails | undefined;
          try {
            if (media.tmdbId) {
              tvShow = await this.tmdb.getTvShowForScan({
                tvId: Number(media.tmdbId),
              });
            } else if (media.tvdbId) {
              tvShow = await this.tmdb.getShowByTvdbIdForScan({
                tvdbId: Number(media.tvdbId),
              });
            }
          } catch (e) {
            logger.debug(
              `Failed to fetch TMDB data for show [TMDB ID ${media.tmdbId}]. Skipping season enrichment.`,
              { label: 'AvailabilitySync', errorMessage: e.message }
            );
          }

          //plex

          const isAnime = !!tvShow?.keywords.results.some(
            (keyword) => keyword.id === ANIME_KEYWORD_ID
          );
          const shouldTrackEpisodes =
            episodeTrackingEnabled &&
            (isAnime
              ? settings.metadataSettings.anime === MetadataProviderType.TVDB
              : settings.metadataSettings.tv === MetadataProviderType.TVDB);

          this.episodePresenceBySeasonTier.clear();

          const { existsInPlex, seasonsMap: plexSeasonsMap = new Map() } =
            await this.mediaExistsInPlex(media, false, episodeTrackingEnabled);
          const {
            existsInPlex: existsInPlex4k,
            seasonsMap: plexSeasonsMap4k = new Map(),
          } = await this.mediaExistsInPlex(media, true, episodeTrackingEnabled);

          //jellyfin
          const {
            existsInJellyfin,
            seasonsMap: jellyfinSeasonsMap = new Map(),
          } = await this.mediaExistsInJellyfin(
            media,
            false,
            episodeTrackingEnabled
          );
          const {
            existsInJellyfin: existsInJellyfin4k,
            seasonsMap: jellyfinSeasonsMap4k = new Map(),
          } = await this.mediaExistsInJellyfin(
            media,
            true,
            episodeTrackingEnabled
          );

          const { existsInSonarr, seasonsMap: sonarrSeasonsMap } =
            await this.mediaExistsInSonarr(media, false, shouldTrackEpisodes);
          const {
            existsInSonarr: existsInSonarr4k,
            seasonsMap: sonarrSeasonsMap4k,
          } = await this.mediaExistsInSonarr(media, true, shouldTrackEpisodes);

          if (episodeTrackingEnabled || shouldTrackEpisodes) {
            await this.applyEpisodeDemotions(media);
          }

          //plex
          if (mediaServerType === MediaServerType.PLEX) {
            if (existsInPlex || existsInSonarr) {
              showExists = true;
              logger.debug(
                `The non-4K show [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                {
                  label: 'AvailabilitySync',
                }
              );
            }
          }

          if (mediaServerType === MediaServerType.PLEX) {
            if (existsInPlex4k || existsInSonarr4k) {
              showExists4k = true;
              logger.debug(
                `The 4K show [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                {
                  label: 'AvailabilitySync',
                }
              );
            }
          }

          //jellyfin
          if (
            mediaServerType === MediaServerType.JELLYFIN ||
            mediaServerType === MediaServerType.EMBY
          ) {
            if (existsInJellyfin || existsInSonarr) {
              showExists = true;
              logger.debug(
                `The non-4K show [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                {
                  label: 'AvailabilitySync',
                }
              );
            }
          }

          if (
            mediaServerType === MediaServerType.JELLYFIN ||
            mediaServerType === MediaServerType.EMBY
          ) {
            if (existsInJellyfin4k || existsInSonarr4k) {
              showExists4k = true;
              logger.debug(
                `The 4K show [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                {
                  label: 'AvailabilitySync',
                }
              );
            }
          }

          // Here we will create a final map that will cross compare
          // with plex and sonarr. Filtered seasons will go through
          // each season and assume the season does not exist. If Plex or
          // Sonarr finds that season, we will change the final seasons value
          // to true.
          const filteredSeasonsMap: Map<number, boolean> = new Map();
          media.seasons
            .filter(
              (season) =>
                season.status === MediaStatus.AVAILABLE ||
                season.status === MediaStatus.PARTIALLY_AVAILABLE
            )
            .forEach((season) =>
              filteredSeasonsMap.set(season.seasonNumber, false)
            );

          const filteredSeasonsMap4k: Map<number, boolean> = new Map();
          media.seasons
            .filter(
              (season) =>
                season.status4k === MediaStatus.AVAILABLE ||
                season.status4k === MediaStatus.PARTIALLY_AVAILABLE
            )
            .forEach((season) =>
              filteredSeasonsMap4k.set(season.seasonNumber, false)
            );

          let finalSeasons: Map<number, boolean>;
          let finalSeasons4k: Map<number, boolean>;

          if (mediaServerType === MediaServerType.PLEX) {
            finalSeasons = new Map([
              ...filteredSeasonsMap,
              ...plexSeasonsMap,
              ...sonarrSeasonsMap,
            ]);
            finalSeasons4k = new Map([
              ...filteredSeasonsMap4k,
              ...plexSeasonsMap4k,
              ...sonarrSeasonsMap4k,
            ]);
          } else {
            // Jellyfin/Emby
            finalSeasons = new Map([
              ...filteredSeasonsMap,
              ...jellyfinSeasonsMap,
              ...sonarrSeasonsMap,
            ]);
            finalSeasons4k = new Map([
              ...filteredSeasonsMap4k,
              ...jellyfinSeasonsMap4k,
              ...sonarrSeasonsMap4k,
            ]);
          }
          if (tvShow) {
            // fill the finalSeasons and finalSeasons4k maps with false for missing seasons
            media.seasons.forEach((season) => {
              // Specials don't count towards availability (baseScanner skips them too)
              // TODO: doesn't respect enableSpecialEpisodes; needs a shared predicate with baseScanner.ts
              if (season.seasonNumber === 0) {
                return;
              }
              if (
                !finalSeasons.has(season.seasonNumber) &&
                tvShow.seasons.find(
                  (s) => s.season_number === season.seasonNumber
                )?.episode_count
              ) {
                finalSeasons.set(season.seasonNumber, false);
              }
              if (
                !finalSeasons4k.has(season.seasonNumber) &&
                tvShow.seasons.find(
                  (s) => s.season_number === season.seasonNumber
                )?.episode_count
              ) {
                finalSeasons4k.set(season.seasonNumber, false);
              }
            });
          }

          if (
            !showExists &&
            (media.status === MediaStatus.AVAILABLE ||
              media.status === MediaStatus.PARTIALLY_AVAILABLE ||
              media.seasons.some(
                (season) => season.status === MediaStatus.AVAILABLE
              ) ||
              media.seasons.some(
                (season) => season.status === MediaStatus.PARTIALLY_AVAILABLE
              ))
          ) {
            await this.mediaUpdater(media, false, mediaServerType);
          }

          if (
            !showExists4k &&
            (media.status4k === MediaStatus.AVAILABLE ||
              media.status4k === MediaStatus.PARTIALLY_AVAILABLE ||
              media.seasons.some(
                (season) => season.status4k === MediaStatus.AVAILABLE
              ) ||
              media.seasons.some(
                (season) => season.status4k === MediaStatus.PARTIALLY_AVAILABLE
              ))
          ) {
            await this.mediaUpdater(media, true, mediaServerType);
          }

          // TODO: Figure out how to run seasonUpdater for each season

          if ([...finalSeasons.values()].includes(false)) {
            await this.seasonUpdater(
              media,
              finalSeasons,
              false,
              mediaServerType
            );
          }

          if ([...finalSeasons4k.values()].includes(false)) {
            await this.seasonUpdater(
              media,
              finalSeasons4k,
              true,
              mediaServerType
            );
          }
        }
      }
    } catch (ex) {
      logger.error('Failed to complete availability sync.', {
        errorMessage: ex.message,
        label: 'AvailabilitySync',
      });
    } finally {
      logger.info(`Availability sync complete.`, {
        label: 'AvailabilitySync',
      });
      this.running = false;
    }
  }

  public cancel() {
    this.running = false;
  }

  private async *loadAvailableMediaPaginated(pageSize: number) {
    let offset = 0;
    const mediaRepository = getRepository(Media);
    const whereOptions = [
      { status: MediaStatus.AVAILABLE },
      { status: MediaStatus.PARTIALLY_AVAILABLE },
      { status4k: MediaStatus.AVAILABLE },
      { status4k: MediaStatus.PARTIALLY_AVAILABLE },
      { seasons: { status: MediaStatus.AVAILABLE } },
      { seasons: { status: MediaStatus.PARTIALLY_AVAILABLE } },
      { seasons: { status4k: MediaStatus.AVAILABLE } },
      { seasons: { status4k: MediaStatus.PARTIALLY_AVAILABLE } },
    ];

    let mediaPage: Media[];

    do {
      yield* (mediaPage = await mediaRepository.find({
        where: whereOptions,
        skip: offset,
        take: pageSize,
      }));
      offset += pageSize;
    } while (mediaPage.length > 0);
  }

  private async mediaUpdater(
    media: Media,
    is4k: boolean,
    mediaServerType: MediaServerType
  ): Promise<void> {
    const mediaRepository = getRepository(Media);

    try {
      // Check if an approved request for this version is still in flight
      // to see if we need to keep the external metadata
      let isMediaProcessing = false;

      const requestRepository = getRepository(MediaRequest);

      const request = await requestRepository
        .createQueryBuilder('request')
        .leftJoinAndSelect('request.media', 'media')
        .where('(media.id = :id)', {
          id: media.id,
        })
        .andWhere(
          '(request.is4k = :is4k AND request.status = :requestStatus)',
          {
            requestStatus: MediaRequestStatus.APPROVED,
            is4k: is4k,
          }
        )
        .getOne();

      if (request) {
        isMediaProcessing = true;
      }

      // Set the non-4K or 4K media to deleted
      // and change related columns to null if media
      // is not processing
      media[is4k ? 'status4k' : 'status'] = MediaStatus.DELETED;
      media[is4k ? 'serviceId4k' : 'serviceId'] = isMediaProcessing
        ? media[is4k ? 'serviceId4k' : 'serviceId']
        : null;
      media[is4k ? 'externalServiceId4k' : 'externalServiceId'] =
        isMediaProcessing
          ? media[is4k ? 'externalServiceId4k' : 'externalServiceId']
          : null;
      media[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'] =
        isMediaProcessing
          ? media[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug']
          : null;
      if (mediaServerType === MediaServerType.PLEX) {
        media[is4k ? 'ratingKey4k' : 'ratingKey'] = isMediaProcessing
          ? media[is4k ? 'ratingKey4k' : 'ratingKey']
          : null;
      } else if (
        mediaServerType === MediaServerType.JELLYFIN ||
        mediaServerType === MediaServerType.EMBY
      ) {
        media[is4k ? 'jellyfinMediaId4k' : 'jellyfinMediaId'] =
          isMediaProcessing
            ? media[is4k ? 'jellyfinMediaId4k' : 'jellyfinMediaId']
            : null;
      }
      logger.debug(
        `The ${is4k ? '4K' : 'non-4K'} ${
          media.mediaType === 'movie' ? 'movie' : 'show'
        } [TMDB ID ${media.tmdbId}] was not found in any ${
          media.mediaType === 'movie' ? 'Radarr' : 'Sonarr'
        } and ${
          mediaServerType === MediaServerType.PLEX
            ? 'plex'
            : mediaServerType === MediaServerType.JELLYFIN
              ? 'jellyfin'
              : 'emby'
        } instance. Status will be changed to deleted.`,
        { label: 'AvailabilitySync' }
      );

      await mediaRepository.save(media);
    } catch (ex) {
      logger.debug(
        `Failure updating the ${is4k ? '4K' : 'non-4K'} ${
          media.mediaType === 'tv' ? 'show' : 'movie'
        } [TMDB ID ${media.tmdbId}].`,
        {
          errorMessage: ex.message,
          label: 'AvailabilitySync',
        }
      );
    }
  }

  private async seasonUpdater(
    media: Media,
    seasons: Map<number, boolean>,
    is4k: boolean,
    mediaServerType: MediaServerType
  ): Promise<void> {
    const mediaRepository = getRepository(Media);

    // Filter out only the values that are false
    // (media that should be deleted)
    const seasonsPendingRemoval = new Map(
      // Disabled linter as only the value is needed from the filter
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      [...seasons].filter(([_, exists]) => !exists)
    );
    // Retrieve the season keys to pass into our log
    const seasonKeys = [...seasonsPendingRemoval.keys()];
    // Specials can still be marked DELETED below, but shouldn't demote the show
    const nonSpecialSeasonKeys = seasonKeys.filter((key) => key !== 0);

    try {
      const deletedSeasonIds: number[] = [];

      for (const mediaSeason of media.seasons) {
        if (
          seasonsPendingRemoval.has(mediaSeason.seasonNumber) &&
          (mediaSeason[is4k ? 'status4k' : 'status'] ===
            MediaStatus.AVAILABLE ||
            mediaSeason[is4k ? 'status4k' : 'status'] ===
              MediaStatus.PARTIALLY_AVAILABLE)
        ) {
          mediaSeason[is4k ? 'status4k' : 'status'] = MediaStatus.DELETED;
          deletedSeasonIds.push(mediaSeason.id);
        }
      }

      if (deletedSeasonIds.length > 0) {
        try {
          const existingEpisodes = await getRepository(Episode).find({
            where: { season: { id: In(deletedSeasonIds) } },
          });
          const toSave: Episode[] = [];

          for (const existingEpisode of existingEpisodes) {
            const currentStatus = existingEpisode[is4k ? 'status4k' : 'status'];

            if (
              currentStatus !== MediaStatus.DELETED &&
              currentStatus !== MediaStatus.UNKNOWN
            ) {
              existingEpisode[is4k ? 'status4k' : 'status'] =
                MediaStatus.DELETED;
              toSave.push(existingEpisode);
            }
          }

          if (toSave.length > 0) {
            await getRepository(Episode).save(toSave);
          }
        } catch {
          // Keep season deletion even if episode cleanup fails
        }
      }

      if (
        nonSpecialSeasonKeys.length > 0 &&
        media[is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE
      ) {
        media[is4k ? 'status4k' : 'status'] = MediaStatus.PARTIALLY_AVAILABLE;
        logger.debug(
          `Marking the ${
            is4k ? '4K' : 'non-4K'
          } show [TMDB ID ${media.tmdbId}] as PARTIALLY_AVAILABLE because season(s) [${nonSpecialSeasonKeys}] was not found in any ${
            media.mediaType === 'tv' ? 'Sonarr' : 'Radarr'
          } and ${
            mediaServerType === MediaServerType.PLEX
              ? 'plex'
              : mediaServerType === MediaServerType.JELLYFIN
                ? 'jellyfin'
                : 'emby'
          } instance.`,
          { label: 'AvailabilitySync' }
        );
      }

      media.lastSeasonChange = new Date();
      await mediaRepository.save(media);
    } catch (ex) {
      logger.debug(
        `Failure updating the ${
          is4k ? '4K' : 'non-4K'
        } season(s) [${seasonKeys}], TMDB ID ${media.tmdbId}.`,
        {
          errorMessage: ex.message,
          label: 'AvailabilitySync',
        }
      );
    }
  }

  private async mediaExistsInRadarr(
    media: Media,
    is4k: boolean
  ): Promise<boolean> {
    let existsInRadarr = false;

    const hasSameServerInBothModes = this.radarrServers.some((a) =>
      this.radarrServers.some(
        (b) =>
          a.is4k !== b.is4k && a.hostname === b.hostname && a.port === b.port
      )
    );

    // Check for availability in all of the available radarr servers
    // If any find the media, we will assume the media exists
    for (const server of this.radarrServers.filter(
      (server) => server.is4k === is4k
    )) {
      const radarrAPI = new RadarrAPI({
        apiKey: server.apiKey,
        url: RadarrAPI.buildUrl(server, '/api/v3'),
      });

      try {
        let radarr: RadarrMovie | undefined;

        if (media.externalServiceId && !is4k) {
          radarr = await radarrAPI.getMovie({
            id: media.externalServiceId,
          });
        }

        if (media.externalServiceId4k && is4k) {
          radarr = await radarrAPI.getMovie({
            id: media.externalServiceId4k,
          });
        }

        if (radarr && radarr.tmdbId !== media.tmdbId) {
          continue;
        }

        if (radarr && radarr.hasFile) {
          const resolution =
            radarr?.movieFile?.mediaInfo?.resolution?.split('x');
          const is4kMovie =
            resolution?.length === 2 && Number(resolution[0]) >= 2000;

          if (hasSameServerInBothModes && resolution?.length === 2) {
            // Same server in both modes then use resolution to distinguish
            existsInRadarr = is4k ? is4kMovie : !is4kMovie;
          } else {
            // One server type and if file exists, count it
            existsInRadarr = true;
          }
        }
      } catch (ex) {
        if (!ex.message.includes('404')) {
          existsInRadarr = true;
          logger.debug(
            `Failure retrieving the ${is4k ? '4K' : 'non-4K'} movie [TMDB ID ${
              media.tmdbId
            }] from Radarr.`,
            {
              errorMessage: ex.message,
              label: 'AvailabilitySync',
            }
          );
        }
      }

      if (existsInRadarr) break;
    }

    return existsInRadarr;
  }

  private async mediaExistsInSonarr(
    media: Media,
    is4k: boolean,
    shouldTrackEpisodes: boolean
  ): Promise<{ existsInSonarr: boolean; seasonsMap: Map<number, boolean> }> {
    let existsInSonarr = false;
    let preventSeasonSearch = false;

    // Check for availability in all of the available sonarr servers
    // If any find the media, we will assume the media exists
    for (const server of this.sonarrServers.filter((server) => {
      return server.is4k === is4k;
    })) {
      const sonarrAPI = new SonarrAPI({
        apiKey: server.apiKey,
        url: SonarrAPI.buildUrl(server, '/api/v3'),
      });

      try {
        let sonarr: SonarrSeries | undefined;

        if (media.externalServiceId && !is4k) {
          sonarr = await sonarrAPI.getSeriesById(media.externalServiceId);
        }

        if (media.externalServiceId4k && is4k) {
          sonarr = await sonarrAPI.getSeriesById(media.externalServiceId4k);
        }

        if (sonarr && media.tvdbId != null && sonarr.tvdbId !== media.tvdbId) {
          continue;
        }

        if (sonarr) {
          const externalServiceId = is4k
            ? media.externalServiceId4k
            : media.externalServiceId;
          this.sonarrSeasonsCache[`${server.id}-${externalServiceId}`] =
            sonarr.seasons;

          if (sonarr.statistics.episodeFileCount > 0) {
            existsInSonarr = true;

            if (shouldTrackEpisodes && externalServiceId) {
              try {
                const episodes = await sonarrAPI.getEpisodes(externalServiceId);
                this.sonarrEpisodesCache[`${server.id}-${externalServiceId}`] =
                  episodes.map((episode) => ({
                    seasonNumber: episode.seasonNumber,
                    episodeNumber: episode.episodeNumber,
                    hasFile: episode.hasFile,
                  }));
              } catch (e) {
                logger.error(
                  `Failed to fetch episodes for show [TMDB ID ${media.tmdbId}] from Sonarr.`,
                  {
                    errorMessage: e.message,
                    label: 'AvailabilitySync',
                  }
                );
              }
            }
          }
        }
      } catch (ex) {
        if (!ex.message.includes('404')) {
          existsInSonarr = true;
          preventSeasonSearch = true;
          logger.debug(
            `Failure retrieving the ${is4k ? '4K' : 'non-4K'} show [TMDB ID ${
              media.tmdbId
            }] from Sonarr.`,
            {
              errorMessage: ex.message,
              label: 'AvailabilitySync',
            }
          );
        }
      }
    }

    // Here we check each season for availability
    // If the API returns an error other than a 404,
    // we will have to prevent the season check from happening
    const seasonsMap: Map<number, boolean> = new Map();

    if (!preventSeasonSearch) {
      const filteredSeasons = media.seasons.filter(
        (season) =>
          season[is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE ||
          season[is4k ? 'status4k' : 'status'] ===
            MediaStatus.PARTIALLY_AVAILABLE
      );

      for (const season of filteredSeasons) {
        const seasonExists = await this.seasonExistsInSonarr(
          media,
          season,
          is4k,
          shouldTrackEpisodes
        );

        if (seasonExists) {
          seasonsMap.set(season.seasonNumber, true);
        }
      }
    }

    for (const server of this.sonarrServers.filter(
      (server) => server.is4k === is4k
    )) {
      const externalServiceId = is4k
        ? media.externalServiceId4k
        : media.externalServiceId;
      if (externalServiceId != null) {
        delete this.sonarrEpisodesCache[`${server.id}-${externalServiceId}`];
      }
    }

    return { existsInSonarr, seasonsMap };
  }

  private async seasonExistsInSonarr(
    media: Media,
    season: Season,
    is4k: boolean,
    shouldTrackEpisodes: boolean
  ): Promise<boolean> {
    let seasonExists = false;
    // Do not pre-seed: missing keys mean "not reported by Sonarr" (hard-delete),
    // false means reported without a file (soft-delete).
    const episodeHasFileByNumber = new Map<number, boolean>();
    let hasEpisodeCache = false;

    // Check each sonarr instance to see if the media still exists
    // If found, we will assume the media exists and prevent removal
    // We can use the cache we built when we fetched the series with mediaExistsInSonarr
    for (const server of this.sonarrServers.filter(
      (server) => server.is4k === is4k
    )) {
      let sonarrSeasons: SonarrSeason[] | undefined;
      let sonarrEpisodes: CachedSonarrEpisode[] | undefined;

      if (media.externalServiceId && !is4k) {
        sonarrSeasons =
          this.sonarrSeasonsCache[`${server.id}-${media.externalServiceId}`];
        sonarrEpisodes =
          this.sonarrEpisodesCache[`${server.id}-${media.externalServiceId}`];
      }

      if (media.externalServiceId4k && is4k) {
        sonarrSeasons =
          this.sonarrSeasonsCache[`${server.id}-${media.externalServiceId4k}`];
        sonarrEpisodes =
          this.sonarrEpisodesCache[`${server.id}-${media.externalServiceId4k}`];
      }

      const seasonIsAvailable = sonarrSeasons?.find(
        ({ seasonNumber, statistics }) =>
          season.seasonNumber === seasonNumber &&
          statistics?.episodeFileCount &&
          statistics?.episodeFileCount > 0
      );

      if (seasonIsAvailable && sonarrSeasons) {
        seasonExists = true;
      }

      if (shouldTrackEpisodes && sonarrEpisodes) {
        hasEpisodeCache = true;
        for (const episode of sonarrEpisodes) {
          if (episode.seasonNumber !== season.seasonNumber) {
            continue;
          }

          if (episode.hasFile) {
            episodeHasFileByNumber.set(episode.episodeNumber, true);
          } else if (!episodeHasFileByNumber.has(episode.episodeNumber)) {
            episodeHasFileByNumber.set(episode.episodeNumber, false);
          }
        }
      }
    }

    if (shouldTrackEpisodes && hasEpisodeCache) {
      this.mergeEpisodePresence(season.id, is4k, episodeHasFileByNumber);
    }

    return seasonExists;
  }

  private async loadDbEpisodesBySeasonId(
    seasons: Season[],
    media: Media
  ): Promise<Map<number, Episode[]>> {
    const dbEpisodesBySeasonId = new Map<number, Episode[]>();
    if (seasons.length === 0) {
      return dbEpisodesBySeasonId;
    }

    try {
      const existingEpisodes = await getRepository(Episode).find({
        where: {
          season: { id: In(seasons.map((season) => season.id)) },
        },
        relations: ['season'],
      });

      for (const episode of existingEpisodes) {
        const episodeSeason = await episode.season;
        if (!episodeSeason) {
          continue;
        }
        const seasonEpisodes = dbEpisodesBySeasonId.get(episodeSeason.id);
        if (seasonEpisodes) {
          seasonEpisodes.push(episode);
        } else {
          dbEpisodesBySeasonId.set(episodeSeason.id, [episode]);
        }
      }
    } catch (e) {
      logger.error(
        `Failed to load episodes for show [TMDB ID ${media.tmdbId}].`,
        {
          errorMessage: e.message,
          label: 'AvailabilitySync',
        }
      );
    }

    return dbEpisodesBySeasonId;
  }

  private episodePresenceKey(seasonId: number, is4k: boolean): string {
    return `${seasonId}:${is4k ? '4k' : 'std'}`;
  }

  private mergeEpisodePresence(
    seasonId: number,
    is4k: boolean,
    updates: Map<number, boolean>
  ): void {
    const key = this.episodePresenceKey(seasonId, is4k);
    let presence = this.episodePresenceBySeasonTier.get(key);
    if (!presence) {
      presence = new Map();
      this.episodePresenceBySeasonTier.set(key, presence);
    }

    for (const [episodeNumber, hasFile] of updates) {
      if (hasFile) {
        presence.set(episodeNumber, true);
      } else if (!presence.has(episodeNumber)) {
        presence.set(episodeNumber, false);
      }
    }
  }

  private async applyEpisodeDemotions(media: Media): Promise<void> {
    if (this.episodePresenceBySeasonTier.size === 0) {
      return;
    }

    const seasonsById = new Map(
      media.seasons.map((season) => [season.id, season])
    );
    const seasonIds = [
      ...new Set(
        [...this.episodePresenceBySeasonTier.keys()].map((key) =>
          Number(key.split(':')[0])
        )
      ),
    ];
    const dbEpisodesBySeasonId = await this.loadDbEpisodesBySeasonId(
      seasonIds
        .map((id) => seasonsById.get(id))
        .filter((season): season is Season => season != null),
      media
    );

    for (const [key, presence] of this.episodePresenceBySeasonTier) {
      const [seasonIdRaw, tier] = key.split(':');
      const seasonId = Number(seasonIdRaw);
      const season = seasonsById.get(seasonId);
      if (!season) {
        continue;
      }
      const existingEpisodes = dbEpisodesBySeasonId.get(seasonId) ?? [];
      await this.unmarkMissingEpisodes(
        media,
        season,
        tier === '4k',
        presence,
        existingEpisodes
      );
    }
  }

  private async unmarkMissingEpisodes(
    media: Media,
    season: Season,
    is4k: boolean,
    episodeHasFileByNumber: Map<number, boolean>,
    existingEpisodes: Episode[]
  ): Promise<void> {
    const toSave: Episode[] = [];
    const toRemove: Episode[] = [];

    for (const existingEpisode of existingEpisodes) {
      const hasFile = episodeHasFileByNumber.get(existingEpisode.episodeNumber);
      const currentStatus = existingEpisode[is4k ? 'status4k' : 'status'];

      if (!episodeHasFileByNumber.has(existingEpisode.episodeNumber)) {
        // Number not reported by this source — hard-delete so renumbers cannot
        // permanently trip the season-route mismatch guard.
        toRemove.push(existingEpisode);
      } else if (
        hasFile !== true &&
        currentStatus !== MediaStatus.DELETED &&
        currentStatus !== MediaStatus.UNKNOWN
      ) {
        existingEpisode[is4k ? 'status4k' : 'status'] = MediaStatus.DELETED;
        toSave.push(existingEpisode);
      }
    }

    const episodeRepository = getRepository(Episode);

    if (toRemove.length > 0) {
      try {
        await episodeRepository.remove(toRemove);
      } catch (e) {
        logger.debug(
          `Failed to remove obsolete episodes for show [TMDB ID ${media.tmdbId}] season ${season.seasonNumber}.`,
          {
            errorMessage: e.message,
            label: 'AvailabilitySync',
          }
        );
      }
    }

    if (toSave.length > 0) {
      try {
        await episodeRepository.save(toSave);
      } catch (e) {
        logger.error(
          `Failed to soft-remove episodes for show [TMDB ID ${media.tmdbId}] season ${season.seasonNumber}.`,
          {
            errorMessage: e.message,
            label: 'AvailabilitySync',
          }
        );
      }
    }
  }

  // Plex
  private async mediaExistsInPlex(
    media: Media,
    is4k: boolean,
    shouldTrackEpisodes = false
  ): Promise<{ existsInPlex: boolean; seasonsMap?: Map<number, boolean> }> {
    const ratingKey = media.ratingKey;
    const ratingKey4k = media.ratingKey4k;
    let existsInPlex = false;
    let preventSeasonSearch = false;

    // Check each plex instance to see if the media still exists
    // If found, we will assume the media exists and prevent removal
    // We can use the cache we built when we fetched the series with mediaExistsInPlex
    try {
      let plexMedia: PlexMetadata | undefined;

      if (ratingKey && !is4k) {
        plexMedia = await this.plexClient?.getMetadata(ratingKey);

        if (media.mediaType === 'tv') {
          this.plexSeasonsCache[ratingKey] =
            await this.plexClient?.getChildrenMetadata(ratingKey);
        }

        if (
          plexMedia &&
          media.mediaType === 'movie' &&
          this.enable4kMovie &&
          plexMedia.Media?.length &&
          !plexMedia.Media.some((mediaItem) => (mediaItem.width ?? 0) < 2000)
        ) {
          plexMedia = undefined;
        }
      }

      if (ratingKey4k && is4k) {
        plexMedia = await this.plexClient?.getMetadata(ratingKey4k);

        if (media.mediaType === 'tv') {
          this.plexSeasonsCache[ratingKey4k] =
            await this.plexClient?.getChildrenMetadata(ratingKey4k);
        }

        if (plexMedia) {
          if (
            plexMedia &&
            media.mediaType === 'movie' &&
            plexMedia.Media?.length &&
            !plexMedia.Media.some((mediaItem) => (mediaItem.width ?? 0) >= 2000)
          ) {
            plexMedia = undefined;
          }

          if (plexMedia && media.mediaType === 'tv') {
            const cachedSeasons = this.plexSeasonsCache[ratingKey4k];
            if (cachedSeasons?.length) {
              let has4kInAnySeason = false;
              let verifiedAnySeason = false;
              for (const season of cachedSeasons) {
                try {
                  const episodes = await this.plexClient?.getChildrenMetadata(
                    season.ratingKey
                  );
                  if (episodes?.some((episode) => episode.Media?.length)) {
                    verifiedAnySeason = true;
                  }
                  const has4kEpisode = episodes?.some((episode) =>
                    episode.Media?.some(
                      (mediaItem) => (mediaItem.width ?? 0) >= 2000
                    )
                  );
                  if (has4kEpisode) {
                    has4kInAnySeason = true;
                    break;
                  }
                } catch {
                  // If we can't fetch episodes for a season, continue checking other seasons
                }
              }
              if (verifiedAnySeason && !has4kInAnySeason) {
                plexMedia = undefined;
              }
            }
          }
        }
      }

      if (plexMedia) {
        existsInPlex = true;
      }
    } catch (ex) {
      if (!ex.message.includes('404')) {
        existsInPlex = true;
        preventSeasonSearch = true;
        logger.debug(
          `Failure retrieving the ${is4k ? '4K' : 'non-4K'} ${
            media.mediaType === 'tv' ? 'show' : 'movie'
          } [TMDB ID ${media.tmdbId}] from Plex.`,
          {
            errorMessage: ex.message,
            label: 'AvailabilitySync',
          }
        );
      }
    }

    // Here we check each season in plex for availability
    // If the API returns an error other than a 404,
    // we will have to prevent the season check from happening
    if (media.mediaType === 'tv') {
      const seasonsMap: Map<number, boolean> = new Map();

      if (!preventSeasonSearch) {
        const filteredSeasons = media.seasons.filter(
          (season) =>
            season[is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE ||
            season[is4k ? 'status4k' : 'status'] ===
              MediaStatus.PARTIALLY_AVAILABLE
        );
        const dbEpisodesBySeasonId = shouldTrackEpisodes
          ? await this.loadDbEpisodesBySeasonId(filteredSeasons, media)
          : new Map<number, Episode[]>();

        for (const season of filteredSeasons) {
          const seasonExists = await this.seasonExistsInPlex(
            media,
            season,
            is4k,
            shouldTrackEpisodes,
            dbEpisodesBySeasonId
          );

          if (seasonExists) {
            seasonsMap.set(season.seasonNumber, true);
          }
        }
      }

      return { existsInPlex, seasonsMap };
    }

    return { existsInPlex };
  }

  private async seasonExistsInPlex(
    media: Media,
    season: Season,
    is4k: boolean,
    shouldTrackEpisodes: boolean,
    dbEpisodesBySeasonId: Map<number, Episode[]>
  ): Promise<boolean> {
    const ratingKey = media.ratingKey;
    const ratingKey4k = media.ratingKey4k;
    let seasonExistsInPlex = false;

    let plexSeasons: PlexMetadata[] | undefined;

    if (ratingKey && !is4k) {
      plexSeasons = this.plexSeasonsCache[ratingKey];
    }

    if (ratingKey4k && is4k) {
      plexSeasons = this.plexSeasonsCache[ratingKey4k];
    }

    const seasonMeta = plexSeasons?.find(
      (plexSeason) => plexSeason.index === season.seasonNumber
    );

    if (seasonMeta) {
      const cacheKey = `${is4k ? '4k' : 'std'}-${seasonMeta.ratingKey}`;

      if (cacheKey in this.plexEpisodeExistsCache) {
        seasonExistsInPlex = this.plexEpisodeExistsCache[cacheKey];
      } else {
        try {
          // Season metadata exists, but we need to verify it has actual
          // episode files. Plex can keep empty season entries.
          const episodes = await this.plexClient?.getChildrenMetadata(
            seasonMeta.ratingKey
          );

          const episodeVersions =
            episodes?.flatMap((episode) => episode.Media ?? []) ?? [];

          if (is4k) {
            seasonExistsInPlex = episodeVersions.some(
              (mediaItem) => (mediaItem.width ?? 0) >= 2000
            );
          } else if (this.enable4kShow) {
            seasonExistsInPlex = episodeVersions.some(
              (mediaItem) => (mediaItem.width ?? 0) < 2000
            );
          } else {
            seasonExistsInPlex = episodeVersions.length > 0;
          }

          if (shouldTrackEpisodes) {
            const existingEpisodes = dbEpisodesBySeasonId.get(season.id) ?? [];
            const episodeHasFileByNumber = new Map(
              existingEpisodes.map((episode) => [episode.episodeNumber, false])
            );

            for (const episode of episodes ?? []) {
              if (episode.index == null) {
                continue;
              }

              const versions = episode.Media ?? [];
              let hasFile = false;

              if (is4k) {
                hasFile = versions.some(
                  (mediaItem) => (mediaItem.width ?? 0) >= 2000
                );
              } else if (this.enable4kShow) {
                hasFile = versions.some(
                  (mediaItem) => (mediaItem.width ?? 0) < 2000
                );
              } else {
                hasFile = versions.length > 0;
              }

              if (hasFile) {
                episodeHasFileByNumber.set(episode.index, true);
              }
            }

            this.mergeEpisodePresence(season.id, is4k, episodeHasFileByNumber);
          }
        } catch {
          // If we can't fetch episodes, assume the season exists
          // to avoid false removal
          seasonExistsInPlex = true;
        }

        this.plexEpisodeExistsCache[cacheKey] = seasonExistsInPlex;
      }
    }

    return seasonExistsInPlex;
  }

  // Jellyfin
  private async mediaExistsInJellyfin(
    media: Media,
    is4k: boolean,
    shouldTrackEpisodes = false
  ): Promise<{ existsInJellyfin: boolean; seasonsMap?: Map<number, boolean> }> {
    const ratingKey = media.jellyfinMediaId;
    const ratingKey4k = media.jellyfinMediaId4k;
    let existsInJellyfin = false;
    let preventSeasonSearch = false;

    // Check each jellyfin instance to see if the media still exists
    // If found, we will assume the media exists and prevent removal
    // We can use the cache we built when we fetched the series with mediaExistsInJellyfin
    try {
      let jellyfinMedia: JellyfinLibraryItem | undefined;

      if (ratingKey && !is4k) {
        jellyfinMedia = await this.jellyfinClient?.getItemData(ratingKey);

        if (media.mediaType === 'tv' && jellyfinMedia !== undefined) {
          this.jellyfinSeasonsCache[ratingKey] =
            await this.jellyfinClient?.getSeasons(ratingKey);
        }
      }

      if (ratingKey4k && is4k) {
        jellyfinMedia = await this.jellyfinClient?.getItemData(ratingKey4k);

        if (media.mediaType === 'tv' && jellyfinMedia !== undefined) {
          this.jellyfinSeasonsCache[ratingKey4k] =
            await this.jellyfinClient?.getSeasons(ratingKey4k);
        }
      }

      if (jellyfinMedia) {
        existsInJellyfin = true;
      }
    } catch (ex) {
      if (!ex.message.includes('404') && !ex.message.includes('500')) {
        existsInJellyfin = true;
        preventSeasonSearch = true;
        logger.debug(
          `Failure retrieving the ${is4k ? '4K' : 'non-4K'} ${
            media.mediaType === 'tv' ? 'show' : 'movie'
          } [TMDB ID ${media.tmdbId}] from Jellyfin.`,
          {
            errorMessage: ex.message,
            label: 'AvailabilitySync',
          }
        );
      }
    }

    // Here we check each season in jellyfin for availability
    // If the API returns an error other than a 404,
    // we will have to prevent the season check from happening
    if (media.mediaType === 'tv') {
      const seasonsMap: Map<number, boolean> = new Map();

      if (!preventSeasonSearch) {
        const filteredSeasons = media.seasons.filter(
          (season) =>
            season[is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE ||
            season[is4k ? 'status4k' : 'status'] ===
              MediaStatus.PARTIALLY_AVAILABLE
        );
        const dbEpisodesBySeasonId = shouldTrackEpisodes
          ? await this.loadDbEpisodesBySeasonId(filteredSeasons, media)
          : new Map<number, Episode[]>();

        for (const season of filteredSeasons) {
          const seasonExists = await this.seasonExistsInJellyfin(
            media,
            season,
            is4k,
            shouldTrackEpisodes,
            dbEpisodesBySeasonId
          );

          if (seasonExists) {
            seasonsMap.set(season.seasonNumber, true);
          }
        }
      }

      return { existsInJellyfin, seasonsMap };
    }

    return { existsInJellyfin };
  }

  private async seasonExistsInJellyfin(
    media: Media,
    season: Season,
    is4k: boolean,
    shouldTrackEpisodes: boolean,
    dbEpisodesBySeasonId: Map<number, Episode[]>
  ): Promise<boolean> {
    const ratingKey = media.jellyfinMediaId;
    const ratingKey4k = media.jellyfinMediaId4k;
    let seasonExistsInJellyfin = false;

    let jellyfinSeasons: JellyfinLibraryItem[] | undefined;

    if (ratingKey && !is4k) {
      jellyfinSeasons = this.jellyfinSeasonsCache[ratingKey];
    }

    if (ratingKey4k && is4k) {
      jellyfinSeasons = this.jellyfinSeasonsCache[ratingKey4k];
    }

    const seasonMeta = jellyfinSeasons?.find(
      (jellyfinSeason) => jellyfinSeason.IndexNumber === season.seasonNumber
    );

    if (seasonMeta) {
      const seriesId = is4k ? ratingKey4k : ratingKey;

      if (seriesId) {
        const cacheKey = `${seriesId}-${seasonMeta.Id}`;

        if (cacheKey in this.jellyfinEpisodeExistsCache) {
          seasonExistsInJellyfin = this.jellyfinEpisodeExistsCache[cacheKey];
        } else {
          try {
            // Season metadata exists, but we need to verify it has actual
            // episode files. Jellyfin keeps season entries even after all
            // episodes are deleted. getEpisodes already filters out
            // virtual episodes.
            if (!this.enable4kShow || !shouldTrackEpisodes) {
              const episodes = await this.jellyfinClient.getEpisodes(
                seriesId,
                seasonMeta.Id
              );

              seasonExistsInJellyfin = episodes.length > 0;

              if (shouldTrackEpisodes) {
                const existingEpisodes =
                  dbEpisodesBySeasonId.get(season.id) ?? [];
                const episodeHasFileByNumber = new Map(
                  existingEpisodes.map((episode) => [
                    episode.episodeNumber,
                    false,
                  ])
                );

                for (const episode of episodes) {
                  if (episode.IndexNumber == null) {
                    continue;
                  }

                  const lastEpisodeNumber =
                    episode.IndexNumberEnd ?? episode.IndexNumber;
                  for (
                    let episodeNumber = episode.IndexNumber;
                    episodeNumber <= lastEpisodeNumber;
                    episodeNumber++
                  ) {
                    episodeHasFileByNumber.set(episodeNumber, true);
                  }
                }

                this.mergeEpisodePresence(
                  season.id,
                  is4k,
                  episodeHasFileByNumber
                );
              }
            } else {
              const episodes = await this.jellyfinClient.getEpisodes(
                seriesId,
                seasonMeta.Id,
                { includeMediaInfo: true }
              );
              const existingEpisodes =
                dbEpisodesBySeasonId.get(season.id) ?? [];
              const episodeHasFileByNumber = new Map(
                existingEpisodes.map((episode) => [
                  episode.episodeNumber,
                  false,
                ])
              );

              for (const episode of episodes) {
                const has4k =
                  episode.MediaSources?.some((MediaSource) =>
                    MediaSource.MediaStreams.some(
                      (MediaStream) =>
                        MediaStream.Type === 'Video' &&
                        (MediaStream.Width ?? 0) > 2000
                    )
                  ) ?? false;
                const hasStandard =
                  episode.MediaSources?.some((MediaSource) =>
                    MediaSource.MediaStreams.some(
                      (MediaStream) =>
                        MediaStream.Type === 'Video' &&
                        (MediaStream.Width ?? 0) <= 2000
                    )
                  ) ?? false;

                if (!(is4k ? has4k : hasStandard)) {
                  continue;
                }

                seasonExistsInJellyfin = true;

                if (episode.IndexNumber == null) {
                  continue;
                }

                const lastEpisodeNumber =
                  episode.IndexNumberEnd ?? episode.IndexNumber;
                for (
                  let episodeNumber = episode.IndexNumber;
                  episodeNumber <= lastEpisodeNumber;
                  episodeNumber++
                ) {
                  episodeHasFileByNumber.set(episodeNumber, true);
                }
              }

              this.mergeEpisodePresence(
                season.id,
                is4k,
                episodeHasFileByNumber
              );
            }
          } catch {
            // If we can't fetch episodes, assume the season exists
            // to avoid false removal
            seasonExistsInJellyfin = true;
          }

          this.jellyfinEpisodeExistsCache[cacheKey] = seasonExistsInJellyfin;
        }
      }
    }

    return seasonExistsInJellyfin;
  }
}

const availabilitySync = new AvailabilitySync();

export default availabilitySync;
