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

type SearchResponse<T> = {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
};

function tagResults(
  response: SearchResponse<
    TmdbMovieResult | TmdbTvResult | TmdbPersonResult | TmdbCollectionResult
  >,
  mediaType: 'movie' | 'tv' | 'person' | 'collection'
): TmdbSearchMultiResponse {
  return {
    ...response,
    results: response.results.map((r) => ({
      ...r,
      media_type: mediaType,
    })) as TmdbSearchMultiResponse['results'],
  };
}

const searchRoutes = Router();

searchRoutes.get('/', async (req, res, next) => {
  const queryString = req.query.query as string;
  const searchType =
    (req.query.searchType as
      | 'all'
      | 'movie'
      | 'tv'
      | 'person'
      | 'collection') ?? 'all';
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
      const searchParams = {
        query: queryString,
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
      };

      if (searchType === 'movie') {
        results = tagResults(await tmdb.searchMovies(searchParams), 'movie');
      } else if (searchType === 'tv') {
        results = tagResults(await tmdb.searchTvShows(searchParams), 'tv');
      } else if (searchType === 'person') {
        results = tagResults(await tmdb.searchPerson(searchParams), 'person');
      } else if (searchType === 'collection') {
        results = tagResults(
          await tmdb.searchCollections(searchParams),
          'collection'
        );
      } else {
        results = await tmdb.searchMulti(searchParams);
      }
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
