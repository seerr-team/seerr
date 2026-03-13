import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbCollectionResult,
  TmdbMovieResult,
  TmdbPersonResult,
  TmdbSearchMultiResponse,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import Media from '@server/entity/Media';
import { findSearchProvider } from '@server/lib/search';
import logger from '@server/logger';
import { mapSearchResults } from '@server/models/Search';
import { Router } from 'express';

const searchRoutes = Router();

type SearchResultItem =
  | TmdbMovieResult
  | TmdbTvResult
  | TmdbPersonResult
  | TmdbCollectionResult;

const getResultTitle = (result: SearchResultItem): string => {
  if ('title' in result) return result.title;
  if ('name' in result) return result.name;
  return '';
};

const getResultPopularity = (result: SearchResultItem): number => {
  return 'popularity' in result ? result.popularity : 0;
};

const calculateSearchScore = (
  result: SearchResultItem,
  query: string
): number => {
  const title = getResultTitle(result).toLowerCase();
  const popularity = getResultPopularity(result);

  // Popularity is the main factor (normalized to make the boost meaningful)
  let score = popularity * 10;

  // Small boost for titles that start with the query
  if (title.startsWith(query)) {
    score += 15;
  }

  // Tiny boost for exact matches (but not enough to override popularity)
  if (title === query) {
    score += 5;
  }

  return score;
};

const sortResultsByRelevanceAndPopularity = (
  results: SearchResultItem[],
  query: string
): SearchResultItem[] => {
  const normalizedQuery = query.toLowerCase().trim();

  return [...results].sort((a, b) => {
    const scoreA = calculateSearchScore(a, normalizedQuery);
    const scoreB = calculateSearchScore(b, normalizedQuery);
    return scoreB - scoreA;
  });
};

searchRoutes.get('/', async (req, res, next) => {
  const queryString = req.query.query as string;
  const searchProvider = findSearchProvider(queryString.toLowerCase());
  let results: TmdbSearchMultiResponse;

  try {
    if (searchProvider) {
      const [id] = queryString
        .toLowerCase()
        .match(searchProvider.pattern) as RegExpMatchArray;
      results = await searchProvider.search({
        id,
        language: (req.query.language as string) ?? req.locale,
        query: queryString,
      });
    } else {
      const tmdb = new TheMovieDb();

      results = await tmdb.searchMulti({
        query: queryString,
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
      });
    }

    const sortedResults = sortResultsByRelevanceAndPopularity(
      results.results,
      queryString
    );

    const media = await Media.getRelatedMedia(
      req.user,
      sortedResults.map((result) => result.id)
    );

    return res.status(200).json({
      page: results.page,
      totalPages: results.total_pages,
      totalResults: results.total_results,
      results: mapSearchResults(sortedResults, media),
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
