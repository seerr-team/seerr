/**
 * Content Rating Enforcement Middleware
 *
 * Provides middleware for detail routes (blocks access to restricted content)
 * and a utility for list routes (filters arrays of results).
 */

import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieResult,
  TmdbPersonCreditCast,
  TmdbPersonCreditCrew,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import {
  shouldFilterMovie,
  shouldFilterTv,
} from '@server/constants/contentRatings';
import type { UserContentRatingLimits } from '@server/constants/contentRatings';
import {
  getMovieCertFromDetails,
  getTvCertFromDetails,
  getUserContentRatingLimits,
  hasActiveRatingLimits,
} from '@server/lib/contentRating';
import logger from '@server/logger';
import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware for movie detail routes. Fetches the movie's certification
 * and returns 403 if it exceeds the user's rating limit.
 *
 * Must be placed on routes with `:id` param (e.g. `GET /movie/:id`).
 * The TMDB data is cached (12h) so this doesn't add a duplicate fetch —
 * the route handler's own getMovie() call will hit cache.
 */
export const enforceMovieRating = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const limits = getUserContentRatingLimits(req.user);

  if (!limits.maxMovieRating && !limits.blockUnrated && !limits.blockAdult) {
    return next();
  }

  try {
    const tmdb = new TheMovieDb();
    const movieId = Number(req.params.id);
    const details = await tmdb.getMovie({ movieId });

    // Check adult flag
    if (limits.blockAdult && details.adult) {
      res.status(403).json({
        message: 'This content is restricted by your parental controls.',
      });
      return;
    }

    // Check certification
    if (limits.maxMovieRating || limits.blockUnrated) {
      const cert = getMovieCertFromDetails(
        details.release_dates?.results ?? []
      );
      if (shouldFilterMovie(cert, limits.maxMovieRating, limits.blockUnrated)) {
        logger.debug('Blocked movie detail access by rating', {
          label: 'Content Filtering',
          movieId,
          certification: cert ?? 'unrated',
          maxRating: limits.maxMovieRating,
        });
        res.status(403).json({
          message: 'This content is restricted by your parental controls.',
        });
        return;
      }
    }

    next();
  } catch (e) {
    // Fail closed — if we can't verify the rating, block access
    logger.warn('Failed to verify movie rating, blocking access', {
      label: 'Content Filtering',
      movieId: req.params.id,
      errorMessage: (e as Error).message,
    });
    res.status(403).json({
      message: 'This content is restricted by your parental controls.',
    });
  }
};

/**
 * Middleware for TV detail routes. Fetches the show's certification
 * and returns 403 if it exceeds the user's rating limit.
 */
export const enforceTvRating = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const limits = getUserContentRatingLimits(req.user);

  if (!limits.maxTvRating && !limits.blockUnrated && !limits.blockAdult) {
    return next();
  }

  try {
    const tmdb = new TheMovieDb();
    const tvId = Number(req.params.id);
    const details = await tmdb.getTvShow({ tvId });

    // Check adult flag (rare on TV but exists in TMDB)
    if (limits.blockAdult && (details as Record<string, unknown>).adult) {
      res.status(403).json({
        message: 'This content is restricted by your parental controls.',
      });
      return;
    }

    const cert = getTvCertFromDetails(
      details.content_ratings?.results ?? []
    );
    if (shouldFilterTv(cert, limits.maxTvRating, limits.blockUnrated)) {
      logger.debug('Blocked TV detail access by rating', {
        label: 'Content Filtering',
        tvId,
        certification: cert ?? 'unrated',
        maxRating: limits.maxTvRating,
      });
      res.status(403).json({
        message: 'This content is restricted by your parental controls.',
      });
      return;
    }

    next();
  } catch (e) {
    logger.warn('Failed to verify TV rating, blocking access', {
      label: 'Content Filtering',
      tvId: req.params.id,
      errorMessage: (e as Error).message,
    });
    res.status(403).json({
      message: 'This content is restricted by your parental controls.',
    });
  }
};

/**
 * Filter an array of movie results by the user's content rating limits.
 * For list endpoints (recommendations, similar, collection parts).
 */
export const filterMovieListByRating = async (
  movies: TmdbMovieResult[],
  tmdb: TheMovieDb,
  limits: UserContentRatingLimits
): Promise<TmdbMovieResult[]> => {
  if (!limits.maxMovieRating && !limits.blockUnrated && !limits.blockAdult) {
    return movies;
  }

  // Free filter: remove adult-flagged content
  let filtered = limits.blockAdult
    ? movies.filter((m) => !m.adult)
    : movies;

  if (!limits.maxMovieRating && !limits.blockUnrated) {
    return filtered;
  }

  // Expensive: fetch cert for each remaining movie
  const settled = await Promise.allSettled(
    filtered.map(async (movie) => {
      const details = await tmdb.getMovie({ movieId: movie.id });
      const cert = getMovieCertFromDetails(
        details.release_dates?.results ?? []
      );
      return { movie, cert };
    })
  );

  filtered = [];
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue; // fail closed
    const { movie, cert } = outcome.value;
    if (!shouldFilterMovie(cert, limits.maxMovieRating, limits.blockUnrated)) {
      filtered.push(movie);
    }
  }
  return filtered;
};

/**
 * Filter an array of TV results by the user's content rating limits.
 */
export const filterTvListByRating = async (
  shows: TmdbTvResult[],
  tmdb: TheMovieDb,
  limits: UserContentRatingLimits
): Promise<TmdbTvResult[]> => {
  if (!limits.maxTvRating && !limits.blockUnrated) {
    return shows;
  }

  const settled = await Promise.allSettled(
    shows.map(async (show) => {
      const details = await tmdb.getTvShow({ tvId: show.id });
      const cert = getTvCertFromDetails(
        details.content_ratings?.results ?? []
      );
      return { show, cert };
    })
  );

  const filtered: TmdbTvResult[] = [];
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    const { show, cert } = outcome.value;
    if (!shouldFilterTv(cert, limits.maxTvRating, limits.blockUnrated)) {
      filtered.push(show);
    }
  }
  return filtered;
};

/**
 * Filter person combined credits by content rating.
 * Filters the cast/crew arrays — doesn't block the person page itself.
 */
export const filterCreditsByRating = async <
  T extends TmdbPersonCreditCast | TmdbPersonCreditCrew,
>(
  credits: T[],
  tmdb: TheMovieDb,
  limits: UserContentRatingLimits
): Promise<T[]> => {
  if (!hasActiveRatingLimits(limits)) {
    return credits;
  }

  const settled = await Promise.allSettled(
    credits.map(async (credit) => {
      // Filter adult content (free check)
      if (limits.blockAdult && credit.adult) {
        return { credit, blocked: true };
      }

      if (credit.media_type === 'movie') {
        if (!limits.maxMovieRating && !limits.blockUnrated) {
          return { credit, blocked: false };
        }
        const details = await tmdb.getMovie({ movieId: credit.id });
        const cert = getMovieCertFromDetails(
          details.release_dates?.results ?? []
        );
        return {
          credit,
          blocked: shouldFilterMovie(
            cert,
            limits.maxMovieRating,
            limits.blockUnrated
          ),
        };
      } else if (credit.media_type === 'tv') {
        if (!limits.maxTvRating && !limits.blockUnrated) {
          return { credit, blocked: false };
        }
        const details = await tmdb.getTvShow({ tvId: credit.id });
        const cert = getTvCertFromDetails(
          details.content_ratings?.results ?? []
        );
        return {
          credit,
          blocked: shouldFilterTv(
            cert,
            limits.maxTvRating,
            limits.blockUnrated
          ),
        };
      }

      return { credit, blocked: false };
    })
  );

  const filtered: T[] = [];
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue; // fail closed
    if (!outcome.value.blocked) {
      filtered.push(outcome.value.credit);
    }
  }
  return filtered;
};
