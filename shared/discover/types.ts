/**
 * Shared discover domain types.
 *
 * Imported by both server and client. This module imports nothing — it is pure
 * type definitions, which is what makes it safe to share across the
 * browser/server boundary.
 */

/** A single filter dimension that supports paired include/exclude lists. */
export interface DimensionFilter<T = string> {
  include?: T[];
  exclude?: T[];
}

/**
 * Structured discover filter.
 *
 * Paired dimensions collapse the flat URL params (`genre` + `excludeGenres`)
 * into one object (`genres: { include, exclude }`). Range filters stay flat
 * because a range is inherently single-mode.
 */
export interface DiscoverFilter {
  genres: DimensionFilter;
  keywords: DimensionFilter;
  studio: DimensionFilter; // movie
  watchProviders: DimensionFilter;
  language: DimensionFilter;
  country: DimensionFilter;
  status: DimensionFilter; // tv
  // Ranges — single-mode, kept flat
  primaryReleaseDate?: { gte?: string; lte?: string }; // movie
  firstAirDate?: { gte?: string; lte?: string }; // tv
  runtime?: { gte?: string; lte?: string };
  voteAverage?: { gte?: string; lte?: string };
  voteCount?: { gte?: string; lte?: string };
  certification?: {
    value?: string;
    gte?: string;
    lte?: string;
    country?: string;
  };
  // Scalars
  sortBy?: string;
  page?: number;
}

/**
 * Dimension keys that have paired include/exclude semantics.
 *
 * Each key maps 1:1 to a filter section in the discover slideover. A dimension
 * that is not surfaced in the UI (e.g. network) must not appear here.
 */
export type DimensionKey =
  | 'genres'
  | 'keywords'
  | 'studio'
  | 'watchProviders'
  | 'language'
  | 'country'
  | 'status';

/** Params to forward to the TMDB `/discover/*` endpoint. */
export type TmdbDiscoverParams = Record<
  string,
  string | number | boolean | undefined
>;

/** Post-filter rules applied locally after TMDB returns. */
export interface PostFilterSpec {
  excludeLanguages?: string[];
  excludeCountries?: string[];
}

/**
 * Execution plan for a discover request. The plan builder translates a
 * structured filter into wrapper-level options + post-filter rules; the route
 * handler just executes the plan.
 */
export interface DiscoverPlan {
  /** Options spread into the TMDB wrapper's getDiscoverMovies/getDiscoverTv. */
  discoverOptions: Record<string, unknown>;
  /** Rules applied locally after TMDB returns (fields TMDB can't filter natively). */
  postFilter: PostFilterSpec;
}

/** Minimum shape a list item needs to be post-filterable. */
export interface ListResult {
  original_language?: string;
  origin_country?: string[];
}

/**
 * Discover response that tells the truth about pagination.
 *
 * When `paginationIsEstimate` is true, `totalResults` is TMDB's pre-filter
 * count and the UI should display it as an estimate.
 */
export interface HonestPage<T = unknown> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
  paginationIsEstimate: boolean;
}
