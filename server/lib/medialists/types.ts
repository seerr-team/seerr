import type {
  TmdbMovieResult,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import type { MovieResult, TvResult } from '@server/models/Search';

export type MediaListMediaType = 'movie' | 'tv';

/**
 * A single entry of a media list.
 *
 * Providers are only required to resolve `mediaType` and `tmdbId`. When a
 * provider already receives the full TMDB payload (as is the case for TMDB's
 * own lists), it should pass it along as `tmdbResult` so that hydration does
 * not have to issue an extra request per item.
 */
export type MediaListItem =
  | { mediaType: 'movie'; tmdbId: number; tmdbResult?: TmdbMovieResult }
  | { mediaType: 'tv'; tmdbId: number; tmdbResult?: TmdbTvResult };

/** A media list item whose TMDB payload has been resolved. */
export type HydratedMediaListItem =
  | { mediaType: 'movie'; tmdbId: number; tmdbResult: TmdbMovieResult }
  | { mediaType: 'tv'; tmdbId: number; tmdbResult: TmdbTvResult };

/**
 * One page of a provider list, in the order defined by the list owner.
 *
 * `totalPages` and `totalResults` describe the whole list and are reported by
 * the provider; `items` only ever holds the entries of `page`.
 */
export interface MediaListPage<TItem extends MediaListItem = MediaListItem> {
  providerId: string;
  listId: string;
  name?: string;
  description?: string;
  /** 1-based index of the page `items` was taken from. */
  page: number;
  totalPages: number;
  totalResults: number;
  items: TItem[];
}

export type HydratedMediaListPage = MediaListPage<HydratedMediaListItem>;

/**
 * A source of media lists. Implement this interface to add support for other
 * list sources (Trakt, MDBList, …). Providers must never accept arbitrary URLs:
 * `validateListId` is the single place where the untrusted, admin-supplied
 * slider data is checked before any outbound request is made.
 */
export interface MediaListProvider {
  readonly id: string;

  /** Returns true when `listId` is a well-formed identifier for this provider. */
  validateListId(listId: string): boolean;

  /**
   * Resolves a *single page* of the list, never the whole list: implementations
   * must request only `page` upstream and report the list-wide `totalPages` and
   * `totalResults` from the upstream response.
   *
   * Returns `null` when the list does not exist or is not publicly readable.
   * Throws when the upstream request fails or answers with a payload that does
   * not match the documented shape, so that callers can fall back to a stale
   * copy instead of caching garbage.
   */
  fetchListPage(
    listId: string,
    options: { page: number; language?: string }
  ): Promise<MediaListPage | null>;
}

/** A page of a media list, shaped for consumption by `MediaSlider`. */
export interface MediaListResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  list: {
    providerId: string;
    listId: string;
    name?: string;
    description?: string;
    /**
     * Set when the list itself could not be read (deleted, or no longer
     * public). Distinguishes that case from a list that simply has no entries.
     */
    unavailable?: boolean;
  };
  results: (MovieResult | TvResult)[];
}
