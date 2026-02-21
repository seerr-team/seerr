import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbCollectionResult,
  TmdbMovieResult,
  TmdbPersonResult,
  TmdbSearchMultiResponse,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import {
  shouldFilterMovie,
  shouldFilterTv,
} from '@server/constants/contentRatings';
import Media from '@server/entity/Media';
import { findSearchProvider } from '@server/lib/search';
import logger from '@server/logger';
import { mapSearchResults } from '@server/models/Search';
import { getUserContentRatingLimits } from '@server/routes/discover';
import { Router } from 'express';

type TmdbSearchResult =
  | TmdbMovieResult
  | TmdbTvResult
  | TmdbPersonResult
  | TmdbCollectionResult;

/**
 * Fetch US certification for a single search result.
 * Returns the result paired with its certification, or null on failure.
 */
const getCertification = async (
  result: TmdbSearchResult,
  tmdb: TheMovieDb
): Promise<{ result: TmdbSearchResult; certification?: string } | null> => {
  try {
    if (result.media_type === 'movie') {
      const details = await tmdb.getMovie({ movieId: result.id });
      const usRelease = details.release_dates?.results?.find(
        (r) => r.iso_3166_1 === 'US'
      );
      return {
        result,
        certification: usRelease?.release_dates?.find((rd) => rd.certification)
          ?.certification,
      };
    } else if (result.media_type === 'tv') {
      const details = await tmdb.getTvShow({ tvId: result.id });
      const usRating = details.content_ratings?.results?.find(
        (r) => r.iso_3166_1 === 'US'
      );
      return { result, certification: usRating?.rating };
    }
    // Person/collection — no certification needed
    return { result };
  } catch {
    return null; // Fail closed — will be filtered out
  }
};

/** Minimum results before triggering a backfill from the next TMDB page */
const BACKFILL_THRESHOLD = 15;

/**
 * Filter a batch of search results by content rating.
 * Fail-closed: if certification lookup fails, the result is blocked.
 */
const filterSearchBatch = async (
  results: TmdbSearchResult[],
  tmdb: TheMovieDb,
  maxMovieRating?: string,
  maxTvRating?: string,
  blockUnrated = false,
  blockAdult = false
): Promise<TmdbSearchResult[]> => {
  // Pre-filter adult content (free, no API calls needed)
  const preFiltered = blockAdult
    ? results.filter((r) => !('adult' in r && (r as TmdbMovieResult).adult))
    : results;

  // Skip expensive cert lookups when only blockAdult is active
  if (!maxMovieRating && !maxTvRating && !blockUnrated) {
    return preFiltered;
  }

  const settled = await Promise.allSettled(
    preFiltered.map((r) => getCertification(r, tmdb))
  );

  const filtered: TmdbSearchResult[] = [];

  for (const outcome of settled) {
    if (outcome.status === 'rejected' || !outcome.value) {
      continue;
    }

    const { result, certification } = outcome.value;

    if (result.media_type === 'movie') {
      if (!maxMovieRating && !blockUnrated) {
        filtered.push(result);
        continue;
      }
      if (shouldFilterMovie(certification, maxMovieRating, blockUnrated)) {
        logger.debug(
          `Filtering movie "${result.title}" (${
            certification || 'NO RATING'
          }) — limit: ${maxMovieRating}`,
          { label: 'Search' }
        );
        continue;
      }
    } else if (result.media_type === 'tv') {
      if (!maxTvRating && !blockUnrated) {
        filtered.push(result);
        continue;
      }
      if (shouldFilterTv(certification, maxTvRating, blockUnrated)) {
        logger.debug(
          `Filtering TV "${result.name}" (${
            certification || 'NO RATING'
          }) — limit: ${maxTvRating}`,
          { label: 'Search' }
        );
        continue;
      }
    }

    filtered.push(result);
  }

  return filtered;
};

/**
 * Filter search results by user's content rating limits.
 * Fetches certifications in parallel for performance.
 * When filtering drops results below BACKFILL_THRESHOLD,
 * fetches one additional TMDB page to compensate.
 */
const filterSearchResultsByRating = async (
  results: TmdbSearchResult[],
  tmdb: TheMovieDb,
  maxMovieRating?: string,
  maxTvRating?: string,
  blockUnrated = false,
  blockAdult = false,
  fetchNextPage?: () => Promise<TmdbSearchResult[] | null>
): Promise<TmdbSearchResult[]> => {
  if (!maxMovieRating && !maxTvRating && !blockUnrated && !blockAdult) {
    return results;
  }

  const filtered = await filterSearchBatch(
    results,
    tmdb,
    maxMovieRating,
    maxTvRating,
    blockUnrated,
    blockAdult
  );

  // Backfill: if too many results were removed, grab one more page
  if (filtered.length < BACKFILL_THRESHOLD && fetchNextPage) {
    const nextResults = await fetchNextPage();
    if (nextResults && nextResults.length > 0) {
      const nextFiltered = await filterSearchBatch(
        nextResults,
        tmdb,
        maxMovieRating,
        maxTvRating,
        blockUnrated,
        blockAdult
      );
      filtered.push(...nextFiltered);
    }
  }

  return filtered;
};

const searchRoutes = Router();

searchRoutes.get('/', async (req, res, next) => {
  const queryString = req.query.query as string;
  const searchProvider = findSearchProvider(queryString.toLowerCase());
  let results: TmdbSearchMultiResponse;
  const tmdb = new TheMovieDb();

  const limits = getUserContentRatingLimits(req.user);

  const searchPage = Number(req.query.page) || 1;
  const searchLang = (req.query.language as string) ?? req.locale;
  const hasFilters = !!(
    limits.maxMovieRating ||
    limits.maxTvRating ||
    limits.blockUnrated ||
    limits.blockAdult
  );

  try {
    if (searchProvider) {
      const [id] = queryString
        .toLowerCase()
        .match(searchProvider.pattern) as RegExpMatchArray;
      results = await searchProvider.search({
        id,
        language: searchLang,
        query: queryString,
      });
    } else {
      results = await tmdb.searchMulti({
        query: queryString,
        page: searchPage,
        language: searchLang,
      });
    }

    const originalCount = results.results.length;
    const filteredResults = await filterSearchResultsByRating(
      results.results,
      tmdb,
      limits.maxMovieRating,
      limits.maxTvRating,
      limits.blockUnrated ?? false,
      limits.blockAdult ?? false,
      // Only backfill for non-provider multi-search with more pages available
      !searchProvider && hasFilters && searchPage < results.total_pages
        ? async () => {
            const next = await tmdb.searchMulti({
              query: queryString,
              page: searchPage + 1,
              language: searchLang,
            });
            return next.results;
          }
        : undefined
    );
    const filteredCount = filteredResults.length;

    const media = await Media.getRelatedMedia(
      req.user,
      filteredResults.map((result) => result.id)
    );

    // Estimate total counts based on the filter ratio from this page
    const filterRatio =
      originalCount > 0 ? Math.min(1, filteredCount / originalCount) : 1;

    return res.status(200).json({
      page: results.page,
      totalPages: Math.ceil(results.total_pages * filterRatio),
      totalResults: Math.ceil(results.total_results * filterRatio),
      results: mapSearchResults(filteredResults, media),
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving search results', {
      label: 'API',
      errorMessage: e.message,
      query: req.query.query,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve search results.',
    });
  }
});

searchRoutes.get('/keyword', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const results = await tmdb.searchKeyword({
      query: req.query.query as string,
      page: Number(req.query.page),
    });

    return res.status(200).json(results);
  } catch (e) {
    logger.debug('Something went wrong retrieving keyword search results', {
      label: 'API',
      errorMessage: e.message,
      query: req.query.query,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve keyword search results.',
    });
  }
});

searchRoutes.get('/company', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const results = await tmdb.searchCompany({
      query: req.query.query as string,
      page: Number(req.query.page),
    });

    return res.status(200).json(results);
  } catch (e) {
    logger.debug('Something went wrong retrieving company search results', {
      label: 'API',
      errorMessage: e.message,
      query: req.query.query,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve company search results.',
    });
  }
});

export default searchRoutes;
