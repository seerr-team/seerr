import TheMovieDb from '@server/api/themoviedb';
import type { TmdbSearchMultiResponse } from '@server/api/themoviedb/interfaces';
import Media from '@server/entity/Media';
import {
  coalescePages,
  filterMixedResults,
  getUserContentRatingLimits,
} from '@server/lib/contentRating';
import { findSearchProvider } from '@server/lib/search';
import logger from '@server/logger';
import { mapSearchResults } from '@server/models/Search';
import { Router } from 'express';

const searchRoutes = Router();

searchRoutes.get('/', async (req, res, next) => {
  const queryString = req.query.query as string;
  const searchProvider = findSearchProvider(queryString.toLowerCase());
  const limits = getUserContentRatingLimits(req.user);

  try {
    let page: number;
    let totalPages: number;
    let totalResults: number;
    let filteredResults: TmdbSearchMultiResponse['results'];

    if (searchProvider) {
      const [id] = queryString
        .toLowerCase()
        .match(searchProvider.pattern) as RegExpMatchArray;
      const results = await searchProvider.search({
        id,
        language: (req.query.language as string) ?? req.locale,
        query: queryString,
      });
      page = results.page;
      totalPages = results.total_pages;
      totalResults = results.total_results;
      filteredResults = await filterMixedResults(results.results, limits);
    } else if (limits) {
      // TMDB search has no certification params, so filtering thins
      // pages. Coalesce a fixed window of upstream pages per client page
      // to keep them near full.
      const tmdb = new TheMovieDb();
      const coalesced = await coalescePages(
        Number(req.query.page) || 1,
        (p) =>
          tmdb.searchMulti({
            query: queryString,
            page: p,
            language: (req.query.language as string) ?? req.locale,
          }),
        (results) => filterMixedResults(results, limits)
      );
      page = coalesced.page;
      totalPages = coalesced.totalPages;
      totalResults = coalesced.totalResults;
      filteredResults = coalesced.results;
    } else {
      const tmdb = new TheMovieDb();
      const results = await tmdb.searchMulti({
        query: queryString,
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
      });
      page = results.page;
      totalPages = results.total_pages;
      totalResults = results.total_results;
      filteredResults = results.results;
    }

    const media = await Media.getRelatedMedia(
      req.user,
      filteredResults.map((result) => ({
        tmdbId: result.id,
        mediaType: result.media_type,
      }))
    );

    return res.status(200).json({
      page,
      totalPages,
      totalResults,
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
