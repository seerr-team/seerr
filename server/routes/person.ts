import TheMovieDb from '@server/api/themoviedb';
import Media from '@server/entity/Media';
import { getUserContentRatingLimits } from '@server/lib/contentRating';
import logger from '@server/logger';
import { filterCreditsByRating } from '@server/middleware/ratingCheck';
import {
  mapCastCredits,
  mapCrewCredits,
  mapPersonDetails,
} from '@server/models/Person';
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

    // Filter credits by user's content rating limits
    const limits = getUserContentRatingLimits(req.user);
    const filteredCast = await filterCreditsByRating(
      combinedCredits.cast,
      tmdb,
      limits
    );
    const filteredCrew = await filterCreditsByRating(
      combinedCredits.crew,
      tmdb,
      limits
    );

    const castMedia = await Media.getRelatedMedia(
      req.user,
      filteredCast.map((result) => result.id)
    );

    const crewMedia = await Media.getRelatedMedia(
      req.user,
      filteredCrew.map((result) => result.id)
    );

    return res.status(200).json({
      cast: filteredCast
        .map((result) =>
          mapCastCredits(
            result,
            castMedia.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === result.media_type
            )
          )
        )
        .filter((item) => !item.adult),
      crew: filteredCrew
        .map((result) =>
          mapCrewCredits(
            result,
            crewMedia.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === result.media_type
            )
          )
        )
        .filter((item) => !item.adult),
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
