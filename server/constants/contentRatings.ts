/**
 * Content Rating Constants for Parental Controls
 *
 * Single source of truth for US content rating hierarchies and filtering logic.
 * Lower index = more restrictive (suitable for younger audiences).
 */

// MPAA Movie Ratings (US)
export const MOVIE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'] as const;
export type MovieRating = (typeof MOVIE_RATINGS)[number];

// TV Parental Guidelines Ratings (US)
export const TV_RATINGS = [
  'TV-Y',
  'TV-Y7',
  'TV-G',
  'TV-PG',
  'TV-14',
  'TV-MA',
] as const;
export type TvRating = (typeof TV_RATINGS)[number];

// Values that indicate content has no rating
export const UNRATED_VALUES = ['NR', 'UR', 'Unrated', 'Not Rated', ''];

/** Per-user content rating limits set by admins */
export interface UserContentRatingLimits {
  maxMovieRating?: string;
  maxTvRating?: string;
  blockUnrated?: boolean;
  blockAdult?: boolean;
}

/**
 * Check if a movie should be filtered out based on rating.
 * Returns true if the movie should be BLOCKED.
 *
 * Uses fail-closed approach: unknown/missing ratings are blocked
 * when blockUnrated is true.
 */
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

  // Unknown rating not in our hierarchy — treat as unrated
  if (ratingIndex === -1) return blockUnrated;
  if (maxIndex === -1) return false;

  return ratingIndex > maxIndex;
}

/**
 * Check if a TV show should be filtered out based on rating.
 * Returns true if the show should be BLOCKED.
 *
 * Uses fail-closed approach: unknown/missing ratings are blocked
 * when blockUnrated is true.
 */
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
  if (maxIndex === -1) return false;

  return ratingIndex > maxIndex;
}

/** Display options for movie rating dropdown (admin UI) */
export function getMovieRatingOptions(): { value: string; label: string }[] {
  return [
    { value: '', label: 'No Restriction' },
    { value: 'G', label: 'G - General Audiences' },
    { value: 'PG', label: 'PG - Parental Guidance Suggested' },
    { value: 'PG-13', label: 'PG-13 - Parents Strongly Cautioned' },
    { value: 'R', label: 'R - Restricted' },
    { value: 'NC-17', label: 'NC-17 - Adults Only' },
  ];
}

/** Display options for TV rating dropdown (admin UI) */
export function getTvRatingOptions(): { value: string; label: string }[] {
  return [
    { value: '', label: 'No Restriction' },
    { value: 'TV-Y', label: 'TV-Y - All Children' },
    { value: 'TV-Y7', label: 'TV-Y7 - Directed to Older Children' },
    { value: 'TV-G', label: 'TV-G - General Audience' },
    { value: 'TV-PG', label: 'TV-PG - Parental Guidance Suggested' },
    { value: 'TV-14', label: 'TV-14 - Parents Strongly Cautioned' },
    { value: 'TV-MA', label: 'TV-MA - Mature Audience Only' },
  ];
}
