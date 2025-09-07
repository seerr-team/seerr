import ExternalAPI from '@server/api/externalapi';
import type { TvShowProvider } from '@server/api/provider';
import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbSeasonWithEpisodes,
  TmdbTvDetails,
  TmdbTvEpisodeResult,
  TmdbTvSeasonResult,
} from '@server/api/themoviedb/interfaces';
import type {
  TvdbBaseResponse,
  TvdbEpisode,
  TvdbLoginResponse,
  TvdbSeasonDetails,
  TvdbTvDetails,
} from '@server/api/tvdb/interfaces';
import cacheManager, { type AvailableCacheIds } from '@server/lib/cache';
import logger from '@server/logger';

interface TvdbConfig {
  baseUrl: string;
  maxRequestsPerSecond: number;
  maxRequests: number;
  cachePrefix: AvailableCacheIds;
}

const DEFAULT_CONFIG: TvdbConfig = {
  baseUrl: 'https://api4.thetvdb.com/v4',
  maxRequestsPerSecond: 50,
  maxRequests: 20,
  cachePrefix: 'tvdb' as const,
};

const enum TvdbIdStatus {
  INVALID = -1,
}

type TvdbId = number;
type ValidTvdbId = Exclude<TvdbId, TvdbIdStatus.INVALID>;

class Tvdb extends ExternalAPI implements TvShowProvider {
  static instance: Tvdb;
  private readonly tmdb: TheMovieDb;
  private static readonly DEFAULT_CACHE_TTL = 43200;
  private static readonly DEFAULT_LANGUAGE = 'eng';
  private token: string;
  private pin?: string;

  constructor(pin?: string) {
    const finalConfig = { ...DEFAULT_CONFIG };
    super(
      finalConfig.baseUrl,
      {},
      {
        nodeCache: cacheManager.getCache(finalConfig.cachePrefix).data,
        rateLimit: {
          maxRequests: finalConfig.maxRequests,
          maxRPS: finalConfig.maxRequestsPerSecond,
        },
      }
    );
    this.pin = pin;
    this.tmdb = new TheMovieDb();
  }

  public static async getInstance(): Promise<Tvdb> {
    if (!this.instance) {
      this.instance = new Tvdb();
      await this.instance.login();
    }

    return this.instance;
  }

  private async refreshToken(): Promise<void> {
    try {
      if (!this.token) {
        await this.login();
        return;
      }

      const base64Url = this.token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString());

      if (!payload.exp) {
        await this.login();
      }

      const now = Math.floor(Date.now() / 1000);
      const diff = payload.exp - now;

      // refresh token 1 week before expiration
      if (diff < 604800) {
        await this.login();
      }
    } catch (error) {
      this.handleError('Failed to refresh token', error);
    }
  }

  public async test(): Promise<void> {
    try {
      await this.login();
    } catch (error) {
      this.handleError('Login failed', error);
      throw error;
    }
  }

  async login(): Promise<TvdbLoginResponse> {
    let body: { apiKey: string; pin?: string } = {
      apiKey: 'd00d9ecb-a9d0-4860-958a-74b14a041405',
    };

    if (this.pin) {
      body = {
        ...body,
        pin: this.pin,
      };
    }

    const response = await this.post<TvdbBaseResponse<TvdbLoginResponse>>(
      '/login',
      {
        ...body,
      }
    );

    this.token = response.data.token;

    return response.data;
  }

  public async getShowByTvdbId({
    tvdbId,
    language,
  }: {
    tvdbId: number;
    language?: string;
  }): Promise<TmdbTvDetails> {
    try {
      const tmdbTvShow = await this.tmdb.getShowByTvdbId({
        tvdbId: tvdbId,
        language,
      });

      try {
        await this.refreshToken();

        const validTvdbId = this.getTvdbIdFromTmdb(tmdbTvShow);

        if (this.isValidTvdbId(validTvdbId)) {
          return this.enrichTmdbShowWithTvdbData(tmdbTvShow, validTvdbId);
        }

        return tmdbTvShow;
      } catch (error) {
        return tmdbTvShow;
      }
    } catch (error) {
      this.handleError('Failed to fetch TV show details', error);
      throw error;
    }
  }

  public async getTvShow({
    tvId,
    language,
  }: {
    tvId: number;
    language?: string;
  }): Promise<TmdbTvDetails> {
    try {
      const tmdbTvShow = await this.tmdb.getTvShow({ tvId, language });

      try {
        await this.refreshToken();

        const tvdbId = this.getTvdbIdFromTmdb(tmdbTvShow);

        if (this.isValidTvdbId(tvdbId)) {
          return await this.enrichTmdbShowWithTvdbData(tmdbTvShow, tvdbId);
        }

        return tmdbTvShow;
      } catch (error) {
        this.handleError('Failed to fetch TV show details', error);
        return tmdbTvShow;
      }
    } catch (error) {
      this.handleError('Failed to fetch TV show details', error);
      return this.tmdb.getTvShow({ tvId, language });
    }
  }

  public async getTvSeason({
    tvId,
    seasonNumber,
    language = Tvdb.DEFAULT_LANGUAGE,
  }: {
    tvId: number;
    seasonNumber: number;
    language?: string;
  }): Promise<TmdbSeasonWithEpisodes> {
    try {
      const tmdbTvShow = await this.tmdb.getTvShow({ tvId, language });

      try {
        await this.refreshToken();

        const tvdbId = this.getTvdbIdFromTmdb(tmdbTvShow);

        if (!this.isValidTvdbId(tvdbId)) {
          return await this.tmdb.getTvSeason({ tvId, seasonNumber, language });
        }

        return await this.getTvdbSeasonData(tvdbId, seasonNumber, tvId);
      } catch (error) {
        this.handleError('Failed to fetch TV season details', error);
        return await this.tmdb.getTvSeason({ tvId, seasonNumber, language });
      }
    } catch (error) {
      logger.error(
        `[TVDB] Failed to fetch TV season details: ${error.message}`
      );
      throw error;
    }
  }

  private async enrichTmdbShowWithTvdbData(
    tmdbTvShow: TmdbTvDetails,
    tvdbId: ValidTvdbId
  ): Promise<TmdbTvDetails> {
    try {
      await this.refreshToken();

      const tvdbData = await this.fetchTvdbShowData(tvdbId);
      const seasons = this.processSeasons(tvdbData);

      if (!seasons.length) {
        return tmdbTvShow;
      }

      return { ...tmdbTvShow, seasons };
    } catch (error) {
      logger.error(
        `Failed to enrich TMDB show with TVDB data: ${error.message} token: ${this.token}`
      );
      return tmdbTvShow;
    }
  }

  private async fetchTvdbShowData(tvdbId: number): Promise<TvdbTvDetails> {
    const resp = await this.get<TvdbBaseResponse<TvdbTvDetails>>(
      `/series/${tvdbId}/extended?meta=episodes&short=true`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      },
      Tvdb.DEFAULT_CACHE_TTL
    );

    return resp.data;
  }

  private processSeasons(tvdbData: TvdbTvDetails): TmdbTvSeasonResult[] {
    if (!tvdbData || !tvdbData.seasons || !tvdbData.episodes) {
      return [];
    }

    const seasons = tvdbData.seasons
      .filter((season) => season.type && season.type.type === 'official')
      .sort((a, b) => a.number - b.number)
      .map((season) => this.createSeasonData(season, tvdbData))
      .filter(
        (season) => season && season.season_number >= 0
      ) as TmdbTvSeasonResult[];

    return seasons;
  }

  private createSeasonData(
    season: TvdbSeasonDetails,
    tvdbData: TvdbTvDetails
  ): TmdbTvSeasonResult {
    const seasonNumber = season.number ?? -1;
    if (seasonNumber < 0) {
      return {
        id: 0,
        episode_count: 0,
        name: '',
        overview: '',
        season_number: -1,
        poster_path: '',
        air_date: '',
      };
    }

    const episodeCount = tvdbData.episodes.filter(
      (episode) => episode.seasonNumber === season.number
    ).length;

    return {
      id: tvdbData.id,
      episode_count: episodeCount,
      name: `${season.number}`,
      overview: '',
      season_number: season.number,
      poster_path: '',
      air_date: '',
    };
  }

  private async getTvdbSeasonData(
    tvdbId: number,
    seasonNumber: number,
    tvId: number
    //language: string = Tvdb.DEFAULT_LANGUAGE
  ): Promise<TmdbSeasonWithEpisodes> {
    const tvdbData = await this.fetchTvdbShowData(tvdbId);

    if (!tvdbData) {
      logger.error(`Failed to fetch TVDB data for ID: ${tvdbId}`);
      return this.createEmptySeasonResponse(tvId);
    }

    // get season id
    const season = tvdbData.seasons.find(
      (season) =>
        season.number === seasonNumber &&
        season.type.type &&
        season.type.type === 'official'
    );

    if (!season) {
      logger.error(
        `Failed to find season ${seasonNumber} for TVDB ID: ${tvdbId}`
      );
      return this.createEmptySeasonResponse(tvId);
    }

    const resp = await this.get<TvdbBaseResponse<TvdbSeasonDetails>>(
      `/seasons/${season.id}/extended`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    const seasons = resp.data;

    const episodes = this.processEpisodes(seasons, seasonNumber, tvId);

    return {
      episodes,
      external_ids: { tvdb_id: tvdbId },
      name: '',
      overview: '',
      id: seasons.id,
      air_date: seasons.firstAired,
      season_number: episodes.length,
    };
  }

  private processEpisodes(
    tvdbSeason: TvdbSeasonDetails,
    seasonNumber: number,
    tvId: number
  ): TmdbTvEpisodeResult[] {
    if (!tvdbSeason || !tvdbSeason.episodes) {
      logger.error('No episodes found in TVDB season data');
      return [];
    }

    return tvdbSeason.episodes
      .filter((episode) => episode.seasonNumber === seasonNumber)
      .map((episode, index) => this.createEpisodeData(episode, index, tvId));
  }

  private createEpisodeData(
    episode: TvdbEpisode,
    index: number,
    tvId: number
  ): TmdbTvEpisodeResult {
    return {
      id: episode.id,
      air_date: episode.aired,
      episode_number: episode.number,
      name: episode.name || `Episode ${index + 1}`,
      overview: episode.overview || '',
      season_number: episode.seasonNumber,
      production_code: '',
      show_id: tvId,
      still_path: episode.image ? episode.image : '',
      vote_average: 1,
      vote_count: 1,
    };
  }

  private createEmptySeasonResponse(tvId: number): TmdbSeasonWithEpisodes {
    return {
      episodes: [],
      external_ids: { tvdb_id: tvId },
      name: '',
      overview: '',
      id: 0,
      air_date: '',
      season_number: 0,
    };
  }

  private getTvdbIdFromTmdb(tmdbTvShow: TmdbTvDetails): TvdbId {
    return tmdbTvShow?.external_ids?.tvdb_id ?? TvdbIdStatus.INVALID;
  }

  private isValidTvdbId(tvdbId: TvdbId): tvdbId is ValidTvdbId {
    return tvdbId !== TvdbIdStatus.INVALID;
  }

  private handleError(context: string, error: Error): void {
    throw new Error(`[TVDB] ${context}: ${error.message}`);
  }
}

export default Tvdb;
