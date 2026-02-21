import PlexTvAPI from '@server/api/plextv';
import TheMovieDb from '@server/api/themoviedb';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import logger from '@server/logger';
import { Router } from 'express';
import { z } from 'zod';

const plexWatchlistRoutes = Router();

// Validation schema for add/remove requests
const watchlistRequestSchema = z.object({
  tmdbId: z.number(),
  mediaType: z.enum(['movie', 'tv']),
  title: z.string().optional(),
});

/**
 * Helper function to get user with plexToken
 * The plexToken is not loaded by default (select: false for security)
 * so we need to explicitly request it.
 * This follows the same pattern as GET /:id/watchlist in server/routes/user/index.ts
 */
async function getUserWithPlexToken(userId: number): Promise<User | null> {
  const userRepository = getRepository(User);
  return userRepository.findOne({
    where: { id: userId },
    select: ['id', 'plexToken'],
  });
}

/**
 * POST /api/v1/plex-watchlist
 * Add an item to the user's Plex watchlist
 */
plexWatchlistRoutes.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next({
        status: 401,
        message: 'You must be logged in to add to watchlist.',
      });
    }

    // Load user with plexToken (not included in default query)
    const userWithToken = await getUserWithPlexToken(req.user.id);

    if (!userWithToken?.plexToken) {
      return next({
        status: 403,
        message: 'This endpoint requires a linked Plex account.',
      });
    }

    const values = watchlistRequestSchema.parse(req.body);
    const tmdb = new TheMovieDb();
    const plexTv = new PlexTvAPI(userWithToken.plexToken);

    // Get the title from TMDB if not provided
    let title = values.title;
    let year: number | undefined;

    if (!title) {
      if (values.mediaType === 'movie') {
        const movie = await tmdb.getMovie({ movieId: values.tmdbId });
        title = movie.title;
        year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : undefined;
      } else {
        const tvShow = await tmdb.getTvShow({ tvId: values.tmdbId });
        title = tvShow.name;
        year = tvShow.first_air_date
          ? new Date(tvShow.first_air_date).getFullYear()
          : undefined;
      }
    }

    const success = await plexTv.addToWatchlistByTmdbId({
      tmdbId: values.tmdbId,
      title: title,
      type: values.mediaType === 'movie' ? 'movie' : 'show',
      year,
    });

    if (!success) {
      return next({
        status: 404,
        message:
          'Could not find this title in Plex. Unable to add to watchlist.',
      });
    }

    logger.info('Added item to Plex watchlist', {
      label: 'Plex Watchlist',
      userId: req.user.id,
      tmdbId: values.tmdbId,
      mediaType: values.mediaType,
      title,
    });

    return res.status(201).json({
      success: true,
      message: 'Added to Plex watchlist',
      tmdbId: values.tmdbId,
      mediaType: values.mediaType,
      title,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next({
        status: 400,
        message: 'Invalid request data',
        errors: error.issues,
      });
    }

    logger.error('Failed to add to Plex watchlist', {
      label: 'Plex Watchlist',
      errorMessage: error.message,
      userId: req.user?.id,
      body: req.body,
    });

    return next({
      status: 500,
      message: 'Failed to add to Plex watchlist. Please try again.',
    });
  }
});

/**
 * DELETE /api/v1/plex-watchlist/:tmdbId
 * Remove an item from the user's Plex watchlist
 */
plexWatchlistRoutes.delete('/:tmdbId', async (req, res, next) => {
  try {
    if (!req.user) {
      return next({
        status: 401,
        message: 'You must be logged in to remove from watchlist.',
      });
    }

    // Load user with plexToken (not included in default query)
    const userWithToken = await getUserWithPlexToken(req.user.id);

    if (!userWithToken?.plexToken) {
      return next({
        status: 403,
        message: 'This endpoint requires a linked Plex account.',
      });
    }

    const tmdbId = parseInt(req.params.tmdbId, 10);

    if (isNaN(tmdbId)) {
      return next({
        status: 400,
        message: 'Invalid TMDB ID',
      });
    }

    const plexTv = new PlexTvAPI(userWithToken.plexToken);
    const success = await plexTv.removeFromWatchlistByTmdbId(tmdbId);

    if (!success) {
      return next({
        status: 404,
        message: 'Item not found in your Plex watchlist.',
      });
    }

    logger.info('Removed item from Plex watchlist', {
      label: 'Plex Watchlist',
      userId: req.user.id,
      tmdbId,
    });

    return res.status(204).send();
  } catch (error) {
    logger.error('Failed to remove from Plex watchlist', {
      label: 'Plex Watchlist',
      errorMessage: error.message,
      userId: req.user?.id,
      tmdbId: req.params.tmdbId,
    });

    return next({
      status: 500,
      message: 'Failed to remove from Plex watchlist. Please try again.',
    });
  }
});

/**
 * GET /api/v1/plex-watchlist/status/:tmdbId
 * Check if an item is on the user's Plex watchlist
 */
plexWatchlistRoutes.get('/status/:tmdbId', async (req, res, next) => {
  try {
    if (!req.user) {
      return next({
        status: 401,
        message: 'You must be logged in.',
      });
    }

    // Load user with plexToken (not included in default query)
    const userWithToken = await getUserWithPlexToken(req.user.id);

    if (!userWithToken?.plexToken) {
      return res.json({ isOnWatchlist: false });
    }

    const tmdbId = parseInt(req.params.tmdbId, 10);

    if (isNaN(tmdbId)) {
      return next({
        status: 400,
        message: 'Invalid TMDB ID',
      });
    }

    const plexTv = new PlexTvAPI(userWithToken.plexToken);
    const isOnWatchlist = await plexTv.isOnWatchlist(tmdbId);

    return res.json({ isOnWatchlist });
  } catch (error) {
    logger.error('Failed to check Plex watchlist status', {
      label: 'Plex Watchlist',
      errorMessage: error.message,
      userId: req.user?.id,
      tmdbId: req.params.tmdbId,
    });

    return res.json({ isOnWatchlist: false });
  }
});

export default plexWatchlistRoutes;
