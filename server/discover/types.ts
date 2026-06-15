/**
 * Single source of truth for discover filter dimensions and their derived
 * shapes.
 *
 * The {@link DISCOVER_DIMENSIONS} registry is the only place dimension names
 * are written. Everything else — the {@link DimensionKey} union, the
 * {@link DiscoverFilter} type, the query schema, the capabilities matrix — is
 * derived from it. Adding a dimension here is a compile error in every
 * consumer until it is wired up; removing one removes it everywhere.
 *
 * Imported by both server (route handlers, plan builder) and client (the
 * discover slideover), via the existing `@server/*` alias.
 */

/** Paired include/exclude URL-param keys for one dimension. */
interface DimensionKeys {
  includeKey: string;
  excludeKey: string;
}

/**
 * The dimension registry. Each entry maps a structured dimension key to its
 * two flat URL-param names. The plural/singular asymmetry (e.g. `genre` but
 * `keywords`) reflects the existing URL contract and cannot be changed without
 * a breaking param rename.
 */
export const DISCOVER_DIMENSIONS = {
  genres: { includeKey: 'genre', excludeKey: 'excludeGenres' },
  keywords: { includeKey: 'keywords', excludeKey: 'excludeKeywords' },
  studio: { includeKey: 'studio', excludeKey: 'excludeStudio' },
  watchProviders: {
    includeKey: 'watchProviders',
    excludeKey: 'excludeWatchProviders',
  },
  language: { includeKey: 'language', excludeKey: 'excludeLanguages' },
  country: { includeKey: 'country', excludeKey: 'excludeCountries' },
  status: { includeKey: 'status', excludeKey: 'excludeStatus' },
} as const satisfies Record<string, DimensionKeys>;

/** Structured dimension key — derived from the registry. */
export type DimensionKey = keyof typeof DISCOVER_DIMENSIONS;

/** Flat URL-param key belonging to any dimension — derived from the registry. */
export type DimensionFlatKey = (typeof DISCOVER_DIMENSIONS)[DimensionKey][
  | 'includeKey'
  | 'excludeKey'];

/** A single dimension that supports paired include/exclude lists. */
export interface DimensionFilter<T = string> {
  include?: T[];
  exclude?: T[];
}

/**
 * Structured discover filter.
 *
 * Paired dimensions collapse the flat URL params (`genre` + `excludeGenres`)
 * into one object (`genres: { include, exclude }`). The dimension keys are
 * mapped over {@link DimensionKey}, so every registry entry must appear.
 * Range and scalar fields stay flat because a range is inherently single-mode.
 */
export type DiscoverFilter = {
  [K in DimensionKey]: DimensionFilter;
} & {
  primaryReleaseDate?: { gte?: string; lte?: string };
  firstAirDate?: { gte?: string; lte?: string };
  runtime?: { gte?: string; lte?: string };
  voteAverage?: { gte?: string; lte?: string };
  voteCount?: { gte?: string; lte?: string };
  certification?: {
    value?: string;
    gte?: string;
    lte?: string;
    country?: string;
  };
  sortBy?: string;
};

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
