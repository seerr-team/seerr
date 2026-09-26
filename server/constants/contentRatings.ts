export const MOVIE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'] as const;
export type MovieRating = (typeof MOVIE_RATINGS)[number];

export const TV_RATINGS = [
  'TV-Y',
  'TV-Y7',
  'TV-G',
  'TV-PG',
  'TV-14',
  'TV-MA',
] as const;
export type TvRating = (typeof TV_RATINGS)[number];

export const UNRATED_VALUES = ['NR', 'UR', 'Unrated', 'Not Rated', ''];

export interface UserContentRatingLimits {
  maxMovieRating?: string;
  maxTvRating?: string;
  blockUnrated?: boolean;
}

// Fail-closed: unknown/missing ratings are blocked.
export function shouldFilterMovie(
  rating: string | undefined | null,
  maxRating: string | undefined,
  blockUnrated = false
): boolean {
  if (!maxRating && !blockUnrated) return false;

  if (!rating || UNRATED_VALUES.includes(rating)) {
    return blockUnrated;
  }

  if (!maxRating) return false;

  const ratingIndex = MOVIE_RATINGS.indexOf(rating as MovieRating);
  const maxIndex = MOVIE_RATINGS.indexOf(maxRating as MovieRating);

  if (ratingIndex === -1) return blockUnrated;
  if (maxIndex === -1) return true;

  return ratingIndex > maxIndex;
}

export function shouldFilterTv(
  rating: string | undefined | null,
  maxRating: string | undefined,
  blockUnrated = false
): boolean {
  if (!maxRating && !blockUnrated) return false;

  if (!rating || UNRATED_VALUES.includes(rating)) {
    return blockUnrated;
  }

  if (!maxRating) return false;

  const ratingIndex = TV_RATINGS.indexOf(rating as TvRating);
  const maxIndex = TV_RATINGS.indexOf(maxRating as TvRating);

  if (ratingIndex === -1) return blockUnrated;
  if (maxIndex === -1) return true;

  return ratingIndex > maxIndex;
}

// Returns the certification list a TMDB /discover query should be
// restricted to, or undefined when no query-side filter applies.
// Fails closed: an unrecognized maxRating collapses to the single
// most restrictive rating rather than allowing everything through.
export function getAllowedRatings(
  mediaType: 'movie' | 'tv',
  limits: UserContentRatingLimits
): string[] | undefined {
  const ratings: readonly string[] =
    mediaType === 'movie' ? MOVIE_RATINGS : TV_RATINGS;
  const maxRating =
    mediaType === 'movie' ? limits.maxMovieRating : limits.maxTvRating;

  if (!maxRating) {
    return limits.blockUnrated ? [...ratings] : undefined;
  }

  const maxIndex = ratings.indexOf(maxRating);

  if (maxIndex === -1) {
    return [ratings[0]];
  }

  return ratings.slice(0, maxIndex + 1);
}

export function getMovieRatingOptions(): { value: string; label: string }[] {
  return MOVIE_RATINGS.map((rating) => ({ value: rating, label: rating }));
}

export function getTvRatingOptions(): { value: string; label: string }[] {
  return TV_RATINGS.map((rating) => ({ value: rating, label: rating }));
}
