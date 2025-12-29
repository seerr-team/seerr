import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

interface InstanceAvailability {
  hasStandard: boolean;
  has4k: boolean;
  serviceStandardId?: number;
  service4kId?: number;
  externalStandardId?: number;
  external4kId?: number;
}

interface SeasonInstanceAvailability {
  seasonNumber: number;
  episodesStandard: number;
  episodes4k: number;
}

interface ShowInstanceAvailability extends InstanceAvailability {
  seasons: SeasonInstanceAvailability[];
}

class ServiceAvailabilityChecker {
  private movieCache: Map<number, InstanceAvailability>;
  private showCache: Map<number, ShowInstanceAvailability>;

  constructor() {
    this.movieCache = new Map();
    this.showCache = new Map();
  }

  public clearCache(): void {
    this.movieCache.clear();
    this.showCache.clear();
  }

  public async checkMovieAvailability(
    tmdbid: number
  ): Promise<InstanceAvailability> {
    const cached = this.movieCache.get(tmdbid);
    if (cached) {
      return cached;
    }

    const settings = getSettings();
    const result: InstanceAvailability = {
      hasStandard: false,
      has4k: false,
    };

    if (!settings.radarr || settings.radarr.length === 0) {
      return result;
    }

    for (const radarrSettings of settings.radarr) {
      try {
        const radarr = this.createRadarrClient(radarrSettings);
        const movie = await radarr.getMovieByTmdbId(tmdbid);

        if (movie?.hasFile) {
          if (radarrSettings.is4k) {
            result.has4k = true;
            result.service4kId = radarrSettings.id;
            result.external4kId = movie.id;
          } else {
            result.hasStandard = true;
            result.serviceStandardId = radarrSettings.id;
            result.externalStandardId = movie.id;
          }
        }

        logger.debug(
          `Found movie (TMDB: ${tmdbid}) in ${
            radarrSettings.is4k ? '4K' : 'Standard'
          } Radarr instance (name: ${radarrSettings.name})`,
          {
            label: 'Service Availability',
            radarrId: radarrSettings.id,
            movieId: movie?.id,
          }
        );
      } catch {
        // movie not found in this instance, continue
      }
    }

    this.movieCache.set(tmdbid, result);
    return result;
  }

  public async checkShowAvailability(
    tvdbid: number
  ): Promise<ShowInstanceAvailability> {
    const cached = this.showCache.get(tvdbid);
    if (cached) {
      return cached;
    }

    const settings = getSettings();
    const result: ShowInstanceAvailability = {
      hasStandard: false,
      has4k: false,
      seasons: [],
    };

    if (!settings.sonarr || settings.sonarr.length === 0) {
      return result;
    }
    const standardSeasons = new Map<number, number>();
    const seasons4k = new Map<number, number>();

    for (const sonarrSettings of settings.sonarr) {
      try {
        const sonarr = this.createSonarrClient(sonarrSettings);
        const series = await sonarr.getSeriesByTvdbId(tvdbid);

        if (series?.id && series.statistics?.episodeFileCount > 0) {
          if (sonarrSettings.is4k) {
            result.has4k = true;
            result.service4kId = sonarrSettings.id;
            result.external4kId = series.id;
          } else {
            result.hasStandard = true;
            result.serviceStandardId = sonarrSettings.id;
            result.externalStandardId = series.id;
          }

          for (const season of series.seasons) {
            const episodeCount = season.statistics?.episodeFileCount ?? 0;
            if (episodeCount > 0) {
              const targetMap = sonarrSettings.is4k
                ? seasons4k
                : standardSeasons;
              const current = targetMap.get(season.seasonNumber) ?? 0;
              targetMap.set(
                season.seasonNumber,
                Math.max(current, episodeCount)
              );
            }
          }

          logger.debug(
            `Found series (TVDB: ${tvdbid}) in ${
              sonarrSettings.is4k ? '4K' : 'Standard'
            } Sonarr instance (name: ${sonarrSettings.name}`,
            {
              label: 'Service Availability',
              sonarrId: sonarrSettings.id,
              seriesId: series.id,
            }
          );
        }
      } catch {
        // series not found in this instance, continue
      }
    }

    const allSeasonNumbers = new Set({
      ...standardSeasons.keys(),
      ...seasons4k.keys(),
    });

    result.seasons = Array.from(allSeasonNumbers).map((seasonNumber) => ({
      seasonNumber,
      episodesStandard: standardSeasons.get(seasonNumber) ?? 0,
      episodes4k: seasons4k.get(seasonNumber) ?? 0,
    }));

    this.showCache.set(tvdbid, result);
    return result;
  }

  private createRadarrClient(settings: RadarrSettings): RadarrAPI {
    return new RadarrAPI({
      url: RadarrAPI.buildUrl(settings, '/api/v3'),
      apiKey: settings.apiKey,
    });
  }

  private createSonarrClient(settings: SonarrSettings): SonarrAPI {
    return new SonarrAPI({
      url: SonarrAPI.buildUrl(settings, '/api/v3'),
      apiKey: settings.apiKey,
    });
  }
}

const serviceAvailabilityChecker = new ServiceAvailabilityChecker();

export default serviceAvailabilityChecker;
