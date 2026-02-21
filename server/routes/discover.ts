import PlexTvAPI from '@server/api/plextv';
import type { SortOptions } from '@server/api/themoviedb';
import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbKeyword,
  TmdbMovieResult,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import type { UserContentRatingLimits } from '@server/constants/contentRatings';
import {
  MOVIE_RATINGS,
  TV_RATINGS,
  UNRATED_VALUES,
  shouldFilterMovie,
  shouldFilterTv,
  type MovieRating,
  type TvRating,
} from '@server/constants/contentRatings';
import { MediaType } from '@server/constants/media';
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

/**
 * Get the user's content rating limits (admin-enforced parental controls)
 * These limits are set by admins and users cannot see or modify them
 */
export const getUserContentRatingLimits = (
  user?: User
): UserContentRatingLimits => {
  return {
    maxMovieRating: user?.settings?.maxMovieRating ?? undefined,
    maxTvRating: user?.settings?.maxTvRating ?? undefined,
    blockUnrated: user?.settings?.blockUnrated ?? false,
    blockAdult: user?.settings?.blockAdult ?? false,
  };
};

/**
 * Apply certification limits to discover movie options
 * Only applies if user has rating limits set and no explicit certification params
 */
const applyMovieCertificationLimits = (
  options: {
    certification?: string;
    certificationLte?: string;
    certificationCountry?: string;
  },
  limits: UserContentRatingLimits
): { certificationLte?: string; certificationCountry?: string } => {
  // If user has a movie rating limit and no explicit certification filter
  if (
    limits.maxMovieRating &&
    !options.certification &&
    !options.certificationLte
  ) {
    return {
      certificationLte: limits.maxMovieRating,
      certificationCountry: options.certificationCountry || 'US',
    };
  }
  return {};
};

/**
 * Apply certification limits to discover TV options
 * Only applies if user has rating limits set and no explicit certification params
 */
const applyTvCertificationLimits = (
  options: {
    certification?: string;
    certificationLte?: string;
    certificationCountry?: string;
  },
  limits: UserContentRatingLimits
): { certificationLte?: string; certificationCountry?: string } => {
  // If user has a TV rating limit and no explicit certification filter
  if (
    limits.maxTvRating &&
    !options.certification &&
    !options.certificationLte
  ) {
    return {
      certificationLte: limits.maxTvRating,
      certificationCountry: options.certificationCountry || 'US',
    };
  }
  return {};
};

/** Minimum results before triggering a backfill from the next TMDB page */
const BACKFILL_THRESHOLD = 15;

/**
 * Post-filter discover results to remove unrated content.
 * TMDB's certificationLte query param caps rated content but does NOT
 * exclude items with no certification at all. This filter handles that gap.
 * Only runs when blockUnrated is true — otherwise it's a no-op.
 *
 * When filtering drops results below BACKFILL_THRESHOLD, fetches one
 * additional TMDB page to compensate for the gap.
 */
/**
 * Extract the best US movie certification from release dates.
 * Collects ALL US release date certifications, excludes NR/unrated
 * (so unrated director's cuts don't override a theatrical R rating),
 * and returns the most restrictive one found.
 * Falls back to international ratings if no US rating exists.
 */
const getMovieCertFromDetails = (
  releaseDates: {
    iso_3166_1: string;
    release_dates: { certification: string }[];
  }[]
): string | undefined => {
  const usRelease = releaseDates.find((r) => r.iso_3166_1 === 'US');
  const usCerts: string[] = [];

  if (usRelease?.release_dates) {
    for (const rd of usRelease.release_dates) {
      if (rd.certification && !UNRATED_VALUES.includes(rd.certification)) {
        usCerts.push(rd.certification);
      }
    }
  }

  if (usCerts.length > 0) {
    // Return the most restrictive US rating
    let best = usCerts[0];
    let bestIdx = MOVIE_RATINGS.indexOf(best as MovieRating);
    for (const c of usCerts) {
      const idx = MOVIE_RATINGS.indexOf(c as MovieRating);
      if (idx > bestIdx) {
        bestIdx = idx;
        best = c;
      }
    }
    return best;
  }

  // Fallback: check all countries for a known MPAA-equivalent rating
  for (const release of releaseDates) {
    for (const rd of release.release_dates || []) {
      if (
        rd.certification &&
        !UNRATED_VALUES.includes(rd.certification) &&
        MOVIE_RATINGS.indexOf(rd.certification as MovieRating) !== -1
      ) {
        return rd.certification;
      }
    }
  }

  return undefined;
};

const filterMovieBatch = async (
  movies: TmdbMovieResult[],
  tmdb: TheMovieDb,
  limits: UserContentRatingLimits
): Promise<TmdbMovieResult[]> => {
  const settled = await Promise.allSettled(
    movies.map(async (movie) => {
      const details = await tmdb.getMovie({ movieId: movie.id });
      const cert = getMovieCertFromDetails(
        details.release_dates?.results ?? []
      );
      return { movie, cert, title: details.title };
    })
  );

  const filtered: TmdbMovieResult[] = [];
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    const { movie, cert, title } = outcome.value;
    if (!shouldFilterMovie(cert, limits.maxMovieRating, limits.blockUnrated)) {
      filtered.push(movie);
    } else {
      logger.debug('Blocked movie by rating (post-filter)', {
        label: 'Content Filtering',
        movieId: movie.id,
        movieTitle: title,
        certification: cert ?? 'unrated',
        maxRating: limits.maxMovieRating,
      });
    }
  }
  return filtered;
};

const postFilterDiscoverMovies = async (
  results: TmdbMovieResult[],
  tmdb: TheMovieDb,
  limits: UserContentRatingLimits,
  fetchNextPage?: () => Promise<TmdbMovieResult[] | null>,
  preFiltered = true
): Promise<TmdbMovieResult[]> => {
  // Free in-memory filter: remove TMDB adult-flagged content
  let filtered = limits.blockAdult
    ? results.filter((movie) => !movie.adult)
    : results;

  // When certification.lte was already applied (preFiltered=true),
  // only run expensive per-item checks for blockUnrated.
  // When not pre-filtered (e.g. trending), also check maxRating.
  const needsPostFilter = preFiltered
    ? limits.blockUnrated
    : limits.blockUnrated || !!limits.maxMovieRating;
  if (!needsPostFilter) return filtered;

  filtered = await filterMovieBatch(filtered, tmdb, limits);

  // Backfill: if too many results were removed, grab one more page
  if (filtered.length < BACKFILL_THRESHOLD && fetchNextPage) {
    const nextResults = await fetchNextPage();
    if (nextResults && nextResults.length > 0) {
      const nextInput = limits.blockAdult
        ? nextResults.filter((movie) => !movie.adult)
        : nextResults;
      const nextFiltered = await filterMovieBatch(nextInput, tmdb, limits);
      filtered.push(...nextFiltered);
    }
  }

  return filtered;
};

/**
 * Extract the best TV certification from content ratings.
 * Prefers the US rating; falls back to the first known rating
 * from any country if no US rating exists.
 */
const getTvCertFromDetails = (
  contentRatings: { iso_3166_1: string; rating: string }[]
): string | undefined => {
  const usRating = contentRatings.find((r) => r.iso_3166_1 === 'US');
  if (usRating?.rating && !UNRATED_VALUES.includes(usRating.rating)) {
    return usRating.rating;
  }

  // Fallback: check all countries for a known TV rating
  for (const entry of contentRatings) {
    if (
      entry.rating &&
      !UNRATED_VALUES.includes(entry.rating) &&
      TV_RATINGS.indexOf(entry.rating as TvRating) !== -1
    ) {
      return entry.rating;
    }
  }

  return undefined;
};

const filterTvBatch = async (
  shows: TmdbTvResult[],
  tmdb: TheMovieDb,
  limits: UserContentRatingLimits
): Promise<TmdbTvResult[]> => {
  const settled = await Promise.allSettled(
    shows.map(async (show) => {
      const details = await tmdb.getTvShow({ tvId: show.id });
      const cert = getTvCertFromDetails(
        details.content_ratings?.results ?? []
      );
      return { show, cert, title: details.name };
    })
  );

  const filtered: TmdbTvResult[] = [];
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    const { show, cert, title } = outcome.value;
    if (!shouldFilterTv(cert, limits.maxTvRating, limits.blockUnrated)) {
      filtered.push(show);
    } else {
      logger.debug('Blocked TV show by rating (post-filter)', {
        label: 'Content Filtering',
        tvId: show.id,
        tvTitle: title,
        certification: cert ?? 'unrated',
        maxRating: limits.maxTvRating,
      });
    }
  }
  return filtered;
};

const postFilterDiscoverTv = async (
  results: TmdbTvResult[],
  tmdb: TheMovieDb,
  limits: UserContentRatingLimits,
  fetchNextPage?: () => Promise<TmdbTvResult[] | null>,
  preFiltered = true
): Promise<TmdbTvResult[]> => {
  // When certification.lte was already applied (preFiltered=true),
  // only run expensive per-item checks for blockUnrated.
  // When not pre-filtered (e.g. trending), also check maxRating.
  const needsPostFilter = preFiltered
    ? limits.blockUnrated
    : limits.blockUnrated || !!limits.maxTvRating;
  if (!needsPostFilter) return results;

  const filtered = await filterTvBatch(results, tmdb, limits);

  // Backfill: if too many results were removed, grab one more page
  if (filtered.length < BACKFILL_THRESHOLD && fetchNextPage) {
    const nextResults = await fetchNextPage();
    if (nextResults && nextResults.length > 0) {
      const nextFiltered = await filterTvBatch(nextResults, tmdb, limits);
      filtered.push(...nextFiltered);
    }
  }

  return filtered;
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
  const ratingLimits = getUserContentRatingLimits(req.user);

  try {
    const query = ApiQuerySchema.parse(req.query);
    const keywords = query.keywords;
    const excludeKeywords = query.excludeKeywords;

    // Apply user's content rating limits (parental controls)
    const certificationOverrides = applyMovieCertificationLimits(
      {
        certification: query.certification,
        certificationLte: query.certificationLte,
        certificationCountry: query.certificationCountry,
      },
      ratingLimits
    );

    const discoverOpts = {
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
      certificationLte:
        certificationOverrides.certificationLte ?? query.certificationLte,
      certificationCountry:
        certificationOverrides.certificationCountry ??
        query.certificationCountry,
    };
    const currentPage = Number(query.page);

    const data = await tmdb.getDiscoverMovies({
      page: currentPage,
      ...discoverOpts,
    });

    // Post-filter unrated content if blockUnrated is enabled
    const filteredResults = await postFilterDiscoverMovies(
      data.results,
      tmdb,
      ratingLimits,
      currentPage < data.total_pages
        ? async () =>
            (
              await tmdb.getDiscoverMovies({
                page: currentPage + 1,
                ...discoverOpts,
              })
            ).results
        : undefined
    );

    const media = await Media.getRelatedMedia(
      req.user,
      filteredResults.map((result) => result.id)
    );

    let keywordData: TmdbKeyword[] = [];
    if (keywords) {
      const keywordResults = await Promise.all(
        keywords
          .split(',')
          .map((keywordId) =>
            tmdb.getKeywordDetails({ keywordId: Number(keywordId) })
          )
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
      results: filteredResults.map((result) =>
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
    const ratingLimits = getUserContentRatingLimits(req.user);

    try {
      const languages = await tmdb.getLanguages();

      const language = languages.find(
        (lang) => lang.iso_639_1 === req.params.language
      );

      if (!language) {
        return next({ status: 404, message: 'Language not found.' });
      }

      // Apply user's content rating limits (parental controls)
      const certificationOverrides = applyMovieCertificationLimits(
        {},
        ratingLimits
      );

      const langDiscoverOpts = {
        language: (req.query.language as string) ?? req.locale,
        originalLanguage: req.params.language,
        certificationLte: certificationOverrides.certificationLte,
        certificationCountry: certificationOverrides.certificationCountry,
      };
      const langPage = Number(req.query.page);

      const data = await tmdb.getDiscoverMovies({
        page: langPage,
        ...langDiscoverOpts,
      });

      const filteredResults = await postFilterDiscoverMovies(
        data.results,
        tmdb,
        ratingLimits,
        langPage < data.total_pages
          ? async () =>
              (
                await tmdb.getDiscoverMovies({
                  page: langPage + 1,
                  ...langDiscoverOpts,
                })
              ).results
          : undefined
      );

      const media = await Media.getRelatedMedia(
        req.user,
        filteredResults.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        language,
        results: filteredResults.map((result) =>
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
    const ratingLimits = getUserContentRatingLimits(req.user);

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

      // Apply user's content rating limits (parental controls)
      const certificationOverrides = applyMovieCertificationLimits(
        {},
        ratingLimits
      );

      const genreDiscoverOpts = {
        language: (req.query.language as string) ?? req.locale,
        genre: req.params.genreId as string,
        certificationLte: certificationOverrides.certificationLte,
        certificationCountry: certificationOverrides.certificationCountry,
      };
      const genrePage = Number(req.query.page);

      const data = await tmdb.getDiscoverMovies({
        page: genrePage,
        ...genreDiscoverOpts,
      });

      const filteredResults = await postFilterDiscoverMovies(
        data.results,
        tmdb,
        ratingLimits,
        genrePage < data.total_pages
          ? async () =>
              (
                await tmdb.getDiscoverMovies({
                  page: genrePage + 1,
                  ...genreDiscoverOpts,
                })
              ).results
          : undefined
      );

      const media = await Media.getRelatedMedia(
        req.user,
        filteredResults.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        genre,
        results: filteredResults.map((result) =>
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
    const tmdb = new TheMovieDb();
    const ratingLimits = getUserContentRatingLimits(req.user);

    try {
      const studio = await tmdb.getStudio(Number(req.params.studioId));

      // Apply user's content rating limits (parental controls)
      const certificationOverrides = applyMovieCertificationLimits(
        {},
        ratingLimits
      );

      const studioDiscoverOpts = {
        language: (req.query.language as string) ?? req.locale,
        studio: req.params.studioId as string,
        certificationLte: certificationOverrides.certificationLte,
        certificationCountry: certificationOverrides.certificationCountry,
      };
      const studioPage = Number(req.query.page);

      const data = await tmdb.getDiscoverMovies({
        page: studioPage,
        ...studioDiscoverOpts,
      });

      const filteredResults = await postFilterDiscoverMovies(
        data.results,
        tmdb,
        ratingLimits,
        studioPage < data.total_pages
          ? async () =>
              (
                await tmdb.getDiscoverMovies({
                  page: studioPage + 1,
                  ...studioDiscoverOpts,
                })
              ).results
          : undefined
      );

      const media = await Media.getRelatedMedia(
        req.user,
        filteredResults.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        studio: mapProductionCompany(studio),
        results: filteredResults.map((result) =>
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

discoverRoutes.get('/movies/upcoming', async (req, res, next) => {
  const tmdb = createTmdbWithRegionLanguage(req.user);
  const ratingLimits = getUserContentRatingLimits(req.user);

  const now = new Date();
  const offset = now.getTimezoneOffset();
  const date = new Date(now.getTime() - offset * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Apply user's content rating limits (parental controls)
  const certificationOverrides = applyMovieCertificationLimits(
    {},
    ratingLimits
  );

  const upcomingMovieOpts = {
    language: (req.query.language as string) ?? req.locale,
    primaryReleaseDateGte: date,
    certificationLte: certificationOverrides.certificationLte,
    certificationCountry: certificationOverrides.certificationCountry,
  };
  const upcomingMoviePage = Number(req.query.page);

  try {
    const data = await tmdb.getDiscoverMovies({
      page: upcomingMoviePage,
      ...upcomingMovieOpts,
    });

    const filteredResults = await postFilterDiscoverMovies(
      data.results,
      tmdb,
      ratingLimits,
      upcomingMoviePage < data.total_pages
        ? async () =>
            (
              await tmdb.getDiscoverMovies({
                page: upcomingMoviePage + 1,
                ...upcomingMovieOpts,
              })
            ).results
        : undefined
    );

    const media = await Media.getRelatedMedia(
      req.user,
      filteredResults.map((result) => result.id)
    );

    return res.status(200).json({
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      results: filteredResults.map((result) =>
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
  const ratingLimits = getUserContentRatingLimits(req.user);

  try {
    const query = ApiQuerySchema.parse(req.query);
    const keywords = query.keywords;
    const excludeKeywords = query.excludeKeywords;

    // Apply user's content rating limits (parental controls)
    const certificationOverrides = applyTvCertificationLimits(
      {
        certification: query.certification,
        certificationLte: query.certificationLte,
        certificationCountry: query.certificationCountry,
      },
      ratingLimits
    );

    const tvDiscoverOpts = {
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
      certificationLte:
        certificationOverrides.certificationLte ?? query.certificationLte,
      certificationCountry:
        certificationOverrides.certificationCountry ??
        query.certificationCountry,
    };
    const tvPage = Number(query.page);

    const data = await tmdb.getDiscoverTv({
      page: tvPage,
      ...tvDiscoverOpts,
    });

    // Post-filter unrated content if blockUnrated is enabled
    const filteredResults = await postFilterDiscoverTv(
      data.results,
      tmdb,
      ratingLimits,
      tvPage < data.total_pages
        ? async () =>
            (await tmdb.getDiscoverTv({ page: tvPage + 1, ...tvDiscoverOpts }))
              .results
        : undefined
    );

    const media = await Media.getRelatedMedia(
      req.user,
      filteredResults.map((result) => result.id)
    );

    let keywordData: TmdbKeyword[] = [];
    if (keywords) {
      const keywordResults = await Promise.all(
        keywords
          .split(',')
          .map((keywordId) =>
            tmdb.getKeywordDetails({ keywordId: Number(keywordId) })
          )
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
      results: filteredResults.map((result) =>
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
    const ratingLimits = getUserContentRatingLimits(req.user);

    try {
      const languages = await tmdb.getLanguages();

      const language = languages.find(
        (lang) => lang.iso_639_1 === req.params.language
      );

      if (!language) {
        return next({ status: 404, message: 'Language not found.' });
      }

      // Apply user's content rating limits (parental controls)
      const certificationOverrides = applyTvCertificationLimits(
        {},
        ratingLimits
      );

      const tvLangOpts = {
        language: (req.query.language as string) ?? req.locale,
        originalLanguage: req.params.language,
        certificationLte: certificationOverrides.certificationLte,
        certificationCountry: certificationOverrides.certificationCountry,
      };
      const tvLangPage = Number(req.query.page);

      const data = await tmdb.getDiscoverTv({
        page: tvLangPage,
        ...tvLangOpts,
      });

      const filteredResults = await postFilterDiscoverTv(
        data.results,
        tmdb,
        ratingLimits,
        tvLangPage < data.total_pages
          ? async () =>
              (
                await tmdb.getDiscoverTv({
                  page: tvLangPage + 1,
                  ...tvLangOpts,
                })
              ).results
          : undefined
      );

      const media = await Media.getRelatedMedia(
        req.user,
        filteredResults.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        language,
        results: filteredResults.map((result) =>
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
    const ratingLimits = getUserContentRatingLimits(req.user);

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

      // Apply user's content rating limits (parental controls)
      const certificationOverrides = applyTvCertificationLimits(
        {},
        ratingLimits
      );

      const tvGenreOpts = {
        language: (req.query.language as string) ?? req.locale,
        genre: req.params.genreId,
        certificationLte: certificationOverrides.certificationLte,
        certificationCountry: certificationOverrides.certificationCountry,
      };
      const tvGenrePage = Number(req.query.page);

      const data = await tmdb.getDiscoverTv({
        page: tvGenrePage,
        ...tvGenreOpts,
      });

      const filteredResults = await postFilterDiscoverTv(
        data.results,
        tmdb,
        ratingLimits,
        tvGenrePage < data.total_pages
          ? async () =>
              (
                await tmdb.getDiscoverTv({
                  page: tvGenrePage + 1,
                  ...tvGenreOpts,
                })
              ).results
          : undefined
      );

      const media = await Media.getRelatedMedia(
        req.user,
        filteredResults.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        genre,
        results: filteredResults.map((result) =>
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
    const ratingLimits = getUserContentRatingLimits(req.user);

    try {
      const network = await tmdb.getNetwork(Number(req.params.networkId));

      // Apply user's content rating limits (parental controls)
      const certificationOverrides = applyTvCertificationLimits(
        {},
        ratingLimits
      );

      const tvNetworkOpts = {
        language: (req.query.language as string) ?? req.locale,
        network: Number(req.params.networkId),
        certificationLte: certificationOverrides.certificationLte,
        certificationCountry: certificationOverrides.certificationCountry,
      };
      const tvNetworkPage = Number(req.query.page);

      const data = await tmdb.getDiscoverTv({
        page: tvNetworkPage,
        ...tvNetworkOpts,
      });

      const filteredResults = await postFilterDiscoverTv(
        data.results,
        tmdb,
        ratingLimits,
        tvNetworkPage < data.total_pages
          ? async () =>
              (
                await tmdb.getDiscoverTv({
                  page: tvNetworkPage + 1,
                  ...tvNetworkOpts,
                })
              ).results
          : undefined
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
        results: filteredResults.map((result) =>
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

discoverRoutes.get('/tv/upcoming', async (req, res, next) => {
  const tmdb = createTmdbWithRegionLanguage(req.user);
  const ratingLimits = getUserContentRatingLimits(req.user);

  const now = new Date();
  const offset = now.getTimezoneOffset();
  const date = new Date(now.getTime() - offset * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Apply user's content rating limits (parental controls)
  const certificationOverrides = applyTvCertificationLimits({}, ratingLimits);

  const upcomingTvOpts = {
    language: (req.query.language as string) ?? req.locale,
    firstAirDateGte: date,
    certificationLte: certificationOverrides.certificationLte,
    certificationCountry: certificationOverrides.certificationCountry,
  };
  const upcomingTvPage = Number(req.query.page);

  try {
    const data = await tmdb.getDiscoverTv({
      page: upcomingTvPage,
      ...upcomingTvOpts,
    });

    const filteredResults = await postFilterDiscoverTv(
      data.results,
      tmdb,
      ratingLimits,
      upcomingTvPage < data.total_pages
        ? async () =>
            (
              await tmdb.getDiscoverTv({
                page: upcomingTvPage + 1,
                ...upcomingTvOpts,
              })
            ).results
        : undefined
    );

    const media = await Media.getRelatedMedia(
      req.user,
      filteredResults.map((result) => result.id)
    );

    return res.status(200).json({
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      results: filteredResults.map((result) =>
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
  const ratingLimits = getUserContentRatingLimits(req.user);
  const hasLimits =
    ratingLimits.maxMovieRating ||
    ratingLimits.maxTvRating ||
    ratingLimits.blockUnrated ||
    ratingLimits.blockAdult;

  try {
    const data = await tmdb.getAllTrending({
      page: Number(req.query.page),
      language: (req.query.language as string) ?? req.locale,
    });

    // Post-filter trending results if user has any parental controls
    let filteredResults = data.results;
    if (hasLimits) {
      const movieResults = data.results.filter(isMovie) as TmdbMovieResult[];
      const tvResults = data.results.filter(
        (r) => !isMovie(r) && !isPerson(r) && !isCollection(r)
      ) as TmdbTvResult[];
      const otherResults = data.results.filter(
        (r) => isPerson(r) || isCollection(r)
      );

      const filteredMovies = await postFilterDiscoverMovies(
        movieResults,
        tmdb,
        ratingLimits,
        undefined,
        false // trending has no certification.lte pre-filter
      );
      const filteredTv = await postFilterDiscoverTv(
        tvResults,
        tmdb,
        ratingLimits,
        undefined,
        false // trending has no certification.lte pre-filter
      );

      filteredResults = [
        ...filteredMovies,
        ...filteredTv,
        ...otherResults,
      ] as typeof data.results;
    }

    const media = await Media.getRelatedMedia(
      req.user,
      filteredResults.map((result) => result.id)
    );

    return res.status(200).json({
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      results: filteredResults.map((result) =>
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
    const ratingLimits = getUserContentRatingLimits(req.user);

    try {
      const data = await tmdb.getMoviesByKeyword({
        keywordId: Number(req.params.keywordId),
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
      });

      const filteredResults = await postFilterDiscoverMovies(
        data.results,
        tmdb,
        ratingLimits,
        undefined,
        false // keyword endpoint has no certification.lte pre-filter
      );

      const media = await Media.getRelatedMedia(
        req.user,
        filteredResults.map((result) => result.id)
      );

      return res.status(200).json({
        page: data.page,
        totalPages: data.total_pages,
        totalResults: data.total_results,
        results: filteredResults.map((result) =>
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
