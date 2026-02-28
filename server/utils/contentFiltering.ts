import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieResult,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import type { User } from '@server/entity/User';
import logger from '@server/logger';

// Movie rating hierarchy (MPAA system)
const MOVIE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'NR'] as const;

// TV rating hierarchy (US TV Parental Guidelines)
const TV_RATINGS = [
  'TV-Y',
  'TV-Y7',
  'TV-G',
  'TV-PG',
  'TV-14',
  'TV-MA',
  'NR',
] as const;

/**
 * Fetches movie certification from TMDB API
 * Prioritizes US rating, falls back to most restrictive rating from all countries
 */
async function getMovieCertification(
  movieId: number
): Promise<string | undefined> {
  try {
    const tmdb = new TheMovieDb();
    const details = await tmdb.getMovie({ movieId });

    // First, try to get US certification
    // Check ALL US release dates and find the most restrictive rated version
    const usRelease = details.release_dates?.results?.find(
      (r) => r.iso_3166_1 === 'US'
    );
    const usCertifications: string[] = [];

    if (usRelease?.release_dates) {
      for (const releaseDate of usRelease.release_dates) {
        const cert = releaseDate.certification;
        if (cert && cert !== '' && cert !== 'NR') {
          // Exclude NR to avoid picking unrated director's cuts over theatrical releases
          usCertifications.push(cert);
        }
      }
    }

    // If we found US ratings, use the most restrictive one
    if (usCertifications.length > 0) {
      let mostRestrictive = usCertifications[0];
      let highestIndex = MOVIE_RATINGS.indexOf(
        mostRestrictive as (typeof MOVIE_RATINGS)[number]
      );

      for (const cert of usCertifications) {
        const index = MOVIE_RATINGS.indexOf(
          cert as (typeof MOVIE_RATINGS)[number]
        );
        if (index > highestIndex) {
          highestIndex = index;
          mostRestrictive = cert;
        }
      }

      logger.debug('Fetched movie certification', {
        label: 'Content Filtering',
        movieId,
        movieTitle: details.title,
        certification: mostRestrictive,
        source: 'US',
        allUSRatings: usCertifications.join(', '),
      });
      return mostRestrictive;
    }

    // If no US rating, collect all valid certifications from all countries
    const allCertifications: string[] = [];
    for (const release of details.release_dates?.results || []) {
      for (const releaseDate of release.release_dates || []) {
        const cert = releaseDate.certification;
        if (
          cert &&
          cert !== '' &&
          cert !== 'NR' &&
          (MOVIE_RATINGS as readonly string[]).includes(cert)
        ) {
          // Exclude NR here too
          allCertifications.push(cert);
        }
      }
    }

    // If no certifications found anywhere, return undefined
    if (allCertifications.length === 0) {
      logger.debug('Fetched movie certification', {
        label: 'Content Filtering',
        movieId,
        movieTitle: details.title,
        certification: 'None',
      });
      return undefined;
    }

    // Find the most restrictive rating (highest in the hierarchy)
    let mostRestrictive = allCertifications[0];
    let highestIndex = MOVIE_RATINGS.indexOf(
      mostRestrictive as (typeof MOVIE_RATINGS)[number]
    );

    for (const cert of allCertifications) {
      const index = MOVIE_RATINGS.indexOf(
        cert as (typeof MOVIE_RATINGS)[number]
      );
      if (index > highestIndex) {
        highestIndex = index;
        mostRestrictive = cert;
      }
    }

    logger.debug('Fetched movie certification', {
      label: 'Content Filtering',
      movieId,
      movieTitle: details.title,
      certification: mostRestrictive,
      source: 'international (most restrictive)',
      allRatings: allCertifications.join(', '),
    });

    return mostRestrictive;
  } catch (error) {
    logger.warn('Failed to fetch movie certification', {
      label: 'Content Filtering',
      movieId,
      error: error.message,
    });
    return undefined;
  }
}

/**
 * Fetches TV content rating from TMDB API
 */
async function getTvCertification(tvId: number): Promise<string | undefined> {
  try {
    const tmdb = new TheMovieDb();
    const details = await tmdb.getTvShow({ tvId });

    // Get US content rating
    const usRating = details.content_ratings?.results?.find(
      (r) => r.iso_3166_1 === 'US'
    )?.rating;

    return usRating || undefined;
  } catch (error) {
    logger.warn('Failed to fetch TV certification', {
      label: 'Content Filtering',
      tvId,
      error: error.message,
    });
    return undefined;
  }
}

/**
 * Determines if a movie rating is allowed based on user's max rating setting
 */
function isMovieRatingAllowed(
  contentRating: string | undefined,
  maxRating: string | undefined
): boolean {
  if (!maxRating) {
    return true; // No restriction if maxRating not set
  }

  if (!contentRating || contentRating === '') {
    // If max rating is NR, allow unrated content
    if (maxRating === 'NR') {
      return true;
    }
    // Otherwise block unrated content when restrictions are enabled
    return false;
  }

  const maxIndex = MOVIE_RATINGS.indexOf(
    maxRating as (typeof MOVIE_RATINGS)[number]
  );
  const contentIndex = MOVIE_RATINGS.indexOf(
    contentRating as (typeof MOVIE_RATINGS)[number]
  );

  // If either rating not found in our hierarchy, block it for safety
  if (maxIndex === -1 || contentIndex === -1) {
    return false;
  }

  return contentIndex <= maxIndex;
}

/**
 * Determines if a TV rating is allowed based on user's max rating setting
 */
function isTvRatingAllowed(
  contentRating: string | undefined,
  maxRating: string | undefined
): boolean {
  if (!maxRating) {
    return true; // No restriction if maxRating not set
  }

  if (!contentRating || contentRating === '') {
    // If max rating is NR, allow unrated content
    if (maxRating === 'NR') {
      return true;
    }
    // Otherwise block unrated content when restrictions are enabled
    return false;
  }

  const maxIndex = TV_RATINGS.indexOf(maxRating as (typeof TV_RATINGS)[number]);
  const contentIndex = TV_RATINGS.indexOf(
    contentRating as (typeof TV_RATINGS)[number]
  );

  // If either rating not found in our hierarchy, block it for safety
  if (maxIndex === -1 || contentIndex === -1) {
    return false;
  }

  return contentIndex <= maxIndex;
}

/**
 * Filters movie results based on user's content rating restrictions
 * Fetches certification for each movie - this will be slower but accurate
 */
export async function filterMoviesByRating(
  results: TmdbMovieResult[],
  user?: User
): Promise<TmdbMovieResult[]> {
  const maxMovieRating = user?.settings?.maxMovieRating;

  // Always filter adult content
  const nonAdultResults = results.filter((movie) => !movie.adult);

  if (!maxMovieRating) {
    return nonAdultResults;
  }

  logger.debug('Filtering movies by rating', {
    label: 'Content Filtering',
    maxRating: maxMovieRating,
    movieCount: nonAdultResults.length,
  });

  // Fetch certifications and filter
  const filtered: TmdbMovieResult[] = [];

  for (const movie of nonAdultResults) {
    const certification = await getMovieCertification(movie.id);

    if (isMovieRatingAllowed(certification, maxMovieRating)) {
      filtered.push(movie);
    } else {
      logger.debug('Blocked movie by rating', {
        label: 'Content Filtering',
        movieId: movie.id,
        movieTitle: movie.title,
        certification: certification || 'None',
        maxAllowed: maxMovieRating,
      });
    }
  }

  logger.debug('Filtering complete', {
    label: 'Content Filtering',
    originalCount: nonAdultResults.length,
    filteredCount: filtered.length,
  });

  return filtered;
}

/**
 * Filters TV results based on user's content rating restrictions
 * Fetches content ratings for each show - this will be slower but accurate
 */
export async function filterTvByRating(
  results: TmdbTvResult[],
  user?: User
): Promise<TmdbTvResult[]> {
  const maxTvRating = user?.settings?.maxTvRating;

  if (!maxTvRating) {
    return results;
  }

  // Fetch content ratings and filter
  const filtered: TmdbTvResult[] = [];

  for (const show of results) {
    const certification = await getTvCertification(show.id);

    if (isTvRatingAllowed(certification, maxTvRating)) {
      filtered.push(show);
    }
  }

  return filtered;
}

export { isMovieRatingAllowed, isTvRatingAllowed, MOVIE_RATINGS, TV_RATINGS };
