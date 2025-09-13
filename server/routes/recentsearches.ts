import { NotFoundError } from '@server/entity/RecentSearches';
import logger from '@server/logger';
import { Router } from 'express';
import { QueryFailedError } from 'typeorm';

import { RecentSearches } from '@server/entity/RecentSearches';
import { recentsearchesCreate } from '@server/interfaces/api/recentsearchesCreate';

const recentsearchesRoutes = Router();

recentsearchesRoutes.post<never, RecentSearches, RecentSearches>(
  '/',
  async (req, res, next) => {
    try {
      if (!req.user) {
        return next({
          status: 401,
          message: 'You must be logged in to add recent search.',
        });
      }
      const values = recentsearchesCreate.parse(req.body);
      const request = await RecentSearches.createRecentSearches({
        recentSearchesRequest: values,
        user: req.user,
      });
      return res.status(201).json(request);
    } catch (error) {
      if (!(error instanceof Error)) {
        return;
      }
      switch (error.constructor) {
        case QueryFailedError:
          logger.warn('Something wrong with data recent searches', {
            tmdbId: req.body.tmdbId,
            mediaType: req.body.mediaType,
            label: 'Recent Searches',
          });
          return next({ status: 409, message: 'Something wrong' });
        default:
          return next({ status: 500, message: error.message });
      }
    }
  }
);

recentsearchesRoutes.delete('/', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 401,
      message: 'You must be logged in to delete recent searches data.',
    });
  }
  try {
    await RecentSearches.clearRecentSearches(req.user);
    return res.status(204).send();
  } catch (e) {
    if (e instanceof NotFoundError) {
      return next({
        status: 401,
        message: e.message,
      });
    }
    return next({ status: 500, message: e.message });
  }
});

export default recentsearchesRoutes;
