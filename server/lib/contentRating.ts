import type {
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import {
  MOVIE_RATINGS,
  RATING_COUNTRY,
  TV_RATINGS,
  UNRATED_VALUES,
  shouldFilterMovie,
  shouldFilterTv,
  type UserContentRatingLimits,
} from '@server/constants/contentRatings';
import type { User } from '@server/entity/User';

export function getUserContentRatingLimits(
  user?: User
): UserContentRatingLimits | undefined {
  const maxMovieRating = user?.settings?.maxMovieRating ?? undefined;
  const maxTvRating = user?.settings?.maxTvRating ?? undefined;
  const blockUnrated = user?.settings?.blockUnrated ?? false;

  if (!maxMovieRating && !maxTvRating && !blockUnrated) {
    return undefined;
  }

  return { maxMovieRating, maxTvRating, blockUnrated };
}

const mostRestrictive = (ratings: readonly string[], certs?: string[]) =>
  certs?.reduce<string | undefined>(
    (worst, cert) =>
      worst === undefined || ratings.indexOf(cert) > ratings.indexOf(worst)
        ? cert
        : worst,
    undefined
  );

// Most restrictive US certification. Unrated releases are ignored, so an
// unrated cut doesn't override the theatrical rating.
export function getMovieCertification(
  details: Pick<TmdbMovieDetails, 'release_dates'>
): string | undefined {
  return mostRestrictive(
    MOVIE_RATINGS,
    details.release_dates?.results
      .filter((r) => r.iso_3166_1 === RATING_COUNTRY)
      .flatMap((r) => r.release_dates.map((rd) => rd.certification))
      .filter((cert) => !UNRATED_VALUES.includes(cert))
  );
}

// A show can carry multiple US ratings (e.g. different seasons or networks);
// the most restrictive one wins.
export function getTvCertification(
  details: Pick<TmdbTvDetails, 'content_ratings'>
): string | undefined {
  return mostRestrictive(
    TV_RATINGS,
    details.content_ratings?.results
      .filter((r) => r.iso_3166_1 === RATING_COUNTRY)
      .map((r) => r.rating)
      .filter((rating) => rating && !UNRATED_VALUES.includes(rating))
  );
}

export function isMovieRestricted(
  user: User | undefined,
  details: Pick<TmdbMovieDetails, 'release_dates'>
): boolean {
  const limits = getUserContentRatingLimits(user);
  return (
    !!limits &&
    shouldFilterMovie(
      getMovieCertification(details),
      limits.maxMovieRating,
      limits.blockUnrated
    )
  );
}

export function isTvRestricted(
  user: User | undefined,
  details: Pick<TmdbTvDetails, 'content_ratings'>
): boolean {
  const limits = getUserContentRatingLimits(user);
  return (
    !!limits &&
    shouldFilterTv(
      getTvCertification(details),
      limits.maxTvRating,
      limits.blockUnrated
    )
  );
}
