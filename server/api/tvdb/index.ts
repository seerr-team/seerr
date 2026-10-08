import ExternalAPI from '@server/api/externalapi';
import type { TvShowProvider } from '@server/api/provider';
import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbSeasonWithEpisodes,
  TmdbTvDetails,
  TmdbTvEpisodeResult,
  TmdbTvSeasonResult,
} from '@server/api/themoviedb/interfaces';
import {
  TVDB_SOURCE_TYPE_TMDB_TV,
  convertTmdbLanguageToTvdbWithFallback,
  type TvdbBaseResponse,
  type TvdbEpisode,
  type TvdbLoginResponse,
  type TvdbOfficialSeason,
  type TvdbRemoteId,
  type TvdbSearchByRemoteIdResult,
  type TvdbSeasonDetails,
  type TvdbSeriesBaseRecord,
  type TvdbTvDetails,
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

        const validTvdbId = await this.getTvdbIdFromTmdb(tmdbTvShow);

        if (this.isValidTvdbId(validTvdbId)) {
          return this.enrichTmdbShowWithTvdbData(tmdbTvShow, validTvdbId);
        }

        return tmdbTvShow;
      } catch {
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

        const tvdbId = await this.getTvdbIdFromTmdb(tmdbTvShow);

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

        const tvdbId = await this.getTvdbIdFromTmdb(tmdbTvShow);

        if (!this.isValidTvdbId(tvdbId)) {
          return await this.tmdb.getTvSeason({ tvId, seasonNumber, language });
        }

        return await this.getTvdbSeasonData(
          tvdbId,
          seasonNumber,
          tvId,
          language
        );
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

  public async resolveTvdbId(tmdbId: number): Promise<number | null> {
    try {
      await this.refreshToken();

      const response = await this.get<
        TvdbBaseResponse<TvdbSearchByRemoteIdResult[]>
      >(
        `/search/remoteid/${tmdbId}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        },
        Tvdb.DEFAULT_CACHE_TTL
      );

      const candidates = (response?.data ?? [])
        .map((result) => result.series)
        .filter((series): series is TvdbSeriesBaseRecord => !!series);

      const matches: number[] = [];

      // the search matches a bare id against every remote source, so a hit can
      // be a series that merely shares the number in another id space
      for (const candidate of candidates) {
        const remoteIds = await this.fetchTvdbSeriesRemoteIds(candidate.id);

        if (
          remoteIds.some(
            (remoteId) =>
              remoteId.type === TVDB_SOURCE_TYPE_TMDB_TV &&
              String(remoteId.id) === String(tmdbId)
          )
        ) {
          matches.push(candidate.id);
        }
      }

      if (matches.length !== 1) {
        return null;
      }

      return matches[0];
    } catch (error) {
      logger.error(
        `[TVDB] Failed to resolve TVDB ID from TMDB ID ${tmdbId}: ${error.message}`
      );
      return null;
    }
  }

  public async getOfficialSeasons(
    tvdbId: number
  ): Promise<TvdbOfficialSeason[] | null> {
    await this.refreshToken();

    const tvdbData = await this.fetchTvdbShowData(tvdbId);

    // an incomplete record confirms nothing, unlike a show that really has
    // no official seasons
    if (!tvdbData?.seasons || !tvdbData.episodes) {
      return null;
    }

    return tvdbData.seasons
      .filter((season) => season.type?.type === 'official' && season.number > 0)
      .sort((a, b) => a.number - b.number)
      .map((season) => {
        // the season record's own year is null on this endpoint
        const years = tvdbData.episodes
          .filter((episode) => episode.seasonNumber === season.number)
          .map((episode) => Number(episode.aired?.slice(0, 4)))
          .filter((year) => !!year);

        return {
          seasonNumber: season.number,
          year: years.length ? Math.min(...years) : null,
        };
      });
  }

  private async fetchTvdbSeriesRemoteIds(
    tvdbId: number
  ): Promise<TvdbRemoteId[]> {
    const resp = await this.get<TvdbBaseResponse<TvdbTvDetails>>(
      `/series/${tvdbId}/extended`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      },
      Tvdb.DEFAULT_CACHE_TTL
    );

    return resp?.data?.remoteIds ?? [];
  }

  private async enrichTmdbShowWithTvdbData(
    tmdbTvShow: TmdbTvDetails,
    tvdbId: ValidTvdbId
  ): Promise<TmdbTvDetails> {
    const show = {
      ...tmdbTvShow,
      external_ids: { ...tmdbTvShow.external_ids, tvdb_id: tvdbId },
    };

    try {
      await this.refreshToken();

      const tvdbData = await this.fetchTvdbShowData(tvdbId);
      const seasons = this.processSeasons(tvdbData);

      if (!seasons.length) {
        return show;
      }

      return { ...show, seasons };
    } catch (error) {
      logger.error(
        `Failed to enrich TMDB show with TVDB data: ${error.message}`
      );
      return show;
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
    tvId: number,
    language: string = Tvdb.DEFAULT_LANGUAGE
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

    const wantedTranslation = convertTmdbLanguageToTvdbWithFallback(
      language,
      Tvdb.DEFAULT_LANGUAGE
    );

    // check if translation is available for the season
    const availableTranslation = season.nameTranslations.filter(
      (translation) =>
        translation === wantedTranslation ||
        translation === Tvdb.DEFAULT_LANGUAGE
    );

    if (!availableTranslation) {
      return this.getSeasonWithOriginalLanguage(
        tvdbId,
        tvId,
        seasonNumber,
        season
      );
    }

    return this.getSeasonWithTranslation(
      tvdbId,
      tvId,
      seasonNumber,
      season,
      wantedTranslation
    );
  }

  private async getSeasonWithTranslation(
    tvdbId: number,
    tvId: number,
    seasonNumber: number,
    season: TvdbSeasonDetails,
    language: string
  ): Promise<TmdbSeasonWithEpisodes> {
    if (!season) {
      logger.error(
        `Failed to find season ${seasonNumber} for TVDB ID: ${tvdbId}`
      );
      return this.createEmptySeasonResponse(tvId);
    }

    const allEpisodes = [] as TvdbEpisode[];
    let page = 0;
    // Limit to max 50 pages to avoid infinite loops.
    // 50 pages with 500 items per page = 25_000 episodes in a series which should be more than enough
    const maxPages = 50;

    while (page < maxPages) {
      const resp = await this.get<TvdbBaseResponse<TvdbSeasonDetails>>(
        `/series/${tvdbId}/episodes/default/${language}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          params: {
            page: page,
          },
        }
      );

      if (!resp?.data?.episodes) {
        logger.warn(
          `No episodes found for TVDB ID: ${tvdbId} on page ${page} for season ${seasonNumber}`
        );
        break;
      }

      const { episodes } = resp.data;

      if (!episodes) {
        logger.debug(
          `No more episodes found for TVDB ID: ${tvdbId} on page ${page} for season ${seasonNumber}`
        );
        break;
      }

      allEpisodes.push(...episodes);

      const hasNextPage = resp.links?.next && episodes.length > 0;

      if (!hasNextPage) {
        break;
      }

      page++;
    }

    if (page >= maxPages) {
      logger.warn(
        `Reached max pages (${maxPages}) for TVDB ID: ${tvdbId} on season ${seasonNumber} with language ${language}. There might be more episodes available.`
      );
    }

    const episodes = this.processEpisodes(
      { ...season, episodes: allEpisodes },
      seasonNumber,
      tvId
    );

    return {
      episodes,
      external_ids: { tvdb_id: tvdbId },
      name: '',
      overview: '',
      id: season.id,
      air_date: season.firstAired,
      season_number: episodes.length,
    };
  }

  private async getSeasonWithOriginalLanguage(
    tvdbId: number,
    tvId: number,
    seasonNumber: number,
    season: TvdbSeasonDetails
  ): Promise<TmdbSeasonWithEpisodes> {
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
      still_path:
        episode.image && !episode.image.startsWith('https://')
          ? 'https://artworks.thetvdb.com' + episode.image
          : '',
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

  private async getTvdbIdFromTmdb(tmdbTvShow: TmdbTvDetails): Promise<TvdbId> {
    const tvdbId = tmdbTvShow?.external_ids?.tvdb_id;

    if (tvdbId) {
      return tvdbId;
    }

    return (await this.resolveTvdbId(tmdbTvShow.id)) ?? TvdbIdStatus.INVALID;
  }

  private isValidTvdbId(tvdbId: TvdbId): tvdbId is ValidTvdbId {
    return tvdbId !== TvdbIdStatus.INVALID;
  }

  private handleError(context: string, error: Error): void {
    throw new Error(`[TVDB] ${context}: ${error.message}`);
  }
}

export default Tvdb;
