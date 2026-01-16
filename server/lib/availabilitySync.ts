import type { JellyfinLibraryItem } from '@server/api/jellyfin';
import JellyfinAPI from '@server/api/jellyfin';
import type { PlexMetadata } from '@server/api/plexapi';
import PlexAPI from '@server/api/plexapi';
import RadarrAPI, { type RadarrMovie } from '@server/api/servarr/radarr';
import type { SonarrSeason, SonarrSeries } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaRequest from '@server/entity/MediaRequest';
import type Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { getHostname } from '@server/utils/getHostname';

class AvailabilitySync {
  public running = false;
  private plexClient: PlexAPI;
  private plexSeasonsCache: Record<string, PlexMetadata[]>;

  private jellyfinClient: JellyfinAPI;
  private jellyfinSeasonsCache: Record<string, JellyfinLibraryItem[]>;

  private sonarrSeasonsCache: Record<string, SonarrSeason[]>;
  private radarrServers: RadarrSettings[];
  private sonarrServers: SonarrSettings[];

  async run() {
    const settings = getSettings();
    const mediaServerType = getSettings().main.mediaServerType;
    this.running = true;
    this.plexSeasonsCache = {};
    this.jellyfinSeasonsCache = {};
    this.sonarrSeasonsCache = {};
    this.radarrServers = settings.radarr.filter((server) => server.syncEnabled);
    this.sonarrServers = settings.sonarr.filter((server) => server.syncEnabled);

    try {
      logger.info(`Starting availability sync...`, {
        label: 'Availability Sync',
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
            if (settings.main.prioritizeRadarrSonarr) {
              // When prioritizing Radarr/Sonarr, use ONLY Radarr availability
              if (existsInRadarr) {
                movieExists = true;
                logger.info(
                  `The non-4K movie [TMDB ID ${media.tmdbId}] still exists in Radarr. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }

              if (existsInRadarr4k) {
                movieExists4k = true;
                logger.info(
                  `The 4K movie [TMDB ID ${media.tmdbId}] still exists in Radarr. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }
            } else {
              // Original OR logic: check both Plex AND Radarr
              const { existsInPlex } = await this.mediaExistsInPlex(
                media,
                false
              );
              const { existsInPlex: existsInPlex4k } =
                await this.mediaExistsInPlex(media, true);

              if (existsInPlex || existsInRadarr) {
                movieExists = true;
                logger.info(
                  `The non-4K movie [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }

              if (existsInPlex4k || existsInRadarr4k) {
                movieExists4k = true;
                logger.info(
                  `The 4K movie [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }
            }
          }

          //jellyfin
          if (
            mediaServerType === MediaServerType.JELLYFIN ||
            mediaServerType === MediaServerType.EMBY
          ) {
            if (settings.main.prioritizeRadarrSonarr) {
              // When prioritizing Radarr/Sonarr, use ONLY Radarr availability
              if (existsInRadarr) {
                movieExists = true;
                logger.info(
                  `The non-4K movie [TMDB ID ${media.tmdbId}] still exists in Radarr. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }

              if (existsInRadarr4k) {
                movieExists4k = true;
                logger.info(
                  `The 4K movie [TMDB ID ${media.tmdbId}] still exists in Radarr. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }
            } else {
              // Original OR logic: check both Jellyfin AND Radarr
              const { existsInJellyfin } = await this.mediaExistsInJellyfin(
                media,
                false
              );
              const { existsInJellyfin: existsInJellyfin4k } =
                await this.mediaExistsInJellyfin(media, true);

              if (existsInJellyfin || existsInRadarr) {
                movieExists = true;
                logger.info(
                  `The non-4K movie [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }

              if (existsInJellyfin4k || existsInRadarr4k) {
                movieExists4k = true;
                logger.info(
                  `The 4K movie [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }
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

          // Initialize season maps
          let plexSeasonsMap = new Map<number, boolean>();
          let plexSeasonsMap4k = new Map<number, boolean>();
          let jellyfinSeasonsMap = new Map<number, boolean>();
          let jellyfinSeasonsMap4k = new Map<number, boolean>();

          // Always check Sonarr first
          const { existsInSonarr, seasonsMap: sonarrSeasonsMap } =
            await this.mediaExistsInSonarr(media, false);
          const {
            existsInSonarr: existsInSonarr4k,
            seasonsMap: sonarrSeasonsMap4k,
          } = await this.mediaExistsInSonarr(media, true);

          //plex
          if (mediaServerType === MediaServerType.PLEX) {
            if (settings.main.prioritizeRadarrSonarr) {
              // When prioritizing Radarr/Sonarr, use ONLY Sonarr availability
              if (existsInSonarr) {
                showExists = true;
                logger.info(
                  `The non-4K show [TMDB ID ${media.tmdbId}] still exists in Sonarr. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }

              if (existsInSonarr4k) {
                showExists4k = true;
                logger.info(
                  `The 4K show [TMDB ID ${media.tmdbId}] still exists in Sonarr. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }
            } else {
              // Original OR logic: check both Plex AND Sonarr
              const {
                existsInPlex,
                seasonsMap: plexSeasonsMapResult = new Map(),
              } = await this.mediaExistsInPlex(media, false);
              const {
                existsInPlex: existsInPlex4k,
                seasonsMap: plexSeasonsMap4kResult = new Map(),
              } = await this.mediaExistsInPlex(media, true);

              plexSeasonsMap = plexSeasonsMapResult;
              plexSeasonsMap4k = plexSeasonsMap4kResult;

              if (existsInPlex || existsInSonarr) {
                showExists = true;
                logger.info(
                  `The non-4K show [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }

              if (existsInPlex4k || existsInSonarr4k) {
                showExists4k = true;
                logger.info(
                  `The 4K show [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }
            }
          }

          //jellyfin
          if (
            mediaServerType === MediaServerType.JELLYFIN ||
            mediaServerType === MediaServerType.EMBY
          ) {
            if (settings.main.prioritizeRadarrSonarr) {
              // When prioritizing Radarr/Sonarr, use ONLY Sonarr availability
              if (existsInSonarr) {
                showExists = true;
                logger.info(
                  `The non-4K show [TMDB ID ${media.tmdbId}] still exists in Sonarr. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }

              if (existsInSonarr4k) {
                showExists4k = true;
                logger.info(
                  `The 4K show [TMDB ID ${media.tmdbId}] still exists in Sonarr. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }
            } else {
              // Original OR logic: check both Jellyfin AND Sonarr
              const {
                existsInJellyfin,
                seasonsMap: jellyfinSeasonsMapResult = new Map(),
              } = await this.mediaExistsInJellyfin(media, false);
              const {
                existsInJellyfin: existsInJellyfin4k,
                seasonsMap: jellyfinSeasonsMap4kResult = new Map(),
              } = await this.mediaExistsInJellyfin(media, true);

              jellyfinSeasonsMap = jellyfinSeasonsMapResult;
              jellyfinSeasonsMap4k = jellyfinSeasonsMap4kResult;

              if (existsInJellyfin || existsInSonarr) {
                showExists = true;
                logger.info(
                  `The non-4K show [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }

              if (existsInJellyfin4k || existsInSonarr4k) {
                showExists4k = true;
                logger.info(
                  `The 4K show [TMDB ID ${media.tmdbId}] still exists. Preventing removal.`,
                  {
                    label: 'AvailabilitySync',
                  }
                );
              }
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

          // non-4k
          const finalSeasons: Map<number, boolean> = new Map();

          if (mediaServerType === MediaServerType.PLEX) {
            if (settings.main.prioritizeRadarrSonarr) {
              // When prioritizing Radarr/Sonarr, use ONLY Sonarr season data
              filteredSeasonsMap.forEach((value, key) => {
                finalSeasons.set(key, value);
              });

              sonarrSeasonsMap.forEach((value, key) => {
                finalSeasons.set(key, value);
              });
            } else {
              // Original logic: Plex seasons take priority
              plexSeasonsMap.forEach((value, key) => {
                finalSeasons.set(key, value);
              });

              filteredSeasonsMap.forEach((value, key) => {
                if (!finalSeasons.has(key)) {
                  finalSeasons.set(key, value);
                }
              });

              sonarrSeasonsMap.forEach((value, key) => {
                if (!finalSeasons.has(key)) {
                  finalSeasons.set(key, value);
                }
              });
            }
          } else if (
            mediaServerType === MediaServerType.JELLYFIN ||
            mediaServerType === MediaServerType.EMBY
          ) {
            if (settings.main.prioritizeRadarrSonarr) {
              // When prioritizing Radarr/Sonarr, use ONLY Sonarr season data
              filteredSeasonsMap.forEach((value, key) => {
                finalSeasons.set(key, value);
              });

              sonarrSeasonsMap.forEach((value, key) => {
                finalSeasons.set(key, value);
              });
            } else {
              // Original logic: Jellyfin seasons take priority
              jellyfinSeasonsMap.forEach((value, key) => {
                finalSeasons.set(key, value);
              });

              filteredSeasonsMap.forEach((value, key) => {
                if (!finalSeasons.has(key)) {
                  finalSeasons.set(key, value);
                }
              });

              sonarrSeasonsMap.forEach((value, key) => {
                if (!finalSeasons.has(key)) {
                  finalSeasons.set(key, value);
                }
              });
            }
          }

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

          // 4k
          const finalSeasons4k: Map<number, boolean> = new Map();

          if (mediaServerType === MediaServerType.PLEX) {
            if (settings.main.prioritizeRadarrSonarr) {
              // When prioritizing Radarr/Sonarr, use ONLY Sonarr season data
              filteredSeasonsMap4k.forEach((value, key) => {
                finalSeasons4k.set(key, value);
              });

              sonarrSeasonsMap4k.forEach((value, key) => {
                finalSeasons4k.set(key, value);
              });
            } else {
              // Original logic: Plex seasons take priority
              plexSeasonsMap4k.forEach((value, key) => {
                finalSeasons4k.set(key, value);
              });

              filteredSeasonsMap4k.forEach((value, key) => {
                if (!finalSeasons4k.has(key)) {
                  finalSeasons4k.set(key, value);
                }
              });

              sonarrSeasonsMap4k.forEach((value, key) => {
                if (!finalSeasons4k.has(key)) {
                  finalSeasons4k.set(key, value);
                }
              });
            }
          } else if (
            mediaServerType === MediaServerType.JELLYFIN ||
            mediaServerType === MediaServerType.EMBY
          ) {
            if (settings.main.prioritizeRadarrSonarr) {
              // When prioritizing Radarr/Sonarr, use ONLY Sonarr season data
              filteredSeasonsMap4k.forEach((value, key) => {
                finalSeasons4k.set(key, value);
              });

              sonarrSeasonsMap4k.forEach((value, key) => {
                finalSeasons4k.set(key, value);
              });
            } else {
              // Original logic: Jellyfin seasons take priority
              jellyfinSeasonsMap4k.forEach((value, key) => {
                finalSeasons4k.set(key, value);
              });

              filteredSeasonsMap4k.forEach((value, key) => {
                if (!finalSeasons4k.has(key)) {
                  finalSeasons4k.set(key, value);
                }
              });

              sonarrSeasonsMap4k.forEach((value, key) => {
                if (!finalSeasons4k.has(key)) {
                  finalSeasons4k.set(key, value);
                }
              });
            }
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
        label: 'Availability Sync',
      });
    } finally {
      logger.info(`Availability sync complete.`, {
        label: 'Availability Sync',
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
    const settings = getSettings();

    try {
      // If media type is tv, check if a season is processing
      // to see if we need to keep the external metadata
      let isMediaProcessing = false;

      if (media.mediaType === 'tv') {
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
      }

      // When prioritizing Radarr/Sonarr, set status to UNKNOWN instead of DELETED
      // (placeholder files were never legitimate, so they're not "deleted")
      // Otherwise use DELETED (natural Seerr flow for removed media)
      media[is4k ? 'status4k' : 'status'] = settings.main.prioritizeRadarrSonarr
        ? MediaStatus.UNKNOWN
        : MediaStatus.DELETED;

      // When prioritizing Radarr/Sonarr, always clear metadata since the item
      // doesn't exist in Radarr/Sonarr (even if there's a pending request)
      // Otherwise, only clear if not processing
      const shouldClearMetadata =
        settings.main.prioritizeRadarrSonarr || !isMediaProcessing;

      media[is4k ? 'serviceId4k' : 'serviceId'] = shouldClearMetadata
        ? null
        : media[is4k ? 'serviceId4k' : 'serviceId'];
      media[is4k ? 'externalServiceId4k' : 'externalServiceId'] =
        shouldClearMetadata
          ? null
          : media[is4k ? 'externalServiceId4k' : 'externalServiceId'];
      media[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'] =
        shouldClearMetadata
          ? null
          : media[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'];

      if (mediaServerType === MediaServerType.PLEX) {
        media[is4k ? 'ratingKey4k' : 'ratingKey'] = shouldClearMetadata
          ? null
          : media[is4k ? 'ratingKey4k' : 'ratingKey'];
      } else if (
        mediaServerType === MediaServerType.JELLYFIN ||
        mediaServerType === MediaServerType.EMBY
      ) {
        media[is4k ? 'jellyfinMediaId4k' : 'jellyfinMediaId'] =
          shouldClearMetadata
            ? null
            : media[is4k ? 'jellyfinMediaId4k' : 'jellyfinMediaId'];
      }
      const newStatus = settings.main.prioritizeRadarrSonarr
        ? 'unknown'
        : 'deleted';
      const searchLocation = settings.main.prioritizeRadarrSonarr
        ? media.mediaType === 'movie'
          ? 'Radarr'
          : 'Sonarr'
        : `${media.mediaType === 'movie' ? 'Radarr' : 'Sonarr'} and ${
            mediaServerType === MediaServerType.PLEX
              ? 'Plex'
              : mediaServerType === MediaServerType.JELLYFIN
              ? 'Jellyfin'
              : 'Emby'
          }`;

      logger.info(
        `The ${is4k ? '4K' : 'non-4K'} ${
          media.mediaType === 'movie' ? 'movie' : 'show'
        } [TMDB ID ${
          media.tmdbId
        }] was not found in ${searchLocation}. Status will be changed to ${newStatus}.`,
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
          label: 'Availability Sync',
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
    const settings = getSettings();

    // Filter out only the values that are false
    // (media that should be deleted)
    const seasonsPendingRemoval = new Map(
      // Disabled linter as only the value is needed from the filter
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      [...seasons].filter(([_, exists]) => !exists)
    );
    // Retrieve the season keys to pass into our log
    const seasonKeys = [...seasonsPendingRemoval.keys()];

    // let isSeasonRemoved = false;

    try {
      // When prioritizing Radarr/Sonarr, set status to UNKNOWN instead of DELETED
      const removalStatus = settings.main.prioritizeRadarrSonarr
        ? MediaStatus.UNKNOWN
        : MediaStatus.DELETED;

      for (const mediaSeason of media.seasons) {
        if (seasonsPendingRemoval.has(mediaSeason.seasonNumber)) {
          mediaSeason[is4k ? 'status4k' : 'status'] = removalStatus;
        }
      }

      if (media.status === MediaStatus.AVAILABLE && !is4k) {
        media.status = MediaStatus.PARTIALLY_AVAILABLE;
        logger.info(
          `Marking the non-4K show [TMDB ID ${media.tmdbId}] as PARTIALLY_AVAILABLE because season removal has occurred.`,
          { label: 'Availability Sync' }
        );
      }

      if (media.status4k === MediaStatus.AVAILABLE && is4k) {
        media.status4k = MediaStatus.PARTIALLY_AVAILABLE;
        logger.info(
          `Marking the 4K show [TMDB ID ${media.tmdbId}] as PARTIALLY_AVAILABLE because season removal has occurred.`,
          { label: 'Availability Sync' }
        );
      }

      media.lastSeasonChange = new Date();
      await mediaRepository.save(media);

      const newStatus = settings.main.prioritizeRadarrSonarr
        ? 'unknown'
        : 'deleted';
      const searchLocation = settings.main.prioritizeRadarrSonarr
        ? media.mediaType === 'tv'
          ? 'Sonarr'
          : 'Radarr'
        : `${media.mediaType === 'tv' ? 'Sonarr' : 'Radarr'} and ${
            mediaServerType === MediaServerType.PLEX
              ? 'Plex'
              : mediaServerType === MediaServerType.JELLYFIN
              ? 'Jellyfin'
              : 'Emby'
          }`;

      logger.info(
        `The ${is4k ? '4K' : 'non-4K'} season(s) [${seasonKeys}] [TMDB ID ${
          media.tmdbId
        }] was not found in ${searchLocation}. Status will be changed to ${newStatus}.`,
        { label: 'AvailabilitySync' }
      );
    } catch (ex) {
      logger.debug(
        `Failure updating the ${
          is4k ? '4K' : 'non-4K'
        } season(s) [${seasonKeys}], TMDB ID ${media.tmdbId}.`,
        {
          errorMessage: ex.message,
          label: 'Availability Sync',
        }
      );
    }
  }

  private async mediaExistsInRadarr(
    media: Media,
    is4k: boolean
  ): Promise<boolean> {
    let existsInRadarr = false;

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

        if (radarr && radarr.hasFile) {
          const resolution =
            radarr?.movieFile?.mediaInfo?.resolution?.split('x');
          const is4kMovie =
            resolution?.length === 2 && Number(resolution[0]) >= 2000;
          existsInRadarr = is4k ? is4kMovie : !is4kMovie;
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
              label: 'Availability Sync',
            }
          );
        }
      }
    }

    return existsInRadarr;
  }

  private async mediaExistsInSonarr(
    media: Media,
    is4k: boolean
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
          this.sonarrSeasonsCache[`${server.id}-${media.externalServiceId}`] =
            sonarr.seasons;
        }

        if (media.externalServiceId4k && is4k) {
          sonarr = await sonarrAPI.getSeriesById(media.externalServiceId4k);
          this.sonarrSeasonsCache[`${server.id}-${media.externalServiceId4k}`] =
            sonarr.seasons;
        }

        if (sonarr && sonarr.statistics.episodeFileCount > 0) {
          existsInSonarr = true;
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
              label: 'Availability Sync',
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
          is4k
        );

        if (seasonExists) {
          seasonsMap.set(season.seasonNumber, true);
        }
      }
    }

    return { existsInSonarr, seasonsMap };
  }

  private async seasonExistsInSonarr(
    media: Media,
    season: Season,
    is4k: boolean
  ): Promise<boolean> {
    let seasonExists = false;

    // Check each sonarr instance to see if the media still exists
    // If found, we will assume the media exists and prevent removal
    // We can use the cache we built when we fetched the series with mediaExistsInSonarr
    for (const server of this.sonarrServers.filter(
      (server) => server.is4k === is4k
    )) {
      let sonarrSeasons: SonarrSeason[] | undefined;

      if (media.externalServiceId && !is4k) {
        sonarrSeasons =
          this.sonarrSeasonsCache[`${server.id}-${media.externalServiceId}`];
      }

      if (media.externalServiceId4k && is4k) {
        sonarrSeasons =
          this.sonarrSeasonsCache[`${server.id}-${media.externalServiceId4k}`];
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
    }

    return seasonExists;
  }

  // Plex
  private async mediaExistsInPlex(
    media: Media,
    is4k: boolean
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
      }

      if (ratingKey4k && is4k) {
        plexMedia = await this.plexClient?.getMetadata(ratingKey4k);

        if (media.mediaType === 'tv') {
          this.plexSeasonsCache[ratingKey4k] =
            await this.plexClient?.getChildrenMetadata(ratingKey4k);
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
            label: 'Availability Sync',
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

        for (const season of filteredSeasons) {
          const seasonExists = await this.seasonExistsInPlex(
            media,
            season,
            is4k
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
    is4k: boolean
  ): Promise<boolean> {
    const ratingKey = media.ratingKey;
    const ratingKey4k = media.ratingKey4k;
    let seasonExistsInPlex = false;

    // Check each plex instance to see if the season exists
    let plexSeasons: PlexMetadata[] | undefined;

    if (ratingKey && !is4k) {
      plexSeasons = this.plexSeasonsCache[ratingKey];
    }

    if (ratingKey4k && is4k) {
      plexSeasons = this.plexSeasonsCache[ratingKey4k];
    }

    const seasonIsAvailable = plexSeasons?.find(
      (plexSeason) => plexSeason.index === season.seasonNumber
    );

    if (seasonIsAvailable) {
      seasonExistsInPlex = true;
    }

    return seasonExistsInPlex;
  }

  // Jellyfin
  private async mediaExistsInJellyfin(
    media: Media,
    is4k: boolean
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
      if (!ex.message.includes('404' || '500')) {
        existsInJellyfin = false;
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

        for (const season of filteredSeasons) {
          const seasonExists = await this.seasonExistsInJellyfin(
            media,
            season,
            is4k
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
    is4k: boolean
  ): Promise<boolean> {
    const ratingKey = media.jellyfinMediaId;
    const ratingKey4k = media.jellyfinMediaId4k;
    let seasonExistsInJellyfin = false;

    // Check each jellyfin instance to see if the season exists
    let jellyfinSeasons: JellyfinLibraryItem[] | undefined;

    if (ratingKey && !is4k) {
      jellyfinSeasons = this.jellyfinSeasonsCache[ratingKey];
    }

    if (ratingKey4k && is4k) {
      jellyfinSeasons = this.jellyfinSeasonsCache[ratingKey4k];
    }

    const seasonIsAvailable = jellyfinSeasons?.find(
      (jellyfinSeason) => jellyfinSeason.IndexNumber === season.seasonNumber
    );

    if (seasonIsAvailable) {
      seasonExistsInJellyfin = true;
    }

    return seasonExistsInJellyfin;
  }
}

const availabilitySync = new AvailabilitySync();

export default availabilitySync;
