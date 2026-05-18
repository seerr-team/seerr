import PlexTvAPI from '@server/api/plextv';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import {
  DuplicateWatchlistRequestError,
  NotFoundError,
  Watchlist,
} from '@server/entity/Watchlist';
import {
  plexWatchlistArgs,
  watchlistCreate,
} from '@server/interfaces/api/watchlistCreate';
import logger from '@server/logger';
import { Router } from 'express';
import { QueryFailedError } from 'typeorm';

const watchlistRoutes = Router();

const getPlexTvApiForUser = async (
  userId: number
): Promise<PlexTvAPI | null> => {
  const userRepository = getRepository(User);
  const userWithToken = await userRepository.findOne({
    where: { id: userId },
    select: { id: true, plexToken: true },
  });
  if (!userWithToken?.plexToken) {
    return null;
  }
  return new PlexTvAPI(userWithToken.plexToken);
};

const toPlexMediaType = (mediaType: MediaType): 'movie' | 'show' =>
  mediaType === MediaType.TV ? 'show' : 'movie';

watchlistRoutes.get('/plex/status', async (req, res, next) => {
  if (!req.user) {
    return next({ status: 401, message: 'You must be logged in.' });
  }

  const parsed = plexWatchlistArgs.safeParse(req.query);
  if (!parsed.success) {
    return next({ status: 400, message: 'Invalid tmdbId or mediaType.' });
  }
  const { tmdbId, mediaType } = parsed.data;

  try {
    const plexTvApi = await getPlexTvApiForUser(req.user.id);
    if (!plexTvApi) {
      return res.json({ onWatchlist: false });
    }
    const onWatchlist = await plexTvApi.isOnPlexWatchlist(
      tmdbId,
      toPlexMediaType(mediaType)
    );
    return res.json({ onWatchlist });
  } catch (e) {
    logger.error('Failed to check Plex watchlist status', {
      label: 'Plex Watchlist',
      errorMessage: e.message,
      tmdbId,
      mediaType,
    });
    return res.json({ onWatchlist: false });
  }
});

watchlistRoutes.post<never, Watchlist, Watchlist>(
  '/',
  async (req, res, next) => {
    try {
      if (!req.user) {
        return next({
          status: 401,
          message: 'You must be logged in to add watchlist.',
        });
      }
      const values = watchlistCreate.parse(req.body);

      const request = await Watchlist.createWatchlist({
        watchlistRequest: values,
        user: req.user,
      });
      return res.status(201).json(request);
    } catch (error) {
      if (!(error instanceof Error)) {
        return;
      }
      switch (error.constructor) {
        case QueryFailedError:
          logger.warn('Something wrong with data watchlist', {
            tmdbId: req.body.tmdbId,
            mediaType: req.body.mediaType,
            label: 'Watchlist',
          });
          return next({ status: 409, message: 'Something wrong' });
        case DuplicateWatchlistRequestError:
          return next({ status: 409, message: error.message });
        default:
          return next({ status: 500, message: error.message });
      }
    }
  }
);

watchlistRoutes.post('/plex', async (req, res, next) => {
  if (!req.user) {
    return next({ status: 401, message: 'You must be logged in.' });
  }

  const parsed = plexWatchlistArgs.safeParse(req.body);
  if (!parsed.success) {
    return next({ status: 400, message: 'Invalid tmdbId or mediaType.' });
  }
  const { tmdbId, mediaType } = parsed.data;

  try {
    const plexTvApi = await getPlexTvApiForUser(req.user.id);
    if (!plexTvApi) {
      return next({
        status: 403,
        message: 'You must have a linked Plex account to use this feature.',
      });
    }
    await plexTvApi.addToPlexWatchlist(tmdbId, toPlexMediaType(mediaType));
    return res.status(204).send();
  } catch (e) {
    logger.error('Failed to add item to Plex watchlist', {
      label: 'Plex Watchlist',
      errorMessage: e.message,
      tmdbId,
      mediaType,
    });
    return next({
      status: 500,
      message: 'Failed to update Plex watchlist.',
    });
  }
});

watchlistRoutes.delete('/plex', async (req, res, next) => {
  if (!req.user) {
    return next({ status: 401, message: 'You must be logged in.' });
  }

  const parsed = plexWatchlistArgs.safeParse(req.query);
  if (!parsed.success) {
    return next({ status: 400, message: 'Invalid tmdbId or mediaType.' });
  }
  const { tmdbId, mediaType } = parsed.data;

  try {
    const plexTvApi = await getPlexTvApiForUser(req.user.id);
    if (!plexTvApi) {
      return next({
        status: 403,
        message: 'You must have a linked Plex account to use this feature.',
      });
    }
    await plexTvApi.removeFromPlexWatchlist(tmdbId, toPlexMediaType(mediaType));
    return res.status(204).send();
  } catch (e) {
    logger.error('Failed to remove item from Plex watchlist', {
      label: 'Plex Watchlist',
      errorMessage: e.message,
      tmdbId,
      mediaType,
    });
    return next({
      status: 500,
      message: 'Failed to update Plex watchlist.',
    });
  }
});

watchlistRoutes.delete<{ tmdbId: string }>(
  '/:tmdbId(\\d+)',
  async (req, res, next) => {
    if (!req.user) {
      return next({
        status: 401,
        message: 'You must be logged in to delete watchlist data.',
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

      await Watchlist.deleteWatchlist(
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
  }
);

export default watchlistRoutes;
