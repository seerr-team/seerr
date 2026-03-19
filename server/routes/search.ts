import TheMovieDb from '@server/api/themoviedb';
import type { TmdbSearchMultiResponse } from '@server/api/themoviedb/interfaces';
import Media from '@server/entity/Media';
import { findSearchProvider } from '@server/lib/search';
import logger from '@server/logger';
import { mapSearchResults } from '@server/models/Search';
import { Router } from 'express';

const searchRoutes = Router();

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

    const media = await Media.getRelatedMedia(
      req.user,
      results.results.map((result) => ({
        tmdbId: result.id,
        mediaType: result.media_type,
      }))
    );

    return res.status(200).json({
      page: results.page,
      totalPages: results.total_pages,
      totalResults: results.total_results,
      results: mapSearchResults(results.results, media),
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
  const BATCH_SIZE = 3;
  const REQUEST_TIMEOUT = 5000;

  try {
    const searchResults = await tmdb.searchKeyword({
      query: req.query.query as string,
      page: Number(req.query.page),
    });

    const resultWithContent: (typeof searchResults.results[0] | null)[] = [];
    const keywordCache = new Map<number, boolean>();

    for (let i = 0; i < searchResults.results.length; i += BATCH_SIZE) {
      const batch = searchResults.results.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (result) => {
          try {
            if (keywordCache.has(result.id)) {
              const hasContent = keywordCache.get(result.id);
              return hasContent ? result : null;
            }
            const timeoutPromise = new Promise<{ results: unknown[] }>(
              (_, reject) => {
                setTimeout(
                  () => reject(new Error('Keyword check timeout')),
                  REQUEST_TIMEOUT
                );
              }
            );

            const mediaPromise = tmdb.getMoviesByKeyword({
              keywordId: result.id,
            });

            const media = await Promise.race([mediaPromise, timeoutPromise]);
            const hasContent = media.results.length > 0;
            keywordCache.set(result.id, hasContent);
            return hasContent ? result : null;
          } catch (e) {
            logger.warn('Failed to fetch media for keyword', {
              label: 'API',
              keywordId: result.id,
              errorMessage: e instanceof Error ? e.message : 'Unknown error',
            });
            return null;
          }
        })
      );
      for (const settledResult of batchResults) {
        if (settledResult.status === 'fulfilled') {
          resultWithContent.push(settledResult.value);
        } else {
          resultWithContent.push(null);
        }
      }
    }

    const filteredResults = resultWithContent.filter((k) => k !== null);

    return res.status(200).json({
      ...searchResults,
      results: filteredResults,
      total_results: filteredResults.length,
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving keyword search results', {
      label: 'API',
      errorMessage: e instanceof Error ? e.message : 'Unknown error',
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
