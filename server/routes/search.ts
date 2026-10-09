import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbCollectionResult,
  TmdbSearchCollectionResponse,
  TmdbSearchMultiResponse,
} from '@server/api/themoviedb/interfaces';
import Media from '@server/entity/Media';
import cacheManager from '@server/lib/cache';
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
      const page = Number(req.query.page) || 1;
      const language = (req.query.language as string) ?? req.locale;

      const tmdbCache = cacheManager.getCache('tmdb').data;
      const pagesKey = `search-collections-pages:${language}:${queryString}`;
      const knownCollections = tmdbCache.get<{
        total_pages: number;
        total_results: number;
      }>(pagesKey);

      const fetchCollections =
        async (): Promise<TmdbSearchCollectionResponse> => {
          if (knownCollections && page > knownCollections.total_pages) {
            return {
              page,
              results: [],
              total_pages: knownCollections.total_pages,
              total_results: knownCollections.total_results,
            };
          }

          const collections = await tmdb.searchCollections({
            query: queryString,
            page,
            language,
          });

          tmdbCache.set(
            pagesKey,
            {
              total_pages: collections.total_pages,
              total_results: collections.total_results,
            },
            300
          );
          return collections;
        };

      const [multi, collections] = await Promise.all([
        tmdb.searchMulti({
          query: queryString,
          page,
          language,
        }),
        fetchCollections(),
      ]);

      const collectionResults: TmdbCollectionResult[] = collections.results.map(
        (collection) => ({
          id: collection.id,
          media_type: 'collection',
          adult: collection.adult,
          title: collection.name,
          original_title: collection.original_name,
          overview: collection.overview,
          original_language: collection.original_language,
          poster_path: collection.poster_path,
          backdrop_path: collection.backdrop_path,
        })
      );

      const multiWithoutCollections = multi.results.filter(
        (result) => result.media_type !== 'collection'
      );

      results = {
        page,
        total_pages: Math.max(multi.total_pages, collections.total_pages),
        total_results: multi.total_results + collections.total_results,
        results: [...collectionResults, ...multiWithoutCollections],
      };
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
