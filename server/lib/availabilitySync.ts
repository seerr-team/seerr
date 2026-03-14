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
  private plexSeasonsCache: Record<string, PlexMetadata[]>;
  private jellyfinSeasonsCache: Record<string, JellyfinLibraryItem[]>;
  private plexClients: Record<string, PlexAPI>;
  private jellyfinClients: Record<string, JellyfinAPI>;
  private plexAdminToken?: string | null;
  private jellyfinAdminUserId?: string | null;
  private jellyfinAdminDeviceId?: string | null;
  private quarantinedJellyfinServerIds: Set<string>;
  private sonarrSeasonsCache: Record<string, SonarrSeason[]>;
  private radarrServers: RadarrSettings[];
  private sonarrServers: SonarrSettings[];

  private getPlexClient(serverId?: string | null): PlexAPI | undefined {
    if (!serverId || !this.plexAdminToken) {
      return undefined;
    }

    if (!this.plexClients[serverId]) {
      const server = getSettings().plexServers.find(
        (plexServer) => plexServer.id === serverId
      );

      if (!server) {
        return undefined;
      }

      this.plexClients[serverId] = new PlexAPI({
        plexToken: this.plexAdminToken,
        plexSettings: server,
        plexServerId: server.id,
      });
    }

    return this.plexClients[serverId];
  }

  private getCandidatePlexServerIds(serverId?: string | null): string[] {
    const configuredServerIds = getSettings().plexServers.map(
      (plexServer) => plexServer.id
    );

    return serverId
      ? Array.from(new Set([serverId, ...configuredServerIds]))
      : configuredServerIds;
  }

  private getJellyfinClient(serverId?: string | null): JellyfinAPI | undefined {
    if (!serverId) {
      return undefined;
    }

    if (!this.jellyfinClients[serverId]) {
      const server = getSettings().jellyfinServers.find(
        (jellyfinServer) => jellyfinServer.id === serverId
      );

      if (!server) {
        return undefined;
      }

      const jellyfinClient = new JellyfinAPI(
        getHostname(server),
        server.apiKey,
        this.jellyfinAdminDeviceId,
        server.mediaServerType
      );

      if (this.jellyfinAdminUserId) {
        jellyfinClient.setUserId(this.jellyfinAdminUserId);
      }

      this.jellyfinClients[serverId] = jellyfinClient;
    }

    return this.jellyfinClients[serverId];
  }

  private getCandidateJellyfinServerIds(serverId?: string | null): string[] {
    const configuredServerIds = getSettings().jellyfinServers.map(
      (jellyfinServer) => jellyfinServer.id
    );

    return serverId
      ? Array.from(new Set([serverId, ...configuredServerIds]))
      : configuredServerIds;
  }

  async run() {
    const settings = getSettings();
    const hasPlexServers = settings.plexServers.length > 0;
    const hasJellyfinServers = settings.jellyfinServers.length > 0;
    this.running = true;
    this.plexSeasonsCache = {};
    this.jellyfinSeasonsCache = {};
    this.plexClients = {};
    this.jellyfinClients = {};
    this.plexAdminToken = undefined;
    this.jellyfinAdminUserId = undefined;
    this.jellyfinAdminDeviceId = undefined;
    this.quarantinedJellyfinServerIds = new Set();
    this.sonarrSeasonsCache = {};
    this.radarrServers = settings.radarr.filter((server) => server.syncEnabled);
    this.sonarrServers = settings.sonarr.filter((server) => server.syncEnabled);

    try {
      logger.info(`Starting availability sync...`, {
        label: 'Availability Sync',
      });
      const pageSize = 50;

      const userRepository = getRepository(User);

      if (hasPlexServers) {
        const admin = await userRepository.findOne({
          select: { id: true, plexToken: true },
          where: { id: 1 },
        });

        if (!admin?.plexToken) {
          logger.error('Plex admin is not configured.');
          this.running = false;
          return;
        } else {
          this.plexAdminToken = admin.plexToken;
        }
      }

      if (hasJellyfinServers) {
        const admin = await userRepository.findOne({
          where: { id: 1 },
          select: ['id', 'jellyfinUserId', 'jellyfinDeviceId'],
          order: { id: 'ASC' },
        });

        if (!admin) {
          logger.error('Jellyfin admin is not configured.');
          this.running = false;
          return;
        }

        this.jellyfinAdminUserId = admin.jellyfinUserId;
        this.jellyfinAdminDeviceId = admin.jellyfinDeviceId;

        for (const server of settings.jellyfinServers) {
          try {
            await this.getJellyfinClient(server.id)?.getSystemInfo();
          } catch (e) {
            logger.error('Sync interrupted.', {
              label: 'AvailabilitySync',
              status: e.statusCode,
              error: e.name,
              errorMessage: e.errorCode,
              serverId: server.id,
            });
            this.quarantinedJellyfinServerIds.add(server.id);
            continue;
          }
        }
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
          const { existsInPlex } = await this.mediaExistsInPlex(media, false);
          const { existsInPlex: existsInPlex4k } = await this.mediaExistsInPlex(
            media,
            true
          );

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

          if (!movieExists && media.status === MediaStatus.AVAILABLE) {
            await this.mediaUpdater(
              media,
              false,
              media.mediaServerType ?? MediaServerType.PLEX
            );
          }

          if (!movieExists4k && media.status4k === MediaStatus.AVAILABLE) {
            await this.mediaUpdater(
              media,
              true,
              media.mediaServerType4k ?? MediaServerType.PLEX
            );
          }
        }

        // If both versions still exist in plex, we still need
        // to check through sonarr to verify season availability
        if (media.mediaType === 'tv') {
          let showExists = false;
          let showExists4k = false;

          //plex

          const { existsInPlex, seasonsMap: plexSeasonsMap = new Map() } =
            await this.mediaExistsInPlex(media, false);
          const {
            existsInPlex: existsInPlex4k,
            seasonsMap: plexSeasonsMap4k = new Map(),
          } = await this.mediaExistsInPlex(media, true);

          //jellyfin
          const {
            existsInJellyfin,
            seasonsMap: jellyfinSeasonsMap = new Map(),
          } = await this.mediaExistsInJellyfin(media, false);
          const {
            existsInJellyfin: existsInJellyfin4k,
            seasonsMap: jellyfinSeasonsMap4k = new Map(),
          } = await this.mediaExistsInJellyfin(media, true);

          const { existsInSonarr, seasonsMap: sonarrSeasonsMap } =
            await this.mediaExistsInSonarr(media, false);
          const {
            existsInSonarr: existsInSonarr4k,
            seasonsMap: sonarrSeasonsMap4k,
          } = await this.mediaExistsInSonarr(media, true);

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

          const finalSeasons: Map<number, boolean> = new Map([
            ...filteredSeasonsMap,
            ...plexSeasonsMap,
            ...jellyfinSeasonsMap,
            ...sonarrSeasonsMap,
          ]);
          const finalSeasons4k: Map<number, boolean> = new Map([
            ...filteredSeasonsMap4k,
            ...plexSeasonsMap4k,
            ...jellyfinSeasonsMap4k,
            ...sonarrSeasonsMap4k,
          ]);

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
            await this.mediaUpdater(
              media,
              false,
              media.mediaServerType ?? MediaServerType.PLEX
            );
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
            await this.mediaUpdater(
              media,
              true,
              media.mediaServerType4k ?? MediaServerType.PLEX
            );
          }

          // TODO: Figure out how to run seasonUpdater for each season

          if ([...finalSeasons.values()].includes(false)) {
            await this.seasonUpdater(
              media,
              finalSeasons,
              false,
              media.mediaServerType ?? MediaServerType.PLEX
            );
          }

          if ([...finalSeasons4k.values()].includes(false)) {
            await this.seasonUpdater(
              media,
              finalSeasons4k,
              true,
              media.mediaServerType4k ?? MediaServerType.PLEX
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
        media[is4k ? 'plexServerId4k' : 'plexServerId'] = isMediaProcessing
          ? media[is4k ? 'plexServerId4k' : 'plexServerId']
          : null;
      } else if (
        mediaServerType === MediaServerType.JELLYFIN ||
        mediaServerType === MediaServerType.EMBY
      ) {
        media[is4k ? 'jellyfinMediaId4k' : 'jellyfinMediaId'] =
          isMediaProcessing
            ? media[is4k ? 'jellyfinMediaId4k' : 'jellyfinMediaId']
            : null;
        media[is4k ? 'jellyfinServerId4k' : 'jellyfinServerId'] =
          isMediaProcessing
            ? media[is4k ? 'jellyfinServerId4k' : 'jellyfinServerId']
            : null;
      }
      logger.info(
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
      for (const mediaSeason of media.seasons) {
        if (seasonsPendingRemoval.has(mediaSeason.seasonNumber)) {
          mediaSeason[is4k ? 'status4k' : 'status'] = MediaStatus.DELETED;
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

      logger.info(
        `The ${is4k ? '4K' : 'non-4K'} season(s) [${seasonKeys}] [TMDB ID ${
          media.tmdbId
        }] was not found in any ${
          media.mediaType === 'tv' ? 'Sonarr' : 'Radarr'
        } and ${
          mediaServerType === MediaServerType.PLEX
            ? 'plex'
            : mediaServerType === MediaServerType.JELLYFIN
              ? 'jellyfin'
              : 'emby'
        } instance. Status will be changed to deleted.`,
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
              label: 'Availability Sync',
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
    const ratingKey = is4k ? media.ratingKey4k : media.ratingKey;
    const storedServerId = is4k ? media.plexServerId4k : media.plexServerId;
    const candidateServerIds = this.getCandidatePlexServerIds(storedServerId);
    let existsInPlex = false;
    let preventSeasonSearch = false;

    if (!ratingKey || candidateServerIds.length === 0) {
      return media.mediaType === 'tv'
        ? { existsInPlex, seasonsMap: new Map() }
        : { existsInPlex };
    }

    // Check each plex instance to see if the media still exists
    // If found, we will assume the media exists and prevent removal
    // We can use the cache we built when we fetched the series with mediaExistsInPlex
    for (const serverId of candidateServerIds) {
      const plexClient = this.getPlexClient(serverId);
      if (!plexClient) {
        continue;
      }

      const cacheKey = `${serverId}-${ratingKey}`;

      try {
        let plexMedia: PlexMetadata | undefined;

        plexMedia = await plexClient.getMetadata(ratingKey);

        if (media.mediaType === 'tv') {
          const plexSeasons = await plexClient.getChildrenMetadata(ratingKey);

          if (is4k) {
            const seasonsWith4kEpisodes: PlexMetadata[] = [];
            let fetchFailed = false;

            for (const season of plexSeasons) {
              try {
                const episodes = await plexClient.getChildrenMetadata(
                  season.ratingKey
                );
                const has4kEpisode = episodes?.some((episode) =>
                  episode.Media?.some(
                    (mediaItem) => (mediaItem.width ?? 0) >= 2000
                  )
                );

                if (has4kEpisode) {
                  seasonsWith4kEpisodes.push(season);
                }
              } catch {
                fetchFailed = true;
              }
            }

            if (
              plexSeasons.length > 0 &&
              seasonsWith4kEpisodes.length === 0 &&
              fetchFailed
            ) {
              seasonsWith4kEpisodes.push(...plexSeasons);
            }

            this.plexSeasonsCache[cacheKey] = seasonsWith4kEpisodes;
          } else {
            this.plexSeasonsCache[cacheKey] = plexSeasons;
          }
        }

        if (is4k && plexMedia) {
          if (
            media.mediaType === 'movie' &&
            !plexMedia.Media?.some(
              (mediaItem) => (mediaItem.width ?? 0) >= 2000
            )
          ) {
            plexMedia = undefined;
          }

          if (
            media.mediaType === 'tv' &&
            !this.plexSeasonsCache[cacheKey]?.length
          ) {
            plexMedia = undefined;
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
              serverId,
            }
          );
        }
      }
    }

    // Here we check each season in plex for availability
    // If the API returns an error other than a 404,
    // we will have to prevent the season check from happening
    if (media.mediaType === 'tv') {
      const seasonsMap: Map<number, boolean> = new Map();
      const filteredSeasons = media.seasons.filter(
        (season) =>
          season[is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE ||
          season[is4k ? 'status4k' : 'status'] ===
            MediaStatus.PARTIALLY_AVAILABLE
      );

      if (preventSeasonSearch) {
        for (const season of filteredSeasons) {
          seasonsMap.set(season.seasonNumber, true);
        }

        return { existsInPlex, seasonsMap };
      }

      for (const season of filteredSeasons) {
        const seasonExists = await this.seasonExistsInPlex(media, season, is4k);

        if (seasonExists) {
          seasonsMap.set(season.seasonNumber, true);
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
    const ratingKey = is4k ? media.ratingKey4k : media.ratingKey;
    const storedServerId = is4k ? media.plexServerId4k : media.plexServerId;

    if (!ratingKey) {
      return false;
    }

    for (const serverId of this.getCandidatePlexServerIds(storedServerId)) {
      const plexSeasons = this.plexSeasonsCache[`${serverId}-${ratingKey}`];
      const seasonIsAvailable = plexSeasons?.find(
        (plexSeason) => plexSeason.index === season.seasonNumber
      );

      if (seasonIsAvailable) {
        return true;
      }
    }

    return false;
  }

  // Jellyfin
  private async mediaExistsInJellyfin(
    media: Media,
    is4k: boolean
  ): Promise<{ existsInJellyfin: boolean; seasonsMap?: Map<number, boolean> }> {
    const ratingKey = is4k ? media.jellyfinMediaId4k : media.jellyfinMediaId;
    const storedServerId = is4k
      ? media.jellyfinServerId4k
      : media.jellyfinServerId;
    const candidateServerIds =
      this.getCandidateJellyfinServerIds(storedServerId);
    let existsInJellyfin = false;
    let preventSeasonSearch = false;

    if (!ratingKey || candidateServerIds.length === 0) {
      return media.mediaType === 'tv'
        ? { existsInJellyfin, seasonsMap: new Map() }
        : { existsInJellyfin };
    }

    // Check each jellyfin instance to see if the media still exists
    // If found, we will assume the media exists and prevent removal
    // We can use the cache we built when we fetched the series with mediaExistsInJellyfin
    for (const serverId of candidateServerIds) {
      if (this.quarantinedJellyfinServerIds.has(serverId)) {
        existsInJellyfin = true;
        preventSeasonSearch = true;
        continue;
      }

      const jellyfinClient = this.getJellyfinClient(serverId);
      if (!jellyfinClient) {
        continue;
      }

      const cacheKey = `${serverId}-${ratingKey}`;

      try {
        const jellyfinMedia = await jellyfinClient.getItemData(ratingKey);

        if (media.mediaType === 'tv' && jellyfinMedia !== undefined) {
          this.jellyfinSeasonsCache[cacheKey] =
            await jellyfinClient.getSeasons(ratingKey);
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
              serverId,
            }
          );
        }
      }
    }

    // Here we check each season in jellyfin for availability
    // If the API returns an error other than a 404,
    // we will have to prevent the season check from happening
    if (media.mediaType === 'tv') {
      const seasonsMap: Map<number, boolean> = new Map();
      const filteredSeasons = media.seasons.filter(
        (season) =>
          season[is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE ||
          season[is4k ? 'status4k' : 'status'] ===
            MediaStatus.PARTIALLY_AVAILABLE
      );

      if (preventSeasonSearch) {
        for (const season of filteredSeasons) {
          seasonsMap.set(season.seasonNumber, true);
        }

        return { existsInJellyfin, seasonsMap };
      }

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

      return { existsInJellyfin, seasonsMap };
    }

    return { existsInJellyfin };
  }

  private async seasonExistsInJellyfin(
    media: Media,
    season: Season,
    is4k: boolean
  ): Promise<boolean> {
    const ratingKey = is4k ? media.jellyfinMediaId4k : media.jellyfinMediaId;
    const storedServerId = is4k
      ? media.jellyfinServerId4k
      : media.jellyfinServerId;

    if (!ratingKey) {
      return false;
    }

    for (const serverId of this.getCandidateJellyfinServerIds(
      storedServerId
    )) {
      const jellyfinSeasons =
        this.jellyfinSeasonsCache[`${serverId}-${ratingKey}`];
      const seasonIsAvailable = jellyfinSeasons?.find(
        (jellyfinSeason) => jellyfinSeason.IndexNumber === season.seasonNumber
      );

      if (seasonIsAvailable) {
        return true;
      }
    }

    return false;
  }
}

const availabilitySync = new AvailabilitySync();

export default availabilitySync;
