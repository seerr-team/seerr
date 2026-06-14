import { filterResultsByRatingCaps } from '@server/lib/ratings';
import logger from '@server/logger';
import type { NextFunction, Request, Response } from 'express';

/**
 * Express middleware that transparently drops over-cap titles from any JSON
 * response that contains a top-level `results` array (discover, search, etc.),
 * enforcing the requesting user's maturity rating cap server-side.
 *
 * This is a no-op for users without a cap configured (admins and ordinary
 * users), so it adds zero TMDB calls for the common case. Person/collection
 * results and any items lacking a movie/tv mediaType pass through untouched.
 *
 * Wrapping res.json lets a single middleware cover every list endpoint on a
 * router without touching each handler, keeping the fork's diff small.
 */
export const ratingCapResultFilter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);

  res.json = (body: unknown): Response => {
    const results =
      body && typeof body === 'object'
        ? (body as { results?: unknown }).results
        : undefined;

    if (!Array.isArray(results)) {
      return originalJson(body);
    }

    filterResultsByRatingCaps(
      results as { id: number; tmdbId?: number; mediaType: string }[],
      req.user
    )
      .then((filtered) => {
        originalJson({ ...(body as object), results: filtered });
      })
      .catch((e) => {
        logger.debug('Rating cap result filter failed; returning unfiltered', {
          label: 'Ratings',
          errorMessage: e.message,
        });
        originalJson(body);
      });

    return res;
  };

  next();
};
