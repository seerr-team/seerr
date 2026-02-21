import TheMovieDb from '@server/api/themoviedb';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import { mapCollection } from '@server/models/Collection';
import { filterMoviesByRating } from '@server/utils/contentFiltering';
import { Router } from 'express';

const collectionRoutes = Router();

collectionRoutes.get<{ id: string }>('/:id', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const collection = await tmdb.getCollection({
      collectionId: Number(req.params.id),
      language: (req.query.language as string) ?? req.locale,
    });

    const media = await Media.getRelatedMedia(
      req.user,
      collection.parts.map((part) => part.id)
    );

    // Filter collection parts based on content rating
    const filteredParts = await filterMoviesByRating(
      collection.parts,
      req.user
    );
    const filteredCollection = {
      ...collection,
      parts: filteredParts,
    };

    return res.status(200).json(mapCollection(filteredCollection, media));
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
