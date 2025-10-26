import PlexTvAPI from '@server/api/plextv';
import type { SortOptions } from '@server/api/themoviedb';
import TheMovieDb from '@server/api/themoviedb';
import type { TmdbKeyword } from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import { getCompanyIdForNetwork } from '@server/constants/networkCompanyMapping';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { Watchlist } from '@server/entity/Watchlist';
import type {
  GenreSliderItem,
  WatchlistResponse,
} from '@server/interfaces/api/discoverInterfaces';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { mapProductionCompany } from '@server/models/Movie';
import {
  mapCollectionResult,
  mapMovieResult,
  mapPersonResult,
  mapTvResult,
} from '@server/models/Search';
import { mapNetwork } from '@server/models/Tv';
import { isCollection, isMovie, isPerson } from '@server/utils/typeHelpers';
import { Router } from 'express';
import { sortBy } from 'lodash';
import { z } from 'zod';

export const createTmdbWithRegionLanguage = (user?: User): TheMovieDb => {
  const settings = getSettings();

  const discoverRegion =
    user?.settings?.streamingRegion === 'all'
      ? ''
      : user?.settings?.streamingRegion
        ? user?.settings?.streamingRegion
        : settings.main.discoverRegion;

  const originalLanguage =
    user?.settings?.originalLanguage === 'all'
      ? ''
      : user?.settings?.originalLanguage
        ? user?.settings?.originalLanguage
        : settings.main.originalLanguage;

  return new TheMovieDb({
    discoverRegion,
    originalLanguage,
  });
};

// Helper function to filter TV results by network
// TMDB's with_networks parameter is not always accurate, so we verify by fetching full details
const filterTvResultsByNetwork = async (
  tmdb: TheMovieDb,
  results: any[],
  networkId: number,
  language?: string
): Promise<any[]> => {
  const detailsPromises = results.map((result) =>
    tmdb.getTvShow({ tvId: result.id, language })
      .then((details) => ({
        result,
        networks: details.networks || [],
      }))
      .catch(() => ({ result, networks: [] }))
  );

  const detailsResults = await Promise.all(detailsPromises);
  return detailsResults
    .filter(({ networks }) =>
      networks.some((net) => net.id === networkId)
    )
    .map(({ result }) => result);
};

// Helper function to filter movie results by studio
// TMDB's with_companies parameter is not always accurate, so we verify by fetching full details
const filterMovieResultsByStudio = async (
  tmdb: TheMovieDb,
  results: any[],
  studioId: number,
  language?: string
): Promise<any[]> => {
  const detailsPromises = results.map((result) =>
    tmdb.getMovie({ movieId: result.id, language })
      .then((details) => ({
        result,
        companies: details.production_companies || [],
      }))
      .catch(() => ({ result, companies: [] }))
  );

  const detailsResults = await Promise.all(detailsPromises);
  return detailsResults
    .filter(({ companies }) =>
      companies.some((company) => company.id === studioId)
    )
    .map(({ result }) => result);
};

const discoverRoutes = Router();

const QueryFilterOptions = z.object({
  page: z.coerce.string().optional(),
  sortBy: z.coerce.string().optional(),
  primaryReleaseDateGte: z.coerce.string().optional(),
  primaryReleaseDateLte: z.coerce.string().optional(),
  firstAirDateGte: z.coerce.string().optional(),
  firstAirDateLte: z.coerce.string().optional(),
  studio: z.coerce.string().optional(),
  genre: z.coerce.string().optional(),
  keywords: z.coerce.string().optional(),
  excludeKeywords: z.coerce.string().optional(),
  language: z.coerce.string().optional(),
  withRuntimeGte: z.coerce.string().optional(),
  withRuntimeLte: z.coerce.string().optional(),
  voteAverageGte: z.coerce.string().optional(),
  voteAverageLte: z.coerce.string().optional(),
  voteCountGte: z.coerce.string().optional(),
  voteCountLte: z.coerce.string().optional(),
  network: z.coerce.string().optional(),
  watchProviders: z.coerce.string().optional(),
  watchRegion: z.coerce.string().optional(),
  status: z.coerce.string().optional(),
  certification: z.coerce.string().optional(),
  certificationGte: z.coerce.string().optional(),
  certificationLte: z.coerce.string().optional(),
  certificationCountry: z.coerce.string().optional(),
  certificationMode: z.enum(['exact', 'range']).optional(),
});

export type FilterOptions = z.infer<typeof QueryFilterOptions>;
const ApiQuerySchema = QueryFilterOptions.omit({
  certificationMode: true,
});

discoverRoutes.get('/movies', async (req, res, next) => {
  const tmdb = createTmdbWithRegionLanguage(req.user);

  try {
    const query = ApiQuerySchema.parse(req.query);
    const keywords = query.keywords;
    const excludeKeywords = query.excludeKeywords;

    const data = await tmdb.getDiscoverMovies({
      page: Number(query.page),
      sortBy: query.sortBy as SortOptions,
      language: req.locale ?? query.language,
      originalLanguage: query.language,
      genre: query.genre,
      studio: query.studio,
      primaryReleaseDateLte: query.primaryReleaseDateLte
        ? new Date(query.primaryReleaseDateLte).toISOString().split('T')[0]
        : undefined,
      primaryReleaseDateGte: query.primaryReleaseDateGte
        ? new Date(query.primaryReleaseDateGte).toISOString().split('T')[0]
        : undefined,
      keywords,
      excludeKeywords,
      withRuntimeGte: query.withRuntimeGte,
      withRuntimeLte: query.withRuntimeLte,
      voteAverageGte: query.voteAverageGte,
      voteAverageLte: query.voteAverageLte,
      voteCountGte: query.voteCountGte,
      voteCountLte: query.voteCountLte,
      watchProviders: query.watchProviders,
      watchRegion: query.watchRegion,
      certification: query.certification,
      certificationGte: query.certificationGte,
      certificationLte: query.certificationLte,
      certificationCountry: query.certificationCountry,
    });

    const media = await Media.getRelatedMedia(
      req.user,
      data.results.map((result) => result.id)
    );

    // Filter by studio if specified - TMDB's with_companies is not always accurate
    let filteredResults = data.results;
    if (query.studio) {
      filteredResults = await filterMovieResultsByStudio(
        tmdb,
        data.results,
        Number(query.studio),
        req.locale ?? query.language
      );
    }

    let keywordData: TmdbKeyword[] = [];
    if (keywords) {
      const splitKeywords = keywords.split(',');

      const keywordResults = await Promise.all(
        splitKeywords.map(async (keywordId) => {
          return await tmdb.getKeywordDetails({ keywordId: Number(keywordId) });
        })
      );

      keywordData = keywordResults.filter(
        (keyword): keyword is TmdbKeyword => keyword !== null
      );
    }

    return res.status(200).json({
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      keywords: keywordData,
      results: data.results.map((result) =>
        mapMovieResult(
          result,
          media.find(
            (req) =>
              req.tmdbId === result.id && req.mediaType === MediaType.MOVIE
          )
        )
      ),
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving popular movies', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve popular movies.',
    });
  }
});

discoverRoutes.get<{ language: string }>(
  '/movies/language/:language',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const languages = await tmdb.getLanguages();

      const language = languages.find(
        (lang) => lang.iso_639_1 === req.params.language
      );

      if (!language) {
        return next({ status: 404, message: 'Language not found.' });
      }

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
        originalLanguage: req.params.language,
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        language,
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (req) =>
                req.tmdbId === result.id && req.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving movies by language', {
        label: 'API',
        errorMessage: e.message,
        language: req.params.language,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve movies by language.',
      });
    }
  }
);

discoverRoutes.get<{ genreId: string }>(
  '/movies/genre/:genreId',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const genres = await tmdb.getMovieGenres({
        language: (req.query.language as string) ?? req.locale,
      });

      const genre = genres.find(
        (genre) => genre.id === Number(req.params.genreId)
      );

      if (!genre) {
        return next({ status: 404, message: 'Genre not found.' });
      }

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
        genre: req.params.genreId as string,
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        genre,
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (req) =>
                req.tmdbId === result.id && req.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving movies by genre', {
        label: 'API',
        errorMessage: e.message,
        genreId: req.params.genreId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve movies by genre.',
      });
    }
  }
);

discoverRoutes.get<{ studioId: string }>(
  '/movies/studio/:studioId',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);
    const requestedPage = Number(req.query.page) || 1;

    try {
      const studio = await tmdb.getStudio(Number(req.params.studioId));

      // Fetch 2 pages to get more results (most permissive filters for "All Movies")
      const [page1, page2] = await Promise.all([
        tmdb.getDiscoverMovies({
          page: requestedPage,
          language: (req.query.language as string) ?? req.locale,
          studio: req.params.studioId as string,
          sortBy: 'popularity.desc',
          voteCountGte: '5', // Very permissive for all movies
          excludeKeywords: '99', // Only block documentaries
        }),
        requestedPage === 1
          ? tmdb.getDiscoverMovies({
            page: 2,
            language: (req.query.language as string) ?? req.locale,
            studio: req.params.studioId as string,
            sortBy: 'popularity.desc',
            voteCountGte: '5',
            excludeKeywords: '99',
          })
          : null,
      ]);

      // Merge results if we fetched page 2
      const allResults =
        page2 && requestedPage === 1
          ? [...page1.results, ...page2.results]
          : page1.results;

      // Remove duplicates and take top 20
      const uniqueResults = Array.from(
        new Map(allResults.map((m) => [m.id, m])).values()
      ).slice(0, 20);

      const media = await Media.getRelatedMedia(
        req.user,
        uniqueResults.map((result) => result.id)
      );

      // Note: Multi-page fetch strategy for better results count
      // Fetches 2 pages and merges for more comprehensive results

      return res.status(200).json({
        page: page1.page,
        totalPages: page1.total_pages,
        totalResults: page1.total_results,
        studio: mapProductionCompany(studio),
        results: uniqueResults.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving movies by studio', {
        label: 'API',
        errorMessage: e.message,
        studioId: req.params.studioId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve movies by studio.',
      });
    }
  }
);

// Studio trending
discoverRoutes.get<{ studioId: string }>(
  '/movies/studio/:studioId/trending',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const studio = await tmdb.getStudio(Number(req.params.studioId));

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        studio: req.params.studioId as string,
        sortBy: 'popularity.desc',
        primaryReleaseDateLte: new Date().toISOString().split('T')[0],
        voteCountGte: '30', // Lowered threshold for more results
        withRuntimeGte: '60', // Exclude shorts and TV specials
        excludeKeywords: '99,10692', // Exclude documentaries and concerts
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Note: Filtering disabled for better results count
      // TMDB's studio parameter is generally accurate for major studios

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        studio: mapProductionCompany(studio),
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving trending movies by studio', {
        label: 'API',
        errorMessage: e.message,
        studioId: req.params.studioId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve trending movies by studio.',
      });
    }
  }
);

// Studio new releases (last 90 days)
discoverRoutes.get<{ studioId: string }>(
  '/movies/studio/:studioId/new',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const studio = await tmdb.getStudio(Number(req.params.studioId));

      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const dateGte = ninetyDaysAgo.toISOString().split('T')[0];
      const dateLte = now.toISOString().split('T')[0];

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        studio: req.params.studioId as string,
        primaryReleaseDateGte: dateGte,
        primaryReleaseDateLte: dateLte,
        sortBy: 'primary_release_date.desc',
        voteCountGte: '30', // Lowered threshold for more results
        withRuntimeGte: '60', // Exclude shorts and TV specials
        excludeKeywords: '99,10692', // Exclude documentaries and concerts
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Note: Filtering disabled for better results count
      // TMDB's studio parameter is generally accurate for major studios

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        studio: mapProductionCompany(studio),
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving new movies by studio', {
        label: 'API',
        errorMessage: e.message,
        studioId: req.params.studioId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve new movies by studio.',
      });
    }
  }
);

// Studio popular
discoverRoutes.get<{ studioId: string }>(
  '/movies/studio/:studioId/popular',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const studio = await tmdb.getStudio(Number(req.params.studioId));

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        studio: req.params.studioId as string,
        sortBy: 'popularity.desc',
        voteCountGte: '30', // Lowered threshold for more results
        withRuntimeGte: '60', // Exclude shorts and TV specials
        excludeKeywords: '99,10692', // Exclude documentaries and concerts
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Note: Filtering disabled for better results count
      // TMDB's studio parameter is generally accurate for major studios

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        studio: mapProductionCompany(studio),
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving popular movies by studio', {
        label: 'API',
        errorMessage: e.message,
        studioId: req.params.studioId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve popular movies by studio.',
      });
    }
  }
);

// Studio top rated
discoverRoutes.get<{ studioId: string }>(
  '/movies/studio/:studioId/top-rated',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const studio = await tmdb.getStudio(Number(req.params.studioId));

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        studio: req.params.studioId as string,
        sortBy: 'vote_average.desc',
        voteCountGte: '100', // Keep higher for top-rated to ensure quality
        withRuntimeGte: '60', // Exclude shorts and TV specials
        excludeKeywords: '99,10692', // Exclude documentaries and concerts
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Note: Filtering disabled for better results count
      // TMDB's studio parameter is generally accurate for major studios

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        studio: mapProductionCompany(studio),
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving top rated movies by studio', {
        label: 'API',
        errorMessage: e.message,
        studioId: req.params.studioId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve top rated movies by studio.',
      });
    }
  }
);

// Studio by genre
discoverRoutes.get<{ studioId: string; genreId: string }>(
  '/movies/studio/:studioId/genre/:genreId',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const studio = await tmdb.getStudio(Number(req.params.studioId));

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        studio: req.params.studioId as string,
        genre: req.params.genreId,
        sortBy: 'popularity.desc',
        voteCountGte: '30', // Lowered threshold for more results
        withRuntimeGte: '60', // Exclude shorts and TV specials
        excludeKeywords: '99,10692', // Exclude documentaries and concerts
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Note: Filtering disabled for better results count
      // TMDB's studio parameter is generally accurate for major studios

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        studio: mapProductionCompany(studio),
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving movies by studio and genre', {
        label: 'API',
        errorMessage: e.message,
        studioId: req.params.studioId,
        genreId: req.params.genreId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve movies by studio and genre.',
      });
    }
  }
);

discoverRoutes.get('/movies/upcoming', async (req, res, next) => {
  const tmdb = createTmdbWithRegionLanguage(req.user);

  const now = new Date();
  const offset = now.getTimezoneOffset();
  const date = new Date(now.getTime() - offset * 60 * 1000)
    .toISOString()
    .split('T')[0];

  try {
    const data = await tmdb.getDiscoverMovies({
      page: Number(req.query.page),
      language: (req.query.language as string) ?? req.locale,
      primaryReleaseDateGte: date,
    });

    const media = await Media.getRelatedMedia(
      req.user,
      data.results.map((result) => result.id)
    );

    return res.status(200).json({
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      results: data.results.map((result) =>
        mapMovieResult(
          result,
          media.find(
            (med) =>
              med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
          )
        )
      ),
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving upcoming movies', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve upcoming movies.',
    });
  }
});

discoverRoutes.get('/tv', async (req, res, next) => {
  const tmdb = createTmdbWithRegionLanguage(req.user);

  try {
    const query = ApiQuerySchema.parse(req.query);
    const keywords = query.keywords;
    const excludeKeywords = query.excludeKeywords;
    const data = await tmdb.getDiscoverTv({
      page: Number(query.page),
      sortBy: query.sortBy as SortOptions,
      language: req.locale ?? query.language,
      genre: query.genre,
      network: query.network ? Number(query.network) : undefined,
      firstAirDateLte: query.firstAirDateLte
        ? new Date(query.firstAirDateLte).toISOString().split('T')[0]
        : undefined,
      firstAirDateGte: query.firstAirDateGte
        ? new Date(query.firstAirDateGte).toISOString().split('T')[0]
        : undefined,
      originalLanguage: query.language,
      keywords,
      excludeKeywords,
      withRuntimeGte: query.withRuntimeGte,
      withRuntimeLte: query.withRuntimeLte,
      voteAverageGte: query.voteAverageGte,
      voteAverageLte: query.voteAverageLte,
      voteCountGte: query.voteCountGte,
      voteCountLte: query.voteCountLte,
      watchProviders: query.watchProviders,
      watchRegion: query.watchRegion,
      withStatus: query.status,
      certification: query.certification,
      certificationGte: query.certificationGte,
      certificationLte: query.certificationLte,
      certificationCountry: query.certificationCountry,
    });

    const media = await Media.getRelatedMedia(
      req.user,
      data.results.map((result) => result.id)
    );

    // Filter by network if specified - TMDB's with_networks is not always accurate
    let filteredResults = data.results;
    if (query.network) {
      filteredResults = await filterTvResultsByNetwork(
        tmdb,
        data.results,
        Number(query.network),
        req.locale ?? query.language
      );
    }

    let keywordData: TmdbKeyword[] = [];
    if (keywords) {
      const splitKeywords = keywords.split(',');

      const keywordResults = await Promise.all(
        splitKeywords.map(async (keywordId) => {
          return await tmdb.getKeywordDetails({ keywordId: Number(keywordId) });
        })
      );

      keywordData = keywordResults.filter(
        (keyword): keyword is TmdbKeyword => keyword !== null
      );
    }

    return res.status(200).json({
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      keywords: keywordData,
      results: data.results.map((result) =>
        mapTvResult(
          result,
          media.find(
            (med) => med.tmdbId === result.id && med.mediaType === MediaType.TV
          )
        )
      ),
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving popular series', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve popular series.',
    });
  }
});

discoverRoutes.get<{ language: string }>(
  '/tv/language/:language',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const languages = await tmdb.getLanguages();

      const language = languages.find(
        (lang) => lang.iso_639_1 === req.params.language
      );

      if (!language) {
        return next({ status: 404, message: 'Language not found.' });
      }

      const data = await tmdb.getDiscoverTv({
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
        originalLanguage: req.params.language,
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        language,
        results: data.results.map((result) =>
          mapTvResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.TV
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving series by language', {
        label: 'API',
        errorMessage: e.message,
        language: req.params.language,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve series by language.',
      });
    }
  }
);

discoverRoutes.get<{ genreId: string }>(
  '/tv/genre/:genreId',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const genres = await tmdb.getTvGenres({
        language: (req.query.language as string) ?? req.locale,
      });

      const genre = genres.find(
        (genre) => genre.id === Number(req.params.genreId)
      );

      if (!genre) {
        return next({ status: 404, message: 'Genre not found.' });
      }

      const data = await tmdb.getDiscoverTv({
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
        genre: req.params.genreId,
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        genre,
        results: data.results.map((result) =>
          mapTvResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.TV
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving series by genre', {
        label: 'API',
        errorMessage: e.message,
        genreId: req.params.genreId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve series by genre.',
      });
    }
  }
);

discoverRoutes.get<{ networkId: string }>(
  '/tv/network/:networkId',
  async (req, res, next) => {
    const tmdb = new TheMovieDb();

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));

      const data = await tmdb.getDiscoverTv({
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
        network: Number(req.params.networkId),
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Filter results to ensure they actually belong to this network
      const filteredResults = await filterTvResultsByNetwork(
        tmdb,
        data.results,
        Number(req.params.networkId),
        (req.query.language as string) ?? req.locale
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapTvResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.TV
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving series by network', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve series by network.',
      });
    }
  }
);

// Network trending
discoverRoutes.get<{ networkId: string }>(
  '/tv/network/:networkId/trending',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));
      const networkId = Number(req.params.networkId);

      // Use discover with popularity sort to simulate trending for this network
      const data = await tmdb.getDiscoverTv({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        network: networkId,
        sortBy: 'popularity.desc',
        // Get recently aired or currently airing shows for more "trending" feel
        firstAirDateLte: new Date().toISOString().split('T')[0],
        voteCountGte: '50', // Minimum votes for reliable network data
      });

      // Filter results to only include shows that actually belong to this network
      // TMDB's with_networks filter is not always accurate
      const filteredResults = await filterTvResultsByNetwork(
        tmdb,
        data.results,
        networkId,
        (req.query.language as string) ?? req.locale
      );

      const media = await Media.getRelatedMedia(
        req.user,
        filteredResults.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapTvResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.TV
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving trending series by network', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve trending series by network.',
      });
    }
  }
);// Network new releases (recently aired)
discoverRoutes.get<{ networkId: string }>(
  '/tv/network/:networkId/new',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));

      // Get shows that aired in the last 90 days
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const dateGte = ninetyDaysAgo.toISOString().split('T')[0];
      const dateLte = now.toISOString().split('T')[0];

      const data = await tmdb.getDiscoverTv({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        network: Number(req.params.networkId),
        firstAirDateGte: dateGte,
        firstAirDateLte: dateLte,
        sortBy: 'first_air_date.desc',
        voteCountGte: '50', // Minimum votes for reliable network data
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Filter results to ensure they actually belong to this network
      const filteredResults = await filterTvResultsByNetwork(
        tmdb,
        data.results,
        Number(req.params.networkId),
        (req.query.language as string) ?? req.locale
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapTvResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.TV
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving new series by network', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve new series by network.',
      });
    }
  }
);

// Network popular
discoverRoutes.get<{ networkId: string }>(
  '/tv/network/:networkId/popular',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));

      const data = await tmdb.getDiscoverTv({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        network: Number(req.params.networkId),
        sortBy: 'popularity.desc',
        voteCountGte: '50', // Minimum votes for reliable network data
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Filter results to ensure they actually belong to this network
      const filteredResults = await filterTvResultsByNetwork(
        tmdb,
        data.results,
        Number(req.params.networkId),
        (req.query.language as string) ?? req.locale
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapTvResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.TV
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving popular series by network', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve popular series by network.',
      });
    }
  }
);

// Network top rated
discoverRoutes.get<{ networkId: string }>(
  '/tv/network/:networkId/top-rated',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));

      const data = await tmdb.getDiscoverTv({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        network: Number(req.params.networkId),
        sortBy: 'vote_average.desc',
        voteCountGte: '100', // Minimum votes to qualify
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Filter results to ensure they actually belong to this network
      const filteredResults = await filterTvResultsByNetwork(
        tmdb,
        data.results,
        Number(req.params.networkId),
        (req.query.language as string) ?? req.locale
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapTvResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.TV
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving top rated series by network', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve top rated series by network.',
      });
    }
  }
);

// Network by genre
discoverRoutes.get<{ networkId: string; genreId: string }>(
  '/tv/network/:networkId/genre/:genreId',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));

      const data = await tmdb.getDiscoverTv({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        network: Number(req.params.networkId),
        genre: req.params.genreId,
        sortBy: 'popularity.desc',
        voteCountGte: '50', // Add minimum vote threshold to get more reliable data
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Filter results to ensure they actually belong to this network
      const filteredResults = await filterTvResultsByNetwork(
        tmdb,
        data.results,
        Number(req.params.networkId),
        (req.query.language as string) ?? req.locale
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapTvResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.TV
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving series by network and genre', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
        genreId: req.params.genreId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve series by network and genre.',
      });
    }
  }
);

// Network movies - Basic endpoint
discoverRoutes.get<{ networkId: string }>(
  '/movies/network/:networkId',
  async (req, res, next) => {
    const tmdb = new TheMovieDb();

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));

      // Map network ID to production company ID for movies
      const companyId = getCompanyIdForNetwork(Number(req.params.networkId));

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
        studio: companyId.toString(),
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Filter results to ensure they actually belong to this network/company
      const filteredResults = await filterMovieResultsByStudio(
        tmdb,
        data.results,
        Number(req.params.networkId),
        (req.query.language as string) ?? req.locale
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving movies by network', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve movies by network.',
      });
    }
  }
);

// Network movies trending
discoverRoutes.get<{ networkId: string }>(
  '/movies/network/:networkId/trending',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));
      const networkId = Number(req.params.networkId);

      // Map network ID to production company ID for movies
      const companyId = getCompanyIdForNetwork(networkId);

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        studio: companyId.toString(),
        sortBy: 'popularity.desc',
        primaryReleaseDateLte: new Date().toISOString().split('T')[0],
        voteCountGte: '50',
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Filter results to ensure they actually belong to this network/company
      const filteredResults = await filterMovieResultsByStudio(
        tmdb,
        data.results,
        networkId,
        (req.query.language as string) ?? req.locale
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving trending movies by network', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve trending movies by network.',
      });
    }
  }
);

// Network movies new
discoverRoutes.get<{ networkId: string }>(
  '/movies/network/:networkId/new',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));

      // Map network ID to production company ID for movies
      const companyId = getCompanyIdForNetwork(Number(req.params.networkId));

      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const dateGte = ninetyDaysAgo.toISOString().split('T')[0];
      const dateLte = now.toISOString().split('T')[0];

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        studio: companyId.toString(),
        primaryReleaseDateGte: dateGte,
        primaryReleaseDateLte: dateLte,
        sortBy: 'primary_release_date.desc',
        voteCountGte: '50',
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Filter results to ensure they actually belong to this network/company
      const filteredResults = await filterMovieResultsByStudio(
        tmdb,
        data.results,
        Number(req.params.networkId),
        (req.query.language as string) ?? req.locale
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving new movies by network', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve new movies by network.',
      });
    }
  }
);

// Network movies top-rated
discoverRoutes.get<{ networkId: string }>(
  '/movies/network/:networkId/top-rated',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));

      // Map network ID to production company ID for movies
      const companyId = getCompanyIdForNetwork(Number(req.params.networkId));

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        studio: companyId.toString(),
        sortBy: 'vote_average.desc',
        voteCountGte: '100',
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Filter results to ensure they actually belong to this network/company
      const filteredResults = await filterMovieResultsByStudio(
        tmdb,
        data.results,
        Number(req.params.networkId),
        (req.query.language as string) ?? req.locale
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving top rated movies by network', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve top rated movies by network.',
      });
    }
  }
);

// Network movies by genre
discoverRoutes.get<{ networkId: string; genreId: string }>(
  '/movies/network/:networkId/genre/:genreId',
  async (req, res, next) => {
    const tmdb = createTmdbWithRegionLanguage(req.user);

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));

      // Map network ID to production company ID for movies
      const companyId = getCompanyIdForNetwork(Number(req.params.networkId));

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page) || 1,
        language: (req.query.language as string) ?? req.locale,
        studio: companyId.toString(),
        genre: req.params.genreId,
        sortBy: 'popularity.desc',
        voteCountGte: '50',
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      // Filter results to ensure they actually belong to this network/company
      const filteredResults = await filterMovieResultsByStudio(
        tmdb,
        data.results,
        Number(req.params.networkId),
        (req.query.language as string) ?? req.locale
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        network: mapNetwork(network),
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving movies by network and genre', {
        label: 'API',
        errorMessage: e.message,
        networkId: req.params.networkId,
        genreId: req.params.genreId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve movies by network and genre.',
      });
    }
  }
);

discoverRoutes.get('/tv/upcoming', async (req, res, next) => {
  const tmdb = createTmdbWithRegionLanguage(req.user);

  const now = new Date();
  const offset = now.getTimezoneOffset();
  const date = new Date(now.getTime() - offset * 60 * 1000)
    .toISOString()
    .split('T')[0];

  try {
    const data = await tmdb.getDiscoverTv({
      page: Number(req.query.page),
      language: (req.query.language as string) ?? req.locale,
      firstAirDateGte: date,
    });

    const media = await Media.getRelatedMedia(
      req.user,
      data.results.map((result) => result.id)
    );

    return res.status(200).json({
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      results: data.results.map((result) =>
        mapTvResult(
          result,
          media.find(
            (med) => med.tmdbId === result.id && med.mediaType === MediaType.TV
          )
        )
      ),
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving upcoming series', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve upcoming series.',
    });
  }
});

discoverRoutes.get('/trending', async (req, res, next) => {
  const tmdb = createTmdbWithRegionLanguage(req.user);

  try {
    const data = await tmdb.getAllTrending({
      page: Number(req.query.page),
      language: (req.query.language as string) ?? req.locale,
    });

    const media = await Media.getRelatedMedia(
      req.user,
      data.results.map((result) => result.id)
    );

    return res.status(200).json({
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      results: data.results.map((result) =>
        isMovie(result)
          ? mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
          : isPerson(result)
            ? mapPersonResult(result)
            : isCollection(result)
              ? mapCollectionResult(result)
              : mapTvResult(
                result,
                media.find(
                  (med) =>
                    med.tmdbId === result.id && med.mediaType === MediaType.TV
                )
              )
      ),
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving trending items', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve trending items.',
    });
  }
});

discoverRoutes.get<{ keywordId: string }>(
  '/keyword/:keywordId/movies',
  async (req, res, next) => {
    const tmdb = new TheMovieDb();

    try {
      const data = await tmdb.getMoviesByKeyword({
        keywordId: Number(req.params.keywordId),
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        results: data.results.map((result) =>
          mapMovieResult(
            result,
            media.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === MediaType.MOVIE
            )
          )
        ),
      });
    } catch (e) {
      logger.debug('Something went wrong retrieving movies by keyword', {
        label: 'API',
        errorMessage: e.message,
        keywordId: req.params.keywordId,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve movies by keyword.',
      });
    }
  }
);

discoverRoutes.get<{ language: string }, GenreSliderItem[]>(
  '/genreslider/movie',
  async (req, res, next) => {
    const tmdb = new TheMovieDb();

    try {
      const mappedGenres: GenreSliderItem[] = [];

      const genres = await tmdb.getMovieGenres({
        language: (req.query.language as string) ?? req.locale,
      });

      await Promise.all(
        genres.map(async (genre) => {
          const genreData = await tmdb.getDiscoverMovies({
            genre: genre.id.toString(),
          });

          mappedGenres.push({
            id: genre.id,
            name: genre.name,
            backdrops: genreData.results
              .filter((title) => !!title.backdrop_path)
              .map((title) => title.backdrop_path) as string[],
          });
        })
      );

      const sortedData = sortBy(mappedGenres, 'name');

      return res.status(200).json(sortedData);
    } catch (e) {
      logger.debug('Something went wrong retrieving the movie genre slider', {
        label: 'API',
        errorMessage: e.message,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve movie genre slider.',
      });
    }
  }
);

discoverRoutes.get<{ language: string }, GenreSliderItem[]>(
  '/genreslider/tv',
  async (req, res, next) => {
    const tmdb = new TheMovieDb();

    try {
      const mappedGenres: GenreSliderItem[] = [];

      const genres = await tmdb.getTvGenres({
        language: (req.query.language as string) ?? req.locale,
      });

      await Promise.all(
        genres.map(async (genre) => {
          const genreData = await tmdb.getDiscoverTv({
            genre: genre.id.toString(),
          });

          mappedGenres.push({
            id: genre.id,
            name: genre.name,
            backdrops: genreData.results
              .filter((title) => !!title.backdrop_path)
              .map((title) => title.backdrop_path) as string[],
          });
        })
      );

      const sortedData = sortBy(mappedGenres, 'name');

      return res.status(200).json(sortedData);
    } catch (e) {
      logger.debug('Something went wrong retrieving the series genre slider', {
        label: 'API',
        errorMessage: e.message,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve series genre slider.',
      });
    }
  }
);

discoverRoutes.get<Record<string, unknown>, WatchlistResponse>(
  '/watchlist',
  async (req, res) => {
    const userRepository = getRepository(User);
    const itemsPerPage = 20;
    const page = Number(req.query.page) ?? 1;
    const offset = (page - 1) * itemsPerPage;

    const activeUser = await userRepository.findOne({
      where: { id: req.user?.id },
      select: ['id', 'plexToken'],
    });

    if (activeUser && !activeUser?.plexToken) {
      // Non-Plex users can only see their own watchlist
      const [result, total] = await getRepository(Watchlist).findAndCount({
        where: { requestedBy: { id: activeUser?.id } },
        relations: {
          /*requestedBy: true,media:true*/
        },
        // loadRelationIds: true,
        take: itemsPerPage,
        skip: offset,
      });
      if (total) {
        return res.json({
          page: page,
          totalPages: Math.ceil(total / itemsPerPage),
          totalResults: total,
          results: result,
        });
      }
    }
    if (!activeUser?.plexToken) {
      // We will just return an empty array if the user has no Plex token
      return res.json({
        page: 1,
        totalPages: 1,
        totalResults: 0,
        results: [],
      });
    }

    // List watchlist from Plex
    const plexTV = new PlexTvAPI(activeUser.plexToken);

    const watchlist = await plexTV.getWatchlist({ offset });

    return res.json({
      page,
      totalPages: Math.ceil(watchlist.totalSize / itemsPerPage),
      totalResults: watchlist.totalSize,
      results: watchlist.items.map((item) => ({
        id: item.tmdbId,
        ratingKey: item.ratingKey,
        title: item.title,
        mediaType: item.type === 'show' ? 'tv' : 'movie',
        tmdbId: item.tmdbId,
      })),
    });
  }
);

export default discoverRoutes;
