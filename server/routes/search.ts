import MusicBrainz from '@server/api/musicbrainz';
import type {
  MbAlbumResult,
  MbArtistResult,
} from '@server/api/musicbrainz/interfaces';
import TheMovieDb from '@server/api/themoviedb';
import Media from '@server/entity/Media';
import {
  findSearchProvider,
  type CombinedSearchResponse,
} from '@server/lib/search';
import logger from '@server/logger';
import { mapSearchResults } from '@server/models/Search';
import { Router } from 'express';

const searchRoutes = Router();

searchRoutes.get('/', async (req, res, next) => {
  const queryString = req.query.query as string;
  const searchProvider = findSearchProvider(queryString.toLowerCase());
  let results: CombinedSearchResponse;
  let combinedResults: CombinedSearchResponse['results'] = [];

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
      const tmdbResults = await tmdb.searchMulti({
        query: queryString,
        page: Number(req.query.page),
      });

      combinedResults = [...tmdbResults.results];

      const musicbrainz = new MusicBrainz();
      const mbResults = await musicbrainz.searchMulti({ query: queryString });

      if (mbResults.length > 0) {
        const mbMappedResults = mbResults.map((result) => {
          if (result.artist) {
            return {
              ...result.artist,
              media_type: 'artist',
            } as MbArtistResult;
          }
          if (result.album) {
            return {
              ...result.album,
              media_type: 'album',
            } as MbAlbumResult;
          }
          throw new Error('Invalid search result type');
        });

        combinedResults = [...combinedResults, ...mbMappedResults];
      }

      results = {
        page: tmdbResults.page,
        total_pages: tmdbResults.total_pages,
        total_results: tmdbResults.total_results + mbResults.length,
        results: combinedResults,
      };
    }

    const media = await Media.getRelatedMedia(
      req.user,
      results.results.map((result) => ('id' in result ? result.id : 0))
    );

    const mappedResults = await mapSearchResults(results.results, media);

    return res.status(200).json({
      page: results.page,
      totalPages: results.total_pages,
      totalResults: results.total_results,
      results: mappedResults,
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
