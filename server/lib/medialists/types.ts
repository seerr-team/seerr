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

/** A provider list, in the order defined by the list owner. */
export interface MediaList<TItem extends MediaListItem = MediaListItem> {
  providerId: string;
  listId: string;
  name?: string;
  description?: string;
  items: TItem[];
}

export type HydratedMediaList = MediaList<HydratedMediaListItem>;

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
   * Resolves the complete, ordered list. Returns `null` when the list does not
   * exist or is not publicly readable.
   */
  fetchList(
    listId: string,
    options?: { language?: string }
  ): Promise<MediaList | null>;
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
  };
  results: (MovieResult | TvResult)[];
}
