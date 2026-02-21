/**
 * Shared Content Rating Utilities
 *
 * Centralized functions for extracting certifications from TMDB data
 * and filtering content by user parental controls. Used by discover,
 * search, detail, and request routes.
 */

import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieResult,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import type { UserContentRatingLimits } from '@server/constants/contentRatings';
import {
  MOVIE_RATINGS,
  UNRATED_VALUES,
  shouldFilterMovie,
  shouldFilterTv,
  type MovieRating,
} from '@server/constants/contentRatings';
import { User } from '@server/entity/User';
import logger from '@server/logger';

/**
 * Get the user's content rating limits (admin-enforced parental controls).
 * These limits are set by admins and users cannot see or modify them.
 */
export const getUserContentRatingLimits = (
  user?: User
): UserContentRatingLimits => {
  const movieRating = user?.settings?.maxMovieRating ?? undefined;
  const tvRating = user?.settings?.maxTvRating ?? undefined;

  return {
    // NC-17 / TV-MA are the max ratings — treat as unrestricted (skip filtering & API calls)
    maxMovieRating: movieRating === 'NC-17' ? undefined : movieRating,
    maxTvRating: tvRating === 'TV-MA' ? undefined : tvRating,
    blockUnrated: user?.settings?.blockUnrated ?? false,
    blockAdult: user?.settings?.blockAdult ?? false,
  };
};

/**
 * Check if the user has any active content rating limits.
 */
export const hasActiveRatingLimits = (
  limits: UserContentRatingLimits
): boolean =>
  !!(
    limits.maxMovieRating ||
    limits.maxTvRating ||
    limits.blockUnrated ||
    limits.blockAdult
  );

/**
 * Extract the best US movie certification from release dates.
 * Collects ALL US release date certifications, excludes NR/unrated
 * (so unrated director's cuts don't override a theatrical R rating),
 * and returns the most restrictive one found.
 * US-only — no international fallback.
 */
export const getMovieCertFromDetails = (
  releaseDates: {
    iso_3166_1: string;
    release_dates: { certification: string }[];
  }[]
): string | undefined => {
  const usRelease = releaseDates.find((r) => r.iso_3166_1 === 'US');
  const usCerts: string[] = [];

  if (usRelease?.release_dates) {
    for (const rd of usRelease.release_dates) {
      if (rd.certification && !UNRATED_VALUES.includes(rd.certification)) {
        usCerts.push(rd.certification);
      }
    }
  }

  if (usCerts.length > 0) {
    // Return the most restrictive US rating
    let best = usCerts[0];
    let bestIdx = MOVIE_RATINGS.indexOf(best as MovieRating);
    for (const c of usCerts) {
      const idx = MOVIE_RATINGS.indexOf(c as MovieRating);
      if (idx > bestIdx) {
        bestIdx = idx;
        best = c;
      }
    }
    return best;
  }

  // No valid US certification found — treat as unrated
  return undefined;
};

/**
 * Extract the best TV certification from content ratings.
 * US-only — no international fallback.
 */
export const getTvCertFromDetails = (
  contentRatings: { iso_3166_1: string; rating: string }[]
): string | undefined => {
  const usRating = contentRatings.find((r) => r.iso_3166_1 === 'US');
  if (usRating?.rating && !UNRATED_VALUES.includes(usRating.rating)) {
    return usRating.rating;
  }

  // No valid US rating found — treat as unrated
  return undefined;
};

/**
 * Filter a batch of movies by content rating, fetching details for each.
 */
export const filterMovieBatch = async (
  movies: TmdbMovieResult[],
  tmdb: TheMovieDb,
  limits: UserContentRatingLimits
): Promise<TmdbMovieResult[]> => {
  const settled = await Promise.allSettled(
    movies.map(async (movie) => {
      const details = await tmdb.getMovie({ movieId: movie.id });
      const cert = getMovieCertFromDetails(
        details.release_dates?.results ?? []
      );
      return { movie, cert, title: details.title };
    })
  );

  const filtered: TmdbMovieResult[] = [];
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    const { movie, cert, title } = outcome.value;
    if (!shouldFilterMovie(cert, limits.maxMovieRating, limits.blockUnrated)) {
      filtered.push(movie);
    } else {
      logger.debug('Blocked movie by rating (post-filter)', {
        label: 'Content Filtering',
        movieId: movie.id,
        movieTitle: title,
        certification: cert ?? 'unrated',
        maxRating: limits.maxMovieRating,
      });
    }
  }
  return filtered;
};

/**
 * Filter a batch of TV shows by content rating, fetching details for each.
 */
export const filterTvBatch = async (
  shows: TmdbTvResult[],
  tmdb: TheMovieDb,
  limits: UserContentRatingLimits
): Promise<TmdbTvResult[]> => {
  const settled = await Promise.allSettled(
    shows.map(async (show) => {
      const details = await tmdb.getTvShow({ tvId: show.id });
      const cert = getTvCertFromDetails(
        details.content_ratings?.results ?? []
      );
      return { show, cert, title: details.name };
    })
  );

  const filtered: TmdbTvResult[] = [];
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    const { show, cert, title } = outcome.value;
    if (!shouldFilterTv(cert, limits.maxTvRating, limits.blockUnrated)) {
      filtered.push(show);
    } else {
      logger.debug('Blocked TV show by rating (post-filter)', {
        label: 'Content Filtering',
        tvId: show.id,
        tvTitle: title,
        certification: cert ?? 'unrated',
        maxRating: limits.maxTvRating,
      });
    }
  }
  return filtered;
};
