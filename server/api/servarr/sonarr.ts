import logger from '@server/logger';
import ServarrBase from './base';

export interface SonarrSeason {
  seasonNumber: number;
  monitored: boolean;
  statistics?: {
    previousAiring?: string;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
}
interface EpisodeResult {
  seriesId: number;
  episodeFileId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  airDateUtc: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
  absoluteEpisodeNumber: number;
  unverifiedSceneNumbering: boolean;
  id: number;
}

export interface SonarrSeries {
  title: string;
  sortTitle: string;
  seasonCount: number;
  status: string;
  overview: string;
  network: string;
  airTime: string;
  images: {
    coverType: string;
    url: string;
  }[];
  remotePoster: string;
  seasons: SonarrSeason[];
  year: number;
  path: string;
  profileId: number;
  languageProfileId: number;
  seasonFolder: boolean;
  monitored: boolean;
  useSceneNumbering: boolean;
  runtime: number;
  tvdbId: number;
  tvRageId: number;
  tvMazeId: number;
  firstAired: string;
  lastInfoSync?: string;
  seriesType: 'standard' | 'daily' | 'anime';
  cleanTitle: string;
  imdbId: string;
  titleSlug: string;
  certification: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: {
    votes: number;
    value: number;
  };
  qualityProfileId: number;
  id?: number;
  rootFolderPath?: string;
  addOptions?: {
    ignoreEpisodesWithFiles?: boolean;
    ignoreEpisodesWithoutFiles?: boolean;
    searchForMissingEpisodes?: boolean;
    monitor?: 'firstSeason' | 'latestSeason' | 'none';
  };
  monitorNewItems?: string;
  statistics: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    releaseGroups: string[];
    percentOfEpisodes: number;
  };
}

export interface AddSeriesOptions {
  tvdbid: number;
  title: string;
  profileId: number;
  languageProfileId?: number;
  seasons: number[];
  seasonFolder: boolean;
  rootFolderPath: string;
  tags?: number[];
  seriesType: SonarrSeries['seriesType'];
  monitored?: boolean;
  searchNow?: boolean;
  monitorNewItems?: string;
}

export interface LanguageProfile {
  id: number;
  name: string;
}

class SonarrAPI extends ServarrBase<{
  seriesId: number;
  episodeId: number;
  episode: EpisodeResult;
}> {
  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    super({ url, apiKey, apiName: 'Sonarr', cacheName: 'sonarr' });
  }

  public async getSeries(): Promise<SonarrSeries[]> {
    try {
      const data = await this.get<SonarrSeries[]>('/series');

      return data;
    } catch (e) {
      throw new Error(`[Sonarr] Failed to retrieve series: ${e.message}`);
    }
  }

  public async getSeriesById(id: number): Promise<SonarrSeries> {
    try {
      const data = await this.get<SonarrSeries>(`/series/${id}`);

      return data;
    } catch (e) {
      throw new Error(`[Sonarr] Failed to retrieve series by ID: ${e.message}`);
    }
  }

  public async getSeriesByTitle(title: string): Promise<SonarrSeries[]> {
    try {
      const data = await this.get<SonarrSeries[]>('/series/lookup', {
        term: title,
      });

      if (!data[0]) {
        throw new Error('No series found');
      }

      return data;
    } catch (e) {
      logger.error('Error retrieving series by series title', {
        label: 'Sonarr API',
        errorMessage: e.message,
        title,
      });
      throw new Error('No series found');
    }
  }

  public async getSeriesByTvdbId(id: number): Promise<SonarrSeries> {
    try {
      const data = await this.get<SonarrSeries[]>('/series/lookup', {
        term: `tvdb:${id}`,
      });

      if (!data[0]) {
        throw new Error('Series not found');
      }

      return data[0];
    } catch (e) {
      logger.error('Error retrieving series by tvdb ID', {
        label: 'Sonarr API',
        errorMessage: e.message,
        tvdbId: id,
      });
      throw new Error('Series not found');
    }
  }

  public async addSeries(options: AddSeriesOptions): Promise<SonarrSeries> {
    try {
      const series = await this.getSeriesByTvdbId(options.tvdbid);

      // If the series already exists, we will simply just update it
      if (series.id) {
        series.monitored = options.monitored ?? series.monitored;
        series.tags = options.tags ?? series.tags;
        series.seasons = this.buildSeasonList(options.seasons, series.seasons);

        const newSeriesData = await this.put<SonarrSeries>(
          '/series',
          series as any
        );

        if (newSeriesData.id) {
          logger.info('Updated existing series in Sonarr.', {
            label: 'Sonarr',
            seriesId: newSeriesData.id,
            seriesTitle: newSeriesData.title,
          });
          logger.debug('Sonarr update details', {
            label: 'Sonarr',
            movie: newSeriesData,
          });

          if (options.searchNow) {
            this.searchSeries(newSeriesData.id);
          }

          return newSeriesData;
        } else {
          logger.error('Failed to update series in Sonarr', {
            label: 'Sonarr',
            options,
          });
          throw new Error('Failed to update series in Sonarr');
        }
      }

      const createdSeriesData = await this.post<SonarrSeries>('/series', {
        tvdbId: options.tvdbid,
        title: options.title,
        qualityProfileId: options.profileId,
        languageProfileId: options.languageProfileId,
        seasons: this.buildSeasonList(
          options.seasons,
          series.seasons.map((season) => ({
            seasonNumber: season.seasonNumber,
            // We force all seasons to false if its the first request
            monitored: false,
          }))
        ),
        tags: options.tags,
        seasonFolder: options.seasonFolder,
        monitored: options.monitored,
        monitorNewItems: options.monitorNewItems,
        rootFolderPath: options.rootFolderPath,
        seriesType: options.seriesType,
        addOptions: {
          ignoreEpisodesWithFiles: true,
          searchForMissingEpisodes: options.searchNow,
        },
      } as Partial<SonarrSeries>);

      if (createdSeriesData.id) {
        logger.info('Sonarr accepted request', { label: 'Sonarr' });
        logger.debug('Sonarr add details', {
          label: 'Sonarr',
          movie: createdSeriesData,
        });
      } else {
        logger.error('Failed to add movie to Sonarr', {
          label: 'Sonarr',
          options,
        });
        throw new Error('Failed to add series to Sonarr');
      }

      return createdSeriesData;
    } catch (e) {
      let errorData;
      try {
        errorData = await e.cause?.text();
        errorData = JSON.parse(errorData);
      } catch {
        /* empty */
      }
      logger.error('Something went wrong while adding a series to Sonarr.', {
        label: 'Sonarr API',
        errorMessage: e.message,
        options,
        response: errorData,
      });
      throw new Error('Failed to add series');
    }
  }

  public async getLanguageProfiles(): Promise<LanguageProfile[]> {
    try {
      const data = await this.getRolling<LanguageProfile[]>(
        '/languageprofile',
        undefined,
        3600
      );

      return data;
    } catch (e) {
      logger.error(
        'Something went wrong while retrieving Sonarr language profiles.',
        {
          label: 'Sonarr API',
          errorMessage: e.message,
        }
      );

      throw new Error('Failed to get language profiles');
    }
  }

  public async searchSeries(seriesId: number): Promise<void> {
    logger.info('Executing series search command.', {
      label: 'Sonarr API',
      seriesId,
    });

    try {
      await this.runCommand('MissingEpisodeSearch', { seriesId });
    } catch (e) {
      logger.error(
        'Something went wrong while executing Sonarr missing episode search.',
        {
          label: 'Sonarr API',
          errorMessage: e.message,
          seriesId,
        }
      );
    }
  }

  private buildSeasonList(
    seasons: number[],
    existingSeasons?: SonarrSeason[]
  ): SonarrSeason[] {
    if (existingSeasons) {
      const newSeasons = existingSeasons.map((season) => {
        if (seasons.includes(season.seasonNumber)) {
          season.monitored = true;
        }
        return season;
      });

      return newSeasons;
    }

    const newSeasons = seasons.map(
      (seasonNumber): SonarrSeason => ({
        seasonNumber,
        monitored: true,
      })
    );

    return newSeasons;
  }

  public removeSerie = async (serieId: number): Promise<void> => {
    try {
      const { id, title } = await this.getSeriesByTvdbId(serieId);
      await this.delete(`/series/${id}`, {
        deleteFiles: 'true',
        addImportExclusion: 'false',
      });
      logger.info(`[Radarr] Removed serie ${title}`);
    } catch (e) {
      throw new Error(`[Radarr] Failed to remove serie: ${e.message}`);
    }
  };

  public clearCache = ({
    tvdbId,
    externalId,
    title,
  }: {
    tvdbId?: number | null;
    externalId?: number | null;
    title?: string | null;
  }) => {
    if (tvdbId) {
      this.removeCache('/series/lookup', {
        term: `tvdb:${tvdbId}`,
      });
    }
    if (externalId) {
      this.removeCache(`/series/${externalId}`);
    }
    if (title) {
      this.removeCache('/series/lookup', {
        term: title,
      });
    }
  };
}

export default SonarrAPI;
