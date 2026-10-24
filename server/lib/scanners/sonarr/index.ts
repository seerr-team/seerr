import { getMetadataProvider } from '@server/api/metadata';
import type { SonarrSeries } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type {
  TmdbKeyword,
  TmdbTvDetails,
  TmdbTvScanDetails,
} from '@server/api/themoviedb/interfaces';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import type {
  ProcessableSeason,
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import BaseScanner from '@server/lib/scanners/baseScanner';
import type { SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { uniqWith } from 'lodash';

type SyncStatus = StatusBase & {
  currentServer: SonarrSettings;
  servers: SonarrSettings[];
};

class SonarrScanner
  extends BaseScanner<SonarrSeries>
  implements RunnableScanner<SyncStatus>
{
  protected declineRequestsOnStatusReset = true;
  private servers: SonarrSettings[];
  private currentServer: SonarrSettings;
  private sonarrApi: SonarrAPI;
  private scannedTvdbIds: Set<number> = new Set();
  private scanned4kTvdbIds: Set<number> = new Set();
  // media.tvdbId can differ from the tvdbId Sonarr carries the series under.
  private scannedTmdbIds: Set<number> = new Set();
  private scanned4kTmdbIds: Set<number> = new Set();
  // Season numbers keyed on tmdbId, as media.tvdbId can be null. Excludes unmonitored seasons.
  private processingTmdbIds: Map<number, Set<number>> = new Map();
  private processing4kTmdbIds: Map<number, Set<number>> = new Map();
  // A lookup can fail before its tmdbId is known, so failures are matched through other servers' lookups.
  private failedTvdbIds: Set<number> = new Set();
  private failed4kTvdbIds: Set<number> = new Set();
  private tmdbIdsByTvdbId: Map<number, number> = new Map();
  private didScanStandard = false;
  private didScan4k = false;
  private serverReturnedEmpty = false;
  private server4kReturnedEmpty = false;

  constructor() {
    super('Sonarr Scan', { bundleSize: 50 });
  }

  public status(): SyncStatus {
    return {
      running: this.running,
      progress: this.progress,
      total: this.items.length,
      currentServer: this.currentServer,
      servers: this.servers,
    };
  }

  public async run(): Promise<void> {
    const settings = getSettings();
    const sessionId = this.startRun();
    this.scannedTvdbIds.clear();
    this.scanned4kTvdbIds.clear();
    this.scannedTmdbIds.clear();
    this.scanned4kTmdbIds.clear();
    this.processingTmdbIds.clear();
    this.processing4kTmdbIds.clear();
    this.failedTvdbIds.clear();
    this.failed4kTvdbIds.clear();
    this.tmdbIdsByTvdbId.clear();
    this.didScanStandard = false;
    this.didScan4k = false;
    this.serverReturnedEmpty = false;
    this.server4kReturnedEmpty = false;

    try {
      this.servers = uniqWith(settings.sonarr, (sonarrA, sonarrB) => {
        return (
          sonarrA.hostname === sonarrB.hostname &&
          sonarrA.port === sonarrB.port &&
          sonarrA.baseUrl === sonarrB.baseUrl
        );
      });

      for (const server of this.servers) {
        this.currentServer = server;
        if (server.syncEnabled) {
          this.log(
            `Beginning to process Sonarr server: ${server.name}`,
            'info'
          );

          this.sonarrApi = new SonarrAPI({
            apiKey: server.apiKey,
            url: SonarrAPI.buildUrl(server, '/api/v3'),
          });

          this.items = await this.sonarrApi.getSeries();

          const server4k = this.enable4kShow && server.is4k;
          if (server4k) {
            this.didScan4k = true;
          } else {
            this.didScanStandard = true;
          }

          if (this.items.length === 0) {
            if (server4k) {
              this.server4kReturnedEmpty = true;
            } else {
              this.serverReturnedEmpty = true;
            }
            this.log(
              `Sonarr server ${server.name} returned no series. Orphan cleanup for this profile type will be skipped.`,
              'warn'
            );
          }

          await this.loop(this.processSonarrSeries.bind(this), { sessionId });
        } else {
          this.log(`Sync not enabled. Skipping Sonarr server: ${server.name}`);
        }
      }

      // Only run cleanup if all servers of this profile type have sync enabled.
      // If any server is skipped, we can't distinguish truly orphaned media from
      // media that exists on an unscanned server (e.g. separate instances for
      // anime, regional content, or different languages).
      const allStandardScanned = this.servers
        .filter((s) => !this.enable4kShow || !s.is4k)
        .every((s) => s.syncEnabled);
      const all4kScanned = this.servers
        .filter((s) => this.enable4kShow && s.is4k)
        .every((s) => s.syncEnabled);

      if (!allStandardScanned) {
        this.didScanStandard = false;
      }
      if (!all4kScanned) {
        this.didScan4k = false;
      }

      if (this.serverReturnedEmpty) {
        this.didScanStandard = false;
      }
      if (this.server4kReturnedEmpty) {
        this.didScan4k = false;
      }

      // Orphaned seasons are queued for the resolve below.
      await this.cleanupOrphanedShows();

      await this.resolveStatusResets((media, is4k, seasonNumber) => {
        const scanComplete = is4k ? this.didScan4k : this.didScanStandard;
        const failedToScan = [
          ...(is4k ? this.failed4kTvdbIds : this.failedTvdbIds),
        ].some((tvdbId) => this.tmdbIdsByTvdbId.get(tvdbId) === media.tmdbId);
        const processingIds = is4k
          ? this.processing4kTmdbIds
          : this.processingTmdbIds;

        return (
          scanComplete &&
          !failedToScan &&
          (seasonNumber === undefined
            ? !processingIds.has(media.tmdbId)
            : !processingIds.get(media.tmdbId)?.has(seasonNumber))
        );
      });

      this.log('Sonarr scan complete', 'info');
    } catch (e) {
      this.log('Scan interrupted', 'error', { errorMessage: e.message });
    } finally {
      this.endRun(sessionId);
    }
  }

  private async processSonarrSeries(sonarrSeries: SonarrSeries) {
    const server4k = this.enable4kShow && this.currentServer.is4k;
    if (server4k) {
      this.scanned4kTvdbIds.add(sonarrSeries.tvdbId);
    } else {
      this.scannedTvdbIds.add(sonarrSeries.tvdbId);
    }

    try {
      const mediaRepository = getRepository(Media);
      const processableSeasons: ProcessableSeason[] = [];
      let tvShow: TmdbTvScanDetails | TmdbTvDetails;

      const media = await mediaRepository.findOne({
        where: { tvdbId: sonarrSeries.tvdbId },
      });

      if (!media || !media.tmdbId) {
        tvShow = await this.tmdb.getShowByTvdbIdForScan({
          tvdbId: sonarrSeries.tvdbId,
        });
      } else {
        tvShow = await this.tmdb.getTvShowForScan({ tvId: media.tmdbId });
      }

      const tmdbId = tvShow.id;
      this.tmdbIdsByTvdbId.set(sonarrSeries.tvdbId, tmdbId);
      (server4k ? this.scanned4kTmdbIds : this.scannedTmdbIds).add(tmdbId);
      tvShow = await this.applyMetadataProvider(tvShow);

      const settings = getSettings();

      const filteredSeasons = tvShow.seasons
        .filter(
          (sn) => settings.main.enableSpecialEpisodes || sn.season_number !== 0
        )
        .map((season) => {
          const sonarrSeason = sonarrSeries.seasons.find(
            (s) => s.seasonNumber === season.season_number
          );
          if (!sonarrSeason) {
            return {
              seasonNumber: season.season_number,
              episodeCount: season.episode_count,
              monitored: false,
              statistics: {
                episodeFileCount: 0,
                totalEpisodeCount: season.episode_count,
              },
            };
          } else {
            return sonarrSeason;
          }
        });

      for (const season of filteredSeasons) {
        const totalAvailableEpisodes = season.statistics?.episodeFileCount ?? 0;

        processableSeasons.push({
          seasonNumber: season.seasonNumber,
          episodes: !server4k ? totalAvailableEpisodes : 0,
          episodes4k: server4k ? totalAvailableEpisodes : 0,
          totalEpisodes: season.statistics?.totalEpisodeCount ?? 0,
          processing: season.monitored && totalAvailableEpisodes === 0,
          is4kOverride: server4k,
        });
      }

      const processing = server4k
        ? this.processing4kTmdbIds
        : this.processingTmdbIds;

      for (const season of processableSeasons) {
        if (season.processing) {
          processing.set(
            tmdbId,
            (processing.get(tmdbId) ?? new Set<number>()).add(
              season.seasonNumber
            )
          );
        }
      }

      await this.processShow(tmdbId, sonarrSeries.tvdbId, processableSeasons, {
        serviceId: this.currentServer.id,
        externalServiceId: sonarrSeries.id,
        externalServiceSlug: sonarrSeries.titleSlug,
        title: sonarrSeries.title,
        is4k: server4k,
      });
    } catch (e) {
      (server4k ? this.failed4kTvdbIds : this.failedTvdbIds).add(
        sonarrSeries.tvdbId
      );
      this.log('Failed to process Sonarr media', 'error', {
        errorMessage: e.message,
        title: sonarrSeries.title,
      });
    }
  }

  private async existsInAnyServer(
    tvdbId: number,
    is4k: boolean
  ): Promise<boolean> {
    const servers = this.servers.filter(
      (server) =>
        server.syncEnabled && (this.enable4kShow && server.is4k) === is4k
    );

    for (const server of servers) {
      try {
        const api = new SonarrAPI({
          apiKey: server.apiKey,
          url: SonarrAPI.buildUrl(server, '/api/v3'),
        });
        const series = await api.getLibrarySeriesByTvdbId(tvdbId);

        if (series.some((show) => show.tvdbId === tvdbId)) {
          return true;
        }
      } catch (e) {
        this.log(
          `Could not confirm series ${tvdbId} against Sonarr server ${server.name}. Skipping cleanup for it.`,
          'warn',
          { errorMessage: e.message }
        );
        return true;
      }
    }

    return false;
  }

  private async applyMetadataProvider(
    tvShow: TmdbTvScanDetails | TmdbTvDetails
  ): Promise<TmdbTvScanDetails | TmdbTvDetails> {
    const metadataProvider = tvShow.keywords.results.some(
      (keyword: TmdbKeyword) => keyword.id === ANIME_KEYWORD_ID
    )
      ? await getMetadataProvider('anime')
      : await getMetadataProvider('tv');

    if (!(metadataProvider instanceof TheMovieDb)) {
      tvShow = await metadataProvider.getTvShow({ tvId: tvShow.id });
    }

    return tvShow;
  }

  private async cleanupOrphanedShow(
    media: Media,
    is4k: boolean
  ): Promise<void> {
    const reason = `not found in any ${is4k ? '4K ' : ''}Sonarr server`;
    const statusField = is4k ? 'status4k' : 'status';
    const abandoned = new Set<number>();
    let resetSeason = false;

    for (const season of media.seasons) {
      if (season[statusField] === MediaStatus.PROCESSING) {
        season[statusField] = MediaStatus.UNKNOWN;
        resetSeason = true;
      } else if (season[statusField] !== MediaStatus.UNKNOWN) {
        continue;
      }

      abandoned.add(season.seasonNumber);
    }

    if (resetSeason || media[statusField] === MediaStatus.PROCESSING) {
      let seasons: ProcessableSeason[];

      try {
        // An orphan is a scan in which Sonarr carries none of the show's seasons.
        const tvShow = await this.applyMetadataProvider(
          await this.tmdb.getTvShowForScan({ tvId: media.tmdbId })
        );
        const settings = getSettings();

        seasons = tvShow.seasons
          .filter(
            (sn) =>
              settings.main.enableSpecialEpisodes || sn.season_number !== 0
          )
          .map((season) => ({
            seasonNumber: season.season_number,
            totalEpisodes: season.episode_count,
            episodes: 0,
            episodes4k: 0,
            is4kOverride: is4k,
          }));
      } catch (e) {
        this.log(
          `Could not look up the seasons of orphaned show ${media.tmdbId}. Skipping cleanup for it.`,
          'warn',
          { errorMessage: e.message }
        );
        return;
      }

      // With nothing scanned, the rollup would keep the show PROCESSING.
      media[statusField] = seasons.length
        ? this.rollUpShowStatus(media, seasons, is4k)
        : media[statusField] === MediaStatus.PROCESSING
          ? MediaStatus.UNKNOWN
          : media[statusField];
      await getRepository(Media).save(media);
      this.log(
        `Show ${media.tmdbId} (tvdb: ${media.tvdbId}) not found in any ${is4k ? '4K ' : ''}Sonarr server. ${is4k ? '4K status' : 'Status'} is now ${MediaStatus[media[statusField]]}.`,
        'info'
      );

      if (abandoned.size === 0 && media[statusField] === MediaStatus.UNKNOWN) {
        await this.declineOrphanedRequests(media, is4k, reason);
      }
    }

    for (const seasonNumber of abandoned) {
      this.recordSeasonReset(media.id, is4k, seasonNumber, [], reason);
    }
  }

  private async cleanupOrphanedShows(): Promise<void> {
    const mediaRepository = getRepository(Media);

    if (this.didScanStandard) {
      const processingShows = await mediaRepository.find({
        select: { id: true },
        where: [
          { mediaType: MediaType.TV, status: MediaStatus.PROCESSING },
          {
            mediaType: MediaType.TV,
            seasons: { status: MediaStatus.PROCESSING },
          },
          {
            mediaType: MediaType.TV,
            requests: { is4k: false, status: MediaRequestStatus.APPROVED },
          },
        ],
        loadEagerRelations: false,
      });

      for (const { id } of processingShows) {
        const media = await mediaRepository.findOne({
          where: { id },
          relations: { requests: true },
        });

        if (
          media?.tvdbId &&
          !this.scannedTvdbIds.has(media.tvdbId) &&
          !this.scannedTmdbIds.has(media.tmdbId)
        ) {
          if (await this.existsInAnyServer(media.tvdbId, false)) {
            continue;
          }

          await this.cleanupOrphanedShow(media, false);
        }
      }
    } else {
      this.log(
        'Skipping orphaned show cleanup: no standard Sonarr servers were scanned.',
        'info'
      );
    }

    if (this.didScan4k) {
      const processing4kShows = await mediaRepository.find({
        select: { id: true },
        where: [
          { mediaType: MediaType.TV, status4k: MediaStatus.PROCESSING },
          {
            mediaType: MediaType.TV,
            seasons: { status4k: MediaStatus.PROCESSING },
          },
          {
            mediaType: MediaType.TV,
            requests: { is4k: true, status: MediaRequestStatus.APPROVED },
          },
        ],
        loadEagerRelations: false,
      });

      for (const { id } of processing4kShows) {
        const media = await mediaRepository.findOne({
          where: { id },
          relations: { requests: true },
        });

        if (
          media?.tvdbId &&
          !this.scanned4kTvdbIds.has(media.tvdbId) &&
          !this.scanned4kTmdbIds.has(media.tmdbId)
        ) {
          if (await this.existsInAnyServer(media.tvdbId, true)) {
            continue;
          }

          await this.cleanupOrphanedShow(media, true);
        }
      }
    } else if (this.enable4kShow) {
      this.log(
        'Skipping orphaned 4K show cleanup: no 4K Sonarr servers were scanned.',
        'info'
      );
    }
  }
}

export const sonarrScanner = new SonarrScanner();
