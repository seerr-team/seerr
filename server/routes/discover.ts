import ListenBrainzAPI from '@server/api/listenbrainz';
import MusicBrainz from '@server/api/musicbrainz';
import PlexTvAPI from '@server/api/plextv';
import TheAudioDb from '@server/api/theaudiodb';
import type { SortOptions } from '@server/api/themoviedb';
import TheMovieDb from '@server/api/themoviedb';
import type { TmdbKeyword } from '@server/api/themoviedb/interfaces';
import TmdbPersonMapper from '@server/api/themoviedb/personMapper';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MetadataAlbum from '@server/entity/MetadataAlbum';
import MetadataArtist from '@server/entity/MetadataArtist';
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
import { In } from 'typeorm';
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
    const tmdb = new TheMovieDb();

    try {
      const studio = await tmdb.getStudio(Number(req.params.studioId));

      const data = await tmdb.getDiscoverMovies({
        page: Number(req.query.page),
        language: (req.query.language as string) ?? req.locale,
        studio: req.params.studioId as string,
      });

      const media = await Media.getRelatedMedia(
        req.user,
        data.results.map((result) => result.id)
      );

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

discoverRoutes.get('/music', async (req, res, next) => {
  const listenbrainz = new ListenBrainzAPI();

  try {
    const page = Number(req.query.page) || 1;
    const pageSize = 20;
    const sortBy = (req.query.sortBy as string) || 'release_date.desc';
    const days = Number(req.query.days) || 30;
    const genreFilter = req.query.genre as string | undefined;
    const releaseTypeFilter = req.query.releaseType as string | undefined;
    const showOnlyWithCovers = req.query.onlyWithCoverArt === 'true';
    const releaseDateGte = req.query.releaseDateGte as string | undefined;
    const releaseDateLte = req.query.releaseDateLte as string | undefined;

    // When a genre filter is active, use MusicBrainz tag search for
    // comprehensive genre browsing instead of filtering within the limited
    // ListenBrainz fresh releases window.
    if (genreFilter) {
      const musicbrainz = new MusicBrainz();
      const tags = genreFilter.split(',').map((g) => g.trim());

      const primaryTypes = releaseTypeFilter
        ? releaseTypeFilter.split(',')
        : undefined;

      const { releaseGroups, totalCount } =
        await musicbrainz.searchReleaseGroupsByTag({
          tags,
          primaryTypes,
          releaseDateGte,
          releaseDateLte,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });

      // Get MBIDs for metadata lookup
      const mbIds = releaseGroups.map((rg) => rg.id).filter(Boolean);

      // Look up cached cover art from MetadataAlbum table
      const existingMetadata =
        mbIds.length > 0
          ? await getRepository(MetadataAlbum).find({
              where: { mbAlbumId: In(mbIds) },
              select: ['mbAlbumId', 'caaUrl'],
              cache: true,
            })
          : [];

      const metadataMap = new Map(
        existingMetadata.map((meta) => [meta.mbAlbumId, meta])
      );

      // Look up media info for request status
      const media =
        mbIds.length > 0 ? await Media.getRelatedMedia(req.user, mbIds) : [];
      const mediaMap = new Map(media.map((m) => [m.mbId, m]));

      // Map MusicBrainz results to response format
      const results = releaseGroups.map((rg) => {
        const metadata = metadataMap.get(rg.id);
        const hasCoverArt = !!metadata?.caaUrl;

        return {
          id: rg.id,
          mediaType: 'album',
          'primary-type': rg['primary-type'] || 'Album',
          secondaryType: rg['secondary-types']?.[0],
          title: rg.title,
          'artist-credit':
            rg['artist-credit']?.map((ac) => ({
              name: ac.name,
            })) || [],
          artistId: rg['artist-credit']?.[0]?.artist?.id,
          mediaInfo: mediaMap.get(rg.id),
          releaseDate: rg['first-release-date'] || '',
          posterPath: metadata?.caaUrl || null,
          needsCoverArt: !hasCoverArt,
        };
      });

      const [field, direction] = sortBy.split('.');
      results.sort((a, b) => {
        const multiplier = direction === 'asc' ? 1 : -1;
        switch (field) {
          case 'release_date': {
            const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
            const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
            return (dateA - dateB) * multiplier;
          }
          case 'title': {
            return (a.title ?? '').localeCompare(b.title ?? '') * multiplier;
          }
          case 'artist': {
            const artistA = a['artist-credit']?.[0]?.name ?? '';
            const artistB = b['artist-credit']?.[0]?.name ?? '';
            return artistA.localeCompare(artistB) * multiplier;
          }
          default:
            return 0;
        }
      });

      const totalPages = Math.ceil(totalCount / pageSize);

      return res.json({
        page,
        totalPages,
        totalResults: totalCount,
        results,
      });
    }

    const [field, direction] = sortBy.split('.');
    let apiSortField = 'release_date';

    if (field === 'title') {
      apiSortField = 'release_name';
    } else if (field === 'artist') {
      apiSortField = 'artist_credit_name';
    }

    const freshReleasesData = await listenbrainz.getFreshReleases({
      days,
      sort: apiSortField,
      count: 100,
    });

    let filteredReleases = freshReleasesData.payload.releases;

    if (releaseTypeFilter) {
      const types = releaseTypeFilter.split(',');
      filteredReleases = filteredReleases.filter((release) => {
        const primaryType = release.release_group_primary_type || 'Album';
        const secondaryType = release.release_group_secondary_type;
        return (
          types.includes(primaryType) ||
          (secondaryType && types.includes(secondaryType))
        );
      });
    }

    if (genreFilter) {
      const genres = genreFilter.split(',').map((g) => g.toLowerCase());
      filteredReleases = filteredReleases.filter((release) => {
        if (!release.release_tags || release.release_tags.length === 0) {
          return false;
        }
        const lowerTags = release.release_tags.map((t) => t.toLowerCase());
        return genres.some((genre) =>
          lowerTags.some((tag) => tag.includes(genre) || genre.includes(tag))
        );
      });
    }

    if (releaseDateGte || releaseDateLte) {
      filteredReleases = filteredReleases.filter((release) => {
        if (!release.release_date) {
          return false;
        }

        const releaseDate = new Date(release.release_date);

        if (releaseDateGte) {
          const gteDate = new Date(releaseDateGte);
          if (releaseDate < gteDate) {
            return false;
          }
        }

        if (releaseDateLte) {
          const lteDate = new Date(releaseDateLte);
          if (releaseDate > lteDate) {
            return false;
          }
        }

        return true;
      });
    }

    filteredReleases.sort((a, b) => {
      const multiplier = direction === 'asc' ? 1 : -1;

      switch (field) {
        case 'release_date': {
          const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
          const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
          return (dateA - dateB) * multiplier;
        }
        case 'title': {
          return (
            (a.release_name ?? '').localeCompare(b.release_name ?? '') *
            multiplier
          );
        }
        case 'artist': {
          return (
            (a.artist_credit_name ?? '').localeCompare(
              b.artist_credit_name ?? ''
            ) * multiplier
          );
        }
        default:
          return 0;
      }
    });

    const mbIds = filteredReleases
      .map((release) => release.release_group_mbid)
      .filter(Boolean);

    const existingMetadata =
      mbIds.length > 0
        ? await getRepository(MetadataAlbum).find({
            where: { mbAlbumId: In(mbIds) },
            select: ['mbAlbumId', 'caaUrl'],
            cache: true,
          })
        : [];

    const metadataMap = new Map(
      existingMetadata.map((meta) => [meta.mbAlbumId, meta])
    );

    if (showOnlyWithCovers) {
      filteredReleases = filteredReleases.filter((release) => {
        if (!release.release_group_mbid) {
          return false;
        }
        const metadata = metadataMap.get(release.release_group_mbid);
        return !!metadata?.caaUrl;
      });
    }

    const totalResults = filteredReleases.length;
    const totalPages = Math.ceil(totalResults / pageSize);

    const offset = (page - 1) * pageSize;
    const paginatedReleases = filteredReleases.slice(offset, offset + pageSize);

    const paginatedMbIds = paginatedReleases
      .map((release) => release.release_group_mbid)
      .filter(Boolean);

    if (paginatedMbIds.length === 0) {
      const results = paginatedReleases.map((release) => {
        let secondaryType;
        if (release.release_group_secondary_type) {
          secondaryType = release.release_group_secondary_type;
        } else if (release.release_tags && release.release_tags.length > 0) {
          secondaryType = release.release_tags[0];
        }

        return {
          id: null,
          mediaType: 'album',
          'primary-type': release.release_group_primary_type || 'Album',
          secondaryType,
          title: release.release_name,
          'artist-credit': [{ name: release.artist_credit_name }],
          releaseDate: release.release_date,
          posterPath: undefined,
        };
      });

      return res.json({
        page,
        totalPages,
        totalResults,
        results,
      });
    }

    const media = await Media.getRelatedMedia(req.user, paginatedMbIds);

    const mediaMap = new Map(
      media.map((mediaItem) => [mediaItem.mbId, mediaItem])
    );

    const results = paginatedReleases.map((release) => {
      if (!release.release_group_mbid) {
        let secondaryType;
        if (release.release_group_secondary_type) {
          secondaryType = release.release_group_secondary_type;
        } else if (release.release_tags && release.release_tags.length > 0) {
          secondaryType = release.release_tags[0];
        }

        return {
          id: null,
          mediaType: 'album',
          'primary-type': release.release_group_primary_type || 'Album',
          secondaryType,
          title: release.release_name,
          'artist-credit': [{ name: release.artist_credit_name }],
          releaseDate: release.release_date,
          posterPath: undefined,
        };
      }

      const metadata = metadataMap.get(release.release_group_mbid);
      const hasCoverArt = !!metadata?.caaUrl;

      let secondaryType;
      if (release.release_group_secondary_type) {
        secondaryType = release.release_group_secondary_type;
      } else if (release.release_tags && release.release_tags.length > 0) {
        secondaryType = release.release_tags[0];
      }

      return {
        id: release.release_group_mbid,
        mediaType: 'album',
        'primary-type': release.release_group_primary_type || 'Album',
        secondaryType,
        title: release.release_name,
        'artist-credit': [{ name: release.artist_credit_name }],
        artistId: release.artist_mbids?.[0],
        mediaInfo: mediaMap.get(release.release_group_mbid),
        releaseDate: release.release_date,
        posterPath: metadata?.caaUrl || null,
        needsCoverArt: !hasCoverArt,
      };
    });

    return res.json({
      page,
      totalPages,
      totalResults,
      results,
    });
  } catch (e) {
    logger.error('Failed to retrieve fresh music releases', {
      label: 'API',
      error: e instanceof Error ? e.message : 'Unknown error',
      stack: e instanceof Error ? e.stack : undefined,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve fresh music releases.',
    });
  }
});

discoverRoutes.get('/music/albums', async (req, res, next) => {
  const listenbrainz = new ListenBrainzAPI();

  try {
    const page = Number(req.query.page) || 1;
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const sortBy = (req.query.sortBy as string) || 'listen_count.desc';

    const topAlbumsData = await listenbrainz.getTopAlbums({
      offset,
      count: pageSize,
      range: 'week',
    });

    const mbIds = topAlbumsData.payload.release_groups
      .map((album) => album.release_group_mbid)
      .filter((id): id is string => !!id);

    if (mbIds.length === 0) {
      const results = topAlbumsData.payload.release_groups.map((album) => ({
        id: null,
        mediaType: 'album',
        'primary-type': 'Album',
        title: album.release_group_name,
        'artist-credit': [{ name: album.artist_name }],
        listenCount: album.listen_count,
        posterPath: undefined,
      }));

      return res.json({
        page,
        totalPages: Math.ceil(topAlbumsData.payload.count / pageSize),
        totalResults: topAlbumsData.payload.count,
        results,
      });
    }

    const [existingMetadata, media] = await Promise.all([
      getRepository(MetadataAlbum).find({
        where: { mbAlbumId: In(mbIds) },
        select: ['mbAlbumId', 'caaUrl'],
        cache: true,
      }),
      Media.getRelatedMedia(req.user, mbIds),
    ]);

    const metadataMap = new Map(
      existingMetadata.map((meta) => [meta.mbAlbumId, meta])
    );

    const mediaMap = new Map(
      media.map((mediaItem) => [mediaItem.mbId, mediaItem])
    );

    const results = topAlbumsData.payload.release_groups.map((album) => {
      if (!album.release_group_mbid) {
        return {
          id: null,
          mediaType: 'album',
          'primary-type': 'Album',
          title: album.release_group_name,
          'artist-credit': [{ name: album.artist_name }],
          listenCount: album.listen_count,
          posterPath: undefined,
        };
      }

      const metadata = metadataMap.get(album.release_group_mbid);
      const hasCoverArt = !!metadata?.caaUrl;

      return {
        id: album.release_group_mbid,
        mediaType: 'album',
        'primary-type': 'Album',
        title: album.release_group_name,
        'artist-credit': [{ name: album.artist_name }],
        artistId: album.artist_mbids[0],
        mediaInfo: mediaMap.get(album.release_group_mbid),
        listenCount: album.listen_count,
        posterPath: metadata?.caaUrl || null,
        needsCoverArt: !hasCoverArt,
      };
    });

    if (sortBy) {
      const [field, direction] = sortBy.split('.');
      const multiplier = direction === 'asc' ? 1 : -1;

      results.sort((a, b) => {
        switch (field) {
          case 'listen_count': {
            return (a.listenCount - b.listenCount) * multiplier;
          }
          case 'title': {
            return (a.title ?? '').localeCompare(b.title ?? '') * multiplier;
          }
          default:
            return 0;
        }
      });
    }

    return res.json({
      page,
      totalPages: Math.ceil(topAlbumsData.payload.count / pageSize),
      totalResults: topAlbumsData.payload.count,
      results,
    });
  } catch (e) {
    logger.error('Failed to retrieve popular music', {
      label: 'API',
      error: e instanceof Error ? e.message : 'Unknown error',
    });
    return next({
      status: 500,
      message: 'Unable to retrieve popular music.',
    });
  }
});

discoverRoutes.get('/music/artists', async (req, res, next) => {
  const listenbrainz = new ListenBrainzAPI();
  const personMapper = new TmdbPersonMapper();
  const theAudioDb = new TheAudioDb();

  try {
    const page = Number(req.query.page) || 1;
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const sortBy = (req.query.sortBy as string) || 'listen_count.desc';

    const topArtistsData = await listenbrainz.getTopArtists({
      offset,
      count: pageSize,
      range: 'week',
    });

    const mbIds = topArtistsData.payload.artists
      .map((artist) => artist.artist_mbid)
      .filter(Boolean);

    if (mbIds.length === 0) {
      return res.status(200).json({
        page,
        totalPages: Math.ceil(topArtistsData.payload.count / pageSize),
        totalResults: topArtistsData.payload.count,
        results: topArtistsData.payload.artists.map((artist) => ({
          id: null,
          mediaType: 'artist',
          name: artist.artist_name,
          listenCount: artist.listen_count,
        })),
      });
    }

    const [media, artistMetadata] = await Promise.all([
      Media.getRelatedMedia(req.user, mbIds),
      getRepository(MetadataArtist).find({
        where: { mbArtistId: In(mbIds) },
      }),
    ]);

    const mediaMap = new Map(
      media.map((mediaItem) => [mediaItem.mbId, mediaItem])
    );

    const metadataMap = new Map(
      artistMetadata.map((metadata) => [metadata.mbArtistId, metadata])
    );

    const artistsNeedingImages = mbIds.filter((id) => {
      const metadata = metadataMap.get(id);
      return !metadata?.tadbThumb && !metadata?.tadbCover;
    });

    const artistsForPersonMapping = topArtistsData.payload.artists
      .filter((artist) => artist.artist_mbid)
      .filter((artist) => {
        const metadata = metadataMap.get(artist.artist_mbid);
        return !metadata?.tmdbPersonId;
      })
      .map((artist) => ({
        artistId: artist.artist_mbid,
        artistName: artist.artist_name,
      }));

    interface ArtistImageResults {
      [key: string]: {
        artistThumb?: string;
        artistBackground?: string;
      };
    }

    const responses = await Promise.allSettled([
      artistsNeedingImages.length > 0
        ? theAudioDb.batchGetArtistImages(artistsNeedingImages)
        : Promise.resolve({} as ArtistImageResults),
      artistsForPersonMapping.length > 0
        ? personMapper.batchGetMappings(artistsForPersonMapping)
        : Promise.resolve({}),
    ]);

    const artistImageResults =
      responses[0].status === 'fulfilled' ? responses[0].value : {};

    let updatedArtistMetadata = artistMetadata;
    if (artistsForPersonMapping.length > 0 || artistsNeedingImages.length > 0) {
      updatedArtistMetadata = await getRepository(MetadataArtist).find({
        where: { mbArtistId: In(mbIds) },
      });
    }

    const updatedMetadataMap = new Map(
      updatedArtistMetadata.map((metadata) => [metadata.mbArtistId, metadata])
    );

    const results = topArtistsData.payload.artists.map((artist) => {
      if (!artist.artist_mbid) {
        return {
          id: null,
          mediaType: 'artist',
          name: artist.artist_name,
          listenCount: artist.listen_count,
        };
      }

      const metadata = updatedMetadataMap.get(artist.artist_mbid);
      const imageResult = artistImageResults[artist.artist_mbid];

      return {
        id: artist.artist_mbid,
        mediaType: 'artist',
        name: artist.artist_name,
        mediaInfo: mediaMap.get(artist.artist_mbid),
        listenCount: artist.listen_count,
        artistThumb:
          metadata?.tmdbThumb ??
          metadata?.tadbThumb ??
          imageResult?.artistThumb ??
          null,
        artistBackdrop:
          metadata?.tadbCover ?? imageResult?.artistBackground ?? null,
        tmdbPersonId: metadata?.tmdbPersonId
          ? Number(metadata.tmdbPersonId)
          : null,
      };
    });

    if (sortBy) {
      const [field, direction] = sortBy.split('.');
      const multiplier = direction === 'asc' ? 1 : -1;

      results.sort((a, b) => {
        switch (field) {
          case 'listen_count':
            return (a.listenCount - b.listenCount) * multiplier;
          case 'name':
            return (a.name ?? '').localeCompare(b.name ?? '') * multiplier;
          default:
            return 0;
        }
      });
    }

    return res.status(200).json({
      page,
      totalPages: Math.ceil(topArtistsData.payload.count / pageSize),
      totalResults: topArtistsData.payload.count,
      results,
    });
  } catch (e) {
    logger.error('Failed to retrieve popular artists', {
      label: 'API',
      error: e instanceof Error ? e.message : 'Unknown error',
    });
    return next({
      status: 500,
      message: 'Unable to retrieve popular artists.',
    });
  }
});

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
