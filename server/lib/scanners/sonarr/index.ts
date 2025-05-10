import type { SonarrSeries } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import type { TmdbTvDetails } from '@server/api/themoviedb/interfaces';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import type { SonarrSettings } from '@server/interfaces/settings';
import type {
  ProcessableSeason,
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import BaseScanner from '@server/lib/scanners/baseScanner';
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
  private servers: SonarrSettings[];
  private currentServer: SonarrSettings;
  private sonarrApi: SonarrAPI;

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

          await this.loop(this.processSonarrSeries.bind(this), { sessionId });
        } else {
          this.log(`Sync not enabled. Skipping Sonarr server: ${server.name}`);
        }
      }

      this.log('Sonarr scan complete', 'info');
    } catch (e) {
      this.log('Scan interrupted', 'error', { errorMessage: e.message });
    } finally {
      this.endRun(sessionId);
    }
  }

  private async processSonarrSeries(sonarrSeries: SonarrSeries) {
    try {
      const mediaRepository = getRepository(Media);
      const server4k = this.enable4kShow && this.currentServer.is4k;
      const processableSeasons: ProcessableSeason[] = [];
      let tvShow: TmdbTvDetails;

      const media = await mediaRepository.findOne({
        where: { tvdbId: sonarrSeries.tvdbId },
      });

      if (!media || !media.tmdbId) {
        tvShow = await this.tmdb.getShowByTvdbId({
          tvdbId: sonarrSeries.tvdbId,
        });
      } else {
        tvShow = await this.tmdb.getTvShow({ tvId: media.tmdbId });
      }

      const tmdbId = tvShow.id;
      const settings = getSettings();

      const filteredSeasons = sonarrSeries.seasons.filter(
        (sn) =>
          tvShow.seasons.find((s) => s.season_number === sn.seasonNumber) &&
          (!settings.main.enableSpecialEpisodes ? sn.seasonNumber !== 0 : true)
      );

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

      await this.processShow(tmdbId, sonarrSeries.tvdbId, processableSeasons, {
        serviceId: this.currentServer.id,
        externalServiceId: sonarrSeries.id,
        externalServiceSlug: sonarrSeries.titleSlug,
        title: sonarrSeries.title,
        is4k: server4k,
      });
    } catch (e) {
      this.log('Failed to process Sonarr media', 'error', {
        errorMessage: e.message,
        title: sonarrSeries.title,
      });
    }
  }
}

export const sonarrScanner = new SonarrScanner();
