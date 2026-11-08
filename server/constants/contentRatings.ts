export const RATING_COUNTRY = 'US';

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

function shouldFilter(
  ratings: readonly string[],
  rating: string | undefined | null,
  maxRating: string | undefined,
  blockUnrated: boolean
): boolean {
  if (!rating || UNRATED_VALUES.includes(rating)) {
    return blockUnrated;
  }

  if (!maxRating) return false;

  const ratingIndex = ratings.indexOf(rating);
  const maxIndex = ratings.indexOf(maxRating);

  if (ratingIndex === -1) return blockUnrated;
  if (maxIndex === -1) return true;

  return ratingIndex > maxIndex;
}

export const shouldFilterMovie = (
  rating: string | undefined | null,
  maxRating: string | undefined,
  blockUnrated = false
) => shouldFilter(MOVIE_RATINGS, rating, maxRating, blockUnrated);

export const shouldFilterTv = (
  rating: string | undefined | null,
  maxRating: string | undefined,
  blockUnrated = false
) => shouldFilter(TV_RATINGS, rating, maxRating, blockUnrated);
