import TheMovieDb from '@server/api/themoviedb';
import Media from '@server/entity/Media';
import { getUserContentRatingLimits } from '@server/lib/contentRating';
import logger from '@server/logger';
import { filterMovieListByRating } from '@server/middleware/ratingCheck';
import { mapCollection } from '@server/models/Collection';
import { Router } from 'express';

const collectionRoutes = Router();

collectionRoutes.get<{ id: string }>('/:id', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const collection = await tmdb.getCollection({
      collectionId: Number(req.params.id),
      language: (req.query.language as string) ?? req.locale,
    });

    // Filter collection parts by user's content rating limits
    const limits = getUserContentRatingLimits(req.user);
    collection.parts = await filterMovieListByRating(
      collection.parts,
      tmdb,
      limits
    );

    const media = await Media.getRelatedMedia(
      req.user,
      collection.parts.map((part) => part.id)
    );

    return res.status(200).json(mapCollection(collection, media));
  } catch (e) {
    logger.debug('Something went wrong retrieving collection', {
      label: 'API',
      errorMessage: e.message,
      collectionId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve collection.',
    });
  }
});

export default collectionRoutes;
