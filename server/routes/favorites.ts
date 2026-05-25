import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { DuplicateFavoriteError, Favorites } from '@server/entity/Favorites';
import { NotFoundError } from '@server/entity/Watchlist';
import { favoritesCreate } from '@server/interfaces/api/favoritesCreate';
import logger from '@server/logger';
import { Router } from 'express';
import { QueryFailedError } from 'typeorm';

const favoritesRoutes = Router();

favoritesRoutes.get('/', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 401,
      message: 'You must be logged in to view favorites.',
    });
  }

  const itemsPerPage = req.query.take
    ? Math.min(Number(req.query.take), 1000)
    : 20;
  const page = req.query.page ? Number(req.query.page) : 1;
  const offset = (page - 1) * itemsPerPage;

  const [result, total] = await getRepository(Favorites).findAndCount({
    where: { requestedBy: { id: req.user.id } },
    take: itemsPerPage,
    skip: offset,
    order: { createdAt: 'DESC' },
  });

  return res.json({
    page,
    totalPages: Math.ceil(total / itemsPerPage) || 1,
    totalResults: total,
    results: result,
  });
});

favoritesRoutes.post<never, Favorites, Favorites>(
  '/',
  async (req, res, next) => {
    try {
      if (!req.user) {
        return next({
          status: 401,
          message: 'You must be logged in to add favorites.',
        });
      }
      const values = favoritesCreate.parse(req.body);

      const favorite = await Favorites.createFavorite({
        favoriteRequest: values,
        user: req.user,
      });
      return res.status(201).json(favorite);
    } catch (error) {
      if (!(error instanceof Error)) {
        return;
      }
      switch (error.constructor) {
        case QueryFailedError:
          logger.warn('Something wrong with data favorites', {
            tmdbId: req.body.tmdbId,
            mediaType: req.body.mediaType,
            label: 'Favorites',
          });
          return next({ status: 409, message: 'Something wrong' });
        case DuplicateFavoriteError:
          return next({ status: 409, message: error.message });
        default:
          return next({ status: 500, message: error.message });
      }
    }
  }
);

favoritesRoutes.delete('/:tmdbId', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 401,
      message: 'You must be logged in to delete favorites data.',
    });
  }
  try {
    const mediaType = req.query.mediaType;
    if (mediaType !== MediaType.MOVIE && mediaType !== MediaType.TV) {
      return next({
        status: 400,
        message: 'Invalid mediaType query parameter.',
      });
    }

    await Favorites.deleteFavorite(
      Number(req.params.tmdbId),
      mediaType,
      req.user
    );
    return res.status(204).send();
  } catch (e) {
    if (e instanceof NotFoundError) {
      return next({
        status: 404,
        message: e.message,
      });
    }
    return next({ status: 500, message: e.message });
  }
});

export default favoritesRoutes;
