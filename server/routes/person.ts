import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieResult,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import {
  mapCastCredits,
  mapCrewCredits,
  mapPersonDetails,
} from '@server/models/Person';
import {
  filterMoviesByRating,
  filterTvByRating,
} from '@server/utils/contentFiltering';
import { Router } from 'express';

const personRoutes = Router();

personRoutes.get('/:id', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const person = await tmdb.getPerson({
      personId: Number(req.params.id),
      language: (req.query.language as string) ?? req.locale,
    });
    return res.status(200).json(mapPersonDetails(person));
  } catch (e) {
    logger.debug('Something went wrong retrieving person', {
      label: 'API',
      errorMessage: e.message,
      personId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve person.',
    });
  }
});

personRoutes.get('/:id/combined_credits', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const combinedCredits = await tmdb.getPersonCombinedCredits({
      personId: Number(req.params.id),
      language: (req.query.language as string) ?? req.locale,
    });

    const castMedia = await Media.getRelatedMedia(
      req.user,
      combinedCredits.cast.map((result) => result.id)
    );

    const crewMedia = await Media.getRelatedMedia(
      req.user,
      combinedCredits.crew.map((result) => result.id)
    );

    // Filter cast and crew based on content ratings
    const filteredCast = [];
    for (const result of combinedCredits.cast) {
      if (result.media_type === 'movie') {
        const filtered = await filterMoviesByRating(
          [result as TmdbMovieResult],
          req.user
        );
        if (filtered.length > 0) filteredCast.push(result);
      } else if (result.media_type === 'tv') {
        const filtered = await filterTvByRating(
          [result as TmdbTvResult],
          req.user
        );
        if (filtered.length > 0) filteredCast.push(result);
      } else {
        filteredCast.push(result);
      }
    }

    const filteredCrew = [];
    for (const result of combinedCredits.crew) {
      if (result.media_type === 'movie') {
        const filtered = await filterMoviesByRating(
          [result as TmdbMovieResult],
          req.user
        );
        if (filtered.length > 0) filteredCrew.push(result);
      } else if (result.media_type === 'tv') {
        const filtered = await filterTvByRating(
          [result as TmdbTvResult],
          req.user
        );
        if (filtered.length > 0) filteredCrew.push(result);
      } else {
        filteredCrew.push(result);
      }
    }

    return res.status(200).json({
      cast: filteredCast.map((result) =>
        mapCastCredits(
          result,
          castMedia.find(
            (med) =>
              med.tmdbId === result.id && med.mediaType === result.media_type
          )
        )
      ),
      crew: filteredCrew.map((result) =>
        mapCrewCredits(
          result,
          crewMedia.find(
            (med) =>
              med.tmdbId === result.id && med.mediaType === result.media_type
          )
        )
      ),
      id: combinedCredits.id,
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving combined credits', {
      label: 'API',
      errorMessage: e.message,
      personId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve combined credits.',
    });
  }
});

export default personRoutes;
