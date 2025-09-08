import ExternalAPI from '@server/api/externalapi';
import type { TvShowProvider } from '@server/api/provider';
import cacheManager from '@server/lib/cache';
import { getSettings } from '@server/lib/settings';
import { sortBy } from 'lodash';
import type {
  TmdbCollection,
  TmdbCompanySearchResponse,
  TmdbExternalIdResponse,
  TmdbGenre,
  TmdbGenresResult,
  TmdbKeyword,
  TmdbKeywordSearchResponse,
  TmdbLanguage,
  TmdbMovieDetails,
  TmdbNetwork,
  TmdbPersonCombinedCredits,
  TmdbPersonDetails,
  TmdbProductionCompany,
  TmdbRegion,
  TmdbSearchMovieResponse,
  TmdbSearchMultiResponse,
  TmdbSearchTvResponse,
  TmdbSeasonWithEpisodes,
  TmdbTvDetails,
  TmdbUpcomingMoviesResponse,
  TmdbWatchProviderDetails,
  TmdbWatchProviderRegion,
} from './interfaces';

interface SearchOptions {
  query: string;
  page?: number;
  includeAdult?: boolean;
  language?: string;
}

interface SingleSearchOptions extends SearchOptions {
  year?: number;
}

export const SortOptionsIterable = [
  'popularity.desc',
  'popularity.asc',
  'release_date.desc',
  'release_date.asc',
  'revenue.desc',
  'revenue.asc',
  'primary_release_date.desc',
  'primary_release_date.asc',
  'original_title.asc',
  'original_title.desc',
  'vote_average.desc',
  'vote_average.asc',
  'vote_count.desc',
  'vote_count.asc',
  'first_air_date.desc',
  'first_air_date.asc',
] as const;

export type SortOptions = (typeof SortOptionsIterable)[number];

export interface TmdbCertificationResponse {
  certifications: {
    [country: string]: {
      certification: string;
      meaning?: string;
      order?: number;
    }[];
  };
}

interface DiscoverMovieOptions {
  page?: number;
  includeAdult?: boolean;
  language?: string;
  primaryReleaseDateGte?: string;
  primaryReleaseDateLte?: string;
  withRuntimeGte?: string;
  withRuntimeLte?: string;
  voteAverageGte?: string;
  voteAverageLte?: string;
  voteCountGte?: string;
  voteCountLte?: string;
  originalLanguage?: string;
  genre?: string;
  studio?: string;
  keywords?: string;
  sortBy?: SortOptions;
  watchRegion?: string;
  watchProviders?: string;
  certification?: string;
  certificationGte?: string;
  certificationLte?: string;
  certificationCountry?: string;
}

interface DiscoverTvOptions {
  page?: number;
  language?: string;
  firstAirDateGte?: string;
  firstAirDateLte?: string;
  withRuntimeGte?: string;
  withRuntimeLte?: string;
  voteAverageGte?: string;
  voteAverageLte?: string;
  voteCountGte?: string;
  voteCountLte?: string;
  includeEmptyReleaseDate?: boolean;
  originalLanguage?: string;
  genre?: string;
  network?: number;
  keywords?: string;
  sortBy?: SortOptions;
  watchRegion?: string;
  watchProviders?: string;
  withStatus?: string; // Returning Series: 0 Planned: 1 In Production: 2 Ended: 3 Cancelled: 4 Pilot: 5
  certification?: string;
  certificationGte?: string;
  certificationLte?: string;
  certificationCountry?: string;
}

class TheMovieDb extends ExternalAPI implements TvShowProvider {
  private locale: string;
  private discoverRegion?: string;
  private originalLanguage?: string;
  constructor({
    discoverRegion,
    originalLanguage,
  }: { discoverRegion?: string; originalLanguage?: string } = {}) {
    super(
      'https://api.themoviedb.org/3',
      {
        api_key: '431a8708161bcd1f1fbe7536137e61ed',
      },
      {
        nodeCache: cacheManager.getCache('tmdb').data,
        rateLimit: {
          maxRequests: 20,
          maxRPS: 50,
        },
      }
    );
    this.locale = getSettings().main?.locale || 'en';
    this.discoverRegion = discoverRegion;
    this.originalLanguage = originalLanguage;
  }

  public searchMulti = async ({
    query,
    page = 1,
    includeAdult = false,
    language = this.locale,
  }: SearchOptions): Promise<TmdbSearchMultiResponse> => {
    try {
      const data = await this.get<TmdbSearchMultiResponse>('/search/multi', {
        params: { query, page, include_adult: includeAdult, language },
      });

      return data;
    } catch (e) {
      return {
        page: 1,
        results: [],
        total_pages: 1,
        total_results: 0,
      };
    }
  };

  public searchMovies = async ({
    query,
    page = 1,
    includeAdult = false,
    language = this.locale,
    year,
  }: SingleSearchOptions): Promise<TmdbSearchMovieResponse> => {
    try {
      const data = await this.get<TmdbSearchMovieResponse>('/search/movie', {
        params: {
          query,
          page,
          include_adult: includeAdult,
          language,
          primary_release_year: year,
        },
      });

      return data;
    } catch (e) {
      return {
        page: 1,
        results: [],
        total_pages: 1,
        total_results: 0,
      };
    }
  };

  public searchTvShows = async ({
    query,
    page = 1,
    includeAdult = false,
    language = this.locale,
    year,
  }: SingleSearchOptions): Promise<TmdbSearchTvResponse> => {
    try {
      const data = await this.get<TmdbSearchTvResponse>('/search/tv', {
        params: {
          query,
          page,
          include_adult: includeAdult,
          language,
          first_air_date_year: year,
        },
      });

      return data;
    } catch (e) {
      return {
        page: 1,
        results: [],
        total_pages: 1,
        total_results: 0,
      };
    }
  };

  public getPerson = async ({
    personId,
    language = this.locale,
  }: {
    personId: number;
    language?: string;
  }): Promise<TmdbPersonDetails> => {
    try {
      const data = await this.get<TmdbPersonDetails>(`/person/${personId}`, {
        params: { language },
      });

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch person details: ${e.message}`);
    }
  };

  public getPersonCombinedCredits = async ({
    personId,
    language = this.locale,
  }: {
    personId: number;
    language?: string;
  }): Promise<TmdbPersonCombinedCredits> => {
    try {
      const data = await this.get<TmdbPersonCombinedCredits>(
        `/person/${personId}/combined_credits`,
        {
          params: { language },
        }
      );

      return data;
    } catch (e) {
      throw new Error(
        `[TMDB] Failed to fetch person combined credits: ${e.message}`
      );
    }
  };

  public getMovie = async ({
    movieId,
    language = this.locale,
  }: {
    movieId: number;
    language?: string;
  }): Promise<TmdbMovieDetails> => {
    try {
      const data = await this.get<TmdbMovieDetails>(
        `/movie/${movieId}`,
        {
          params: {
            language,
            append_to_response:
              'credits,external_ids,videos,keywords,release_dates,watch/providers',
            include_video_language: language + ', en',
          },
        },
        43200
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch movie details: ${e.message}`);
    }
  };

  public getTvShow = async ({
    tvId,
    language = this.locale,
  }: {
    tvId: number;
    language?: string;
  }): Promise<TmdbTvDetails> => {
    try {
      const data = await this.get<TmdbTvDetails>(
        `/tv/${tvId}`,
        {
          params: {
            language,
            append_to_response:
              'aggregate_credits,credits,external_ids,keywords,videos,content_ratings,watch/providers',
            include_video_language: language + ', en',
          },
        },
        43200
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch TV show details: ${e.message}`);
    }
  };

  public getTvSeason = async ({
    tvId,
    seasonNumber,
    language,
  }: {
    tvId: number;
    seasonNumber: number;
    language?: string;
  }): Promise<TmdbSeasonWithEpisodes> => {
    try {
      const data = await this.get<TmdbSeasonWithEpisodes>(
        `/tv/${tvId}/season/${seasonNumber}`,
        {
          params: {
            language,
            append_to_response: 'external_ids',
          },
        }
      );

      data.episodes = data.episodes.map((episode) => {
        if (episode.still_path) {
          episode.still_path = `https://image.tmdb.org/t/p/original/${episode.still_path}`;
        }
        return episode;
      });

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch TV show details: ${e.message}`);
    }
  };

  public async getMovieRecommendations({
    movieId,
    page = 1,
    language = this.locale,
  }: {
    movieId: number;
    page?: number;
    language?: string;
  }): Promise<TmdbSearchMovieResponse> {
    try {
      const data = await this.get<TmdbSearchMovieResponse>(
        `/movie/${movieId}/recommendations`,
        {
          params: {
            page,
            language,
          },
        }
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch discover movies: ${e.message}`);
    }
  }

  public async getMovieSimilar({
    movieId,
    page = 1,
    language = this.locale,
  }: {
    movieId: number;
    page?: number;
    language?: string;
  }): Promise<TmdbSearchMovieResponse> {
    try {
      const data = await this.get<TmdbSearchMovieResponse>(
        `/movie/${movieId}/similar`,
        {
          params: {
            page,
            language,
          },
        }
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch discover movies: ${e.message}`);
    }
  }

  public async getMoviesByKeyword({
    keywordId,
    page = 1,
    language = this.locale,
  }: {
    keywordId: number;
    page?: number;
    language?: string;
  }): Promise<TmdbSearchMovieResponse> {
    try {
      const data = await this.get<TmdbSearchMovieResponse>(
        `/keyword/${keywordId}/movies`,
        {
          params: {
            page,
            language,
          },
        }
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch movies by keyword: ${e.message}`);
    }
  }

  public async getTvRecommendations({
    tvId,
    page = 1,
    language = this.locale,
  }: {
    tvId: number;
    page?: number;
    language?: string;
  }): Promise<TmdbSearchTvResponse> {
    try {
      const data = await this.get<TmdbSearchTvResponse>(
        `/tv/${tvId}/recommendations`,
        {
          params: {
            page,
            language,
          },
        }
      );

      return data;
    } catch (e) {
      throw new Error(
        `[TMDB] Failed to fetch TV recommendations: ${e.message}`
      );
    }
  }

  public async getTvSimilar({
    tvId,
    page = 1,
    language = this.locale,
  }: {
    tvId: number;
    page?: number;
    language?: string;
  }): Promise<TmdbSearchTvResponse> {
    try {
      const data = await this.get<TmdbSearchTvResponse>(`/tv/${tvId}/similar`, {
        params: {
          page,
          language,
        },
      });

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch TV similar: ${e.message}`);
    }
  }

  public getDiscoverMovies = async ({
    sortBy = 'popularity.desc',
    page = 1,
    includeAdult = false,
    language = this.locale,
    primaryReleaseDateGte,
    primaryReleaseDateLte,
    originalLanguage,
    genre,
    studio,
    keywords,
    withRuntimeGte,
    withRuntimeLte,
    voteAverageGte,
    voteAverageLte,
    voteCountGte,
    voteCountLte,
    watchProviders,
    watchRegion,
    certification,
    certificationGte,
    certificationLte,
    certificationCountry,
  }: DiscoverMovieOptions = {}): Promise<TmdbSearchMovieResponse> => {
    try {
      const defaultFutureDate = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * (365 * 1.5)
      )
        .toISOString()
        .split('T')[0];

      const defaultPastDate = new Date('1900-01-01')
        .toISOString()
        .split('T')[0];

      const data = await this.get<TmdbSearchMovieResponse>('/discover/movie', {
        params: {
          sort_by: sortBy,
          page,
          include_adult: includeAdult,
          language,
          region: this.discoverRegion || '',
          with_original_language:
            originalLanguage && originalLanguage !== 'all'
              ? originalLanguage
              : originalLanguage === 'all'
              ? undefined
              : this.originalLanguage,
          // Set our release date values, but check if one is set and not the other,
          // so we can force a past date or a future date. TMDB Requires both values if one is set!
          'primary_release_date.gte':
            !primaryReleaseDateGte && primaryReleaseDateLte
              ? defaultPastDate
              : primaryReleaseDateGte,
          'primary_release_date.lte':
            !primaryReleaseDateLte && primaryReleaseDateGte
              ? defaultFutureDate
              : primaryReleaseDateLte,
          with_genres: genre,
          with_companies: studio,
          with_keywords: keywords,
          'with_runtime.gte': withRuntimeGte,
          'with_runtime.lte': withRuntimeLte,
          'vote_average.gte': voteAverageGte,
          'vote_average.lte': voteAverageLte,
          'vote_count.gte': voteCountGte,
          'vote_count.lte': voteCountLte,
          watch_region: watchRegion,
          with_watch_providers: watchProviders,
          certification: certification,
          'certification.gte': certificationGte,
          'certification.lte': certificationLte,
          certification_country: certificationCountry,
        },
      });

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch discover movies: ${e.message}`);
    }
  };

  public getDiscoverTv = async ({
    sortBy = 'popularity.desc',
    page = 1,
    language = this.locale,
    firstAirDateGte,
    firstAirDateLte,
    includeEmptyReleaseDate = false,
    originalLanguage,
    genre,
    network,
    keywords,
    withRuntimeGte,
    withRuntimeLte,
    voteAverageGte,
    voteAverageLte,
    voteCountGte,
    voteCountLte,
    watchProviders,
    watchRegion,
    withStatus,
    certification,
    certificationGte,
    certificationLte,
    certificationCountry,
  }: DiscoverTvOptions = {}): Promise<TmdbSearchTvResponse> => {
    try {
      const defaultFutureDate = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * (365 * 1.5)
      )
        .toISOString()
        .split('T')[0];

      const defaultPastDate = new Date('1900-01-01')
        .toISOString()
        .split('T')[0];

      const data = await this.get<TmdbSearchTvResponse>('/discover/tv', {
        params: {
          sort_by: sortBy,
          page,
          language,
          region: this.discoverRegion || '',
          // Set our release date values, but check if one is set and not the other,
          // so we can force a past date or a future date. TMDB Requires both values if one is set!
          'first_air_date.gte':
            !firstAirDateGte && firstAirDateLte
              ? defaultPastDate
              : firstAirDateGte,
          'first_air_date.lte':
            !firstAirDateLte && firstAirDateGte
              ? defaultFutureDate
              : firstAirDateLte,
          with_original_language:
            originalLanguage && originalLanguage !== 'all'
              ? originalLanguage
              : originalLanguage === 'all'
              ? undefined
              : this.originalLanguage,
          include_null_first_air_dates: includeEmptyReleaseDate,
          with_genres: genre,
          with_networks: network,
          with_keywords: keywords,
          'with_runtime.gte': withRuntimeGte,
          'with_runtime.lte': withRuntimeLte,
          'vote_average.gte': voteAverageGte,
          'vote_average.lte': voteAverageLte,
          'vote_count.gte': voteCountGte,
          'vote_count.lte': voteCountLte,
          with_watch_providers: watchProviders,
          watch_region: watchRegion,
          with_status: withStatus,
          certification: certification,
          'certification.gte': certificationGte,
          'certification.lte': certificationLte,
          certification_country: certificationCountry,
        },
      });

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch discover TV: ${e.message}`);
    }
  };

  public getUpcomingMovies = async ({
    page = 1,
    language = this.locale,
  }: {
    page: number;
    language: string;
  }): Promise<TmdbUpcomingMoviesResponse> => {
    try {
      const data = await this.get<TmdbUpcomingMoviesResponse>(
        '/movie/upcoming',
        {
          params: {
            page,
            language,
            region: this.discoverRegion,
            originalLanguage: this.originalLanguage,
          },
        }
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch upcoming movies: ${e.message}`);
    }
  };

  public getAllTrending = async ({
    page = 1,
    timeWindow = 'day',
    language = this.locale,
  }: {
    page?: number;
    timeWindow?: 'day' | 'week';
    language?: string;
  } = {}): Promise<TmdbSearchMultiResponse> => {
    try {
      const data = await this.get<TmdbSearchMultiResponse>(
        `/trending/all/${timeWindow}`,
        {
          params: {
            page,
            language,
            region: this.discoverRegion,
          },
        }
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch all trending: ${e.message}`);
    }
  };

  public getMovieTrending = async ({
    page = 1,
    timeWindow = 'day',
  }: {
    page?: number;
    timeWindow?: 'day' | 'week';
  } = {}): Promise<TmdbSearchMovieResponse> => {
    try {
      const data = await this.get<TmdbSearchMovieResponse>(
        `/trending/movie/${timeWindow}`,
        {
          params: {
            page,
          },
        }
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch all trending: ${e.message}`);
    }
  };

  public getTvTrending = async ({
    page = 1,
    timeWindow = 'day',
  }: {
    page?: number;
    timeWindow?: 'day' | 'week';
  } = {}): Promise<TmdbSearchTvResponse> => {
    try {
      const data = await this.get<TmdbSearchTvResponse>(
        `/trending/tv/${timeWindow}`,
        {
          params: {
            page,
          },
        }
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch all trending: ${e.message}`);
    }
  };

  public async getByExternalId({
    externalId,
    type,
    language = this.locale,
  }:
    | {
        externalId: string;
        type: 'imdb';
        language?: string;
      }
    | {
        externalId: number;
        type: 'tvdb';
        language?: string;
      }): Promise<TmdbExternalIdResponse> {
    try {
      const data = await this.get<TmdbExternalIdResponse>(
        `/find/${externalId}`,
        {
          params: {
            external_source: type === 'imdb' ? 'imdb_id' : 'tvdb_id',
            language,
          },
        }
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to find by external ID: ${e.message}`);
    }
  }

  public async getMediaByImdbId({
    imdbId,
    language = this.locale,
  }: {
    imdbId: string;
    language?: string;
  }): Promise<TmdbMovieDetails | TmdbTvDetails> {
    try {
      const extResponse = await this.getByExternalId({
        externalId: imdbId,
        type: 'imdb',
      });

      if (extResponse.movie_results[0]) {
        const movie = await this.getMovie({
          movieId: extResponse.movie_results[0].id,
          language,
        });

        return movie;
      }

      if (extResponse.tv_results[0]) {
        const tvshow = await this.getTvShow({
          tvId: extResponse.tv_results[0].id,
          language,
        });

        return tvshow;
      }

      throw new Error(`No movie or show returned from API for ID ${imdbId}`);
    } catch (e) {
      throw new Error(
        `[TMDB] Failed to find media using external IMDb ID: ${e.message}`
      );
    }
  }

  public async getShowByTvdbId({
    tvdbId,
    language = this.locale,
  }: {
    tvdbId: number;
    language?: string;
  }): Promise<TmdbTvDetails> {
    try {
      const extResponse = await this.getByExternalId({
        externalId: tvdbId,
        type: 'tvdb',
      });

      if (extResponse.tv_results[0]) {
        const tvshow = await this.getTvShow({
          tvId: extResponse.tv_results[0].id,
          language,
        });

        return tvshow;
      }

      throw new Error(`No show returned from API for ID ${tvdbId}`);
    } catch (e) {
      throw new Error(
        `[TMDB] Failed to get TV show using the external TVDB ID: ${e.message}`
      );
    }
  }

  public async getCollection({
    collectionId,
    language = this.locale,
  }: {
    collectionId: number;
    language?: string;
  }): Promise<TmdbCollection> {
    try {
      const data = await this.get<TmdbCollection>(
        `/collection/${collectionId}`,
        {
          params: {
            language,
          },
        }
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch collection: ${e.message}`);
    }
  }

  public async getRegions(): Promise<TmdbRegion[]> {
    try {
      const data = await this.get<TmdbRegion[]>(
        '/configuration/countries',
        {},
        86400 // 24 hours
      );

      const regions = sortBy(data, 'english_name');

      return regions;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch countries: ${e.message}`);
    }
  }

  public async getLanguages(): Promise<TmdbLanguage[]> {
    try {
      const data = await this.get<TmdbLanguage[]>(
        '/configuration/languages',
        {},
        86400 // 24 hours
      );

      const languages = sortBy(data, 'english_name');

      return languages;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch langauges: ${e.message}`);
    }
  }

  public async getStudio(studioId: number): Promise<TmdbProductionCompany> {
    try {
      const data = await this.get<TmdbProductionCompany>(
        `/company/${studioId}`
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch movie studio: ${e.message}`);
    }
  }

  public async getNetwork(networkId: number): Promise<TmdbNetwork> {
    try {
      const data = await this.get<TmdbNetwork>(`/network/${networkId}`);

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch TV network: ${e.message}`);
    }
  }

  public async getMovieGenres({
    language = this.locale,
  }: {
    language?: string;
  } = {}): Promise<TmdbGenre[]> {
    try {
      const data = await this.get<TmdbGenresResult>(
        '/genre/movie/list',
        {
          params: {
            language,
          },
        },
        86400 // 24 hours
      );

      if (
        !language.startsWith('en') &&
        data.genres.some((genre) => !genre.name)
      ) {
        const englishData = await this.get<TmdbGenresResult>(
          '/genre/movie/list',
          {
            params: {
              language: 'en',
            },
          },
          86400 // 24 hours
        );

        data.genres
          .filter((genre) => !genre.name)
          .forEach((genre) => {
            genre.name =
              englishData.genres.find(
                (englishGenre) => englishGenre.id === genre.id
              )?.name ?? '';
          });
      }

      const movieGenres = sortBy(
        data.genres.filter((genre) => genre.name),
        'name'
      );

      return movieGenres;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch movie genres: ${e.message}`);
    }
  }

  public async getTvGenres({
    language = this.locale,
  }: {
    language?: string;
  } = {}): Promise<TmdbGenre[]> {
    try {
      const data = await this.get<TmdbGenresResult>(
        '/genre/tv/list',
        {
          params: {
            language,
          },
        },
        86400 // 24 hours
      );

      if (
        !language.startsWith('en') &&
        data.genres.some((genre) => !genre.name)
      ) {
        const englishData = await this.get<TmdbGenresResult>(
          '/genre/tv/list',
          {
            params: {
              language: 'en',
            },
          },
          86400 // 24 hours
        );

        data.genres
          .filter((genre) => !genre.name)
          .forEach((genre) => {
            genre.name =
              englishData.genres.find(
                (englishGenre) => englishGenre.id === genre.id
              )?.name ?? '';
          });
      }

      const tvGenres = sortBy(
        data.genres.filter((genre) => genre.name),
        'name'
      );

      return tvGenres;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch TV genres: ${e.message}`);
    }
  }

  public getMovieCertifications =
    async (): Promise<TmdbCertificationResponse> => {
      try {
        const data = await this.get<TmdbCertificationResponse>(
          '/certification/movie/list',
          {},
          604800 // 7 days
        );

        return data;
      } catch (e) {
        throw new Error(`[TMDB] Failed to fetch movie certifications: ${e}`);
      }
    };

  public getTvCertifications = async (): Promise<TmdbCertificationResponse> => {
    try {
      const data = await this.get<TmdbCertificationResponse>(
        '/certification/tv/list',
        {},
        604800 // 7 days
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to fetch TV certifications: ${e.message}`);
    }
  };

  public async getKeywordDetails({
    keywordId,
  }: {
    keywordId: number;
  }): Promise<TmdbKeyword | null> {
    try {
      const data = await this.get<TmdbKeyword>(
        `/keyword/${keywordId}`,
        undefined,
        604800 // 7 days
      );

      return data;
    } catch (e) {
      if (e.response?.status === 404) {
        return null;
      }
      throw new Error(`[TMDB] Failed to fetch keyword: ${e.message}`);
    }
  }

  public async searchKeyword({
    query,
    page = 1,
  }: {
    query: string;
    page?: number;
  }): Promise<TmdbKeywordSearchResponse> {
    try {
      const data = await this.get<TmdbKeywordSearchResponse>(
        '/search/keyword',
        {
          params: {
            query,
            page,
          },
        },
        86400 // 24 hours
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to search keyword: ${e.message}`);
    }
  }

  public async searchCompany({
    query,
    page = 1,
  }: {
    query: string;
    page?: number;
  }): Promise<TmdbCompanySearchResponse> {
    try {
      const data = await this.get<TmdbCompanySearchResponse>(
        '/search/company',
        {
          params: {
            query,
            page,
          },
        },
        86400 // 24 hours
      );

      return data;
    } catch (e) {
      throw new Error(`[TMDB] Failed to search companies: ${e.message}`);
    }
  }

  public async getAvailableWatchProviderRegions({
    language,
  }: {
    language?: string;
  }) {
    try {
      const data = await this.get<{ results: TmdbWatchProviderRegion[] }>(
        '/watch/providers/regions',
        {
          params: {
            language: language ?? this.originalLanguage,
          },
        },
        86400 // 24 hours
      );

      return data.results;
    } catch (e) {
      throw new Error(
        `[TMDB] Failed to fetch available watch regions: ${e.message}`
      );
    }
  }

  public async getMovieWatchProviders({
    language,
    watchRegion,
  }: {
    language?: string;
    watchRegion: string;
  }) {
    try {
      const data = await this.get<{ results: TmdbWatchProviderDetails[] }>(
        '/watch/providers/movie',
        {
          params: {
            language: language ?? this.originalLanguage,
            watch_region: watchRegion,
          },
        },
        86400 // 24 hours
      );

      return data.results;
    } catch (e) {
      throw new Error(
        `[TMDB] Failed to fetch movie watch providers: ${e.message}`
      );
    }
  }

  public async getTvWatchProviders({
    language,
    watchRegion,
  }: {
    language?: string;
    watchRegion: string;
  }) {
    try {
      const data = await this.get<{ results: TmdbWatchProviderDetails[] }>(
        '/watch/providers/tv',
        {
          params: {
            language: language ?? this.originalLanguage,
            watch_region: watchRegion,
          },
        },
        86400 // 24 hours
      );

      return data.results;
    } catch (e) {
      throw new Error(
        `[TMDB] Failed to fetch TV watch providers: ${e.message}`
      );
    }
  }
}

export default TheMovieDb;
