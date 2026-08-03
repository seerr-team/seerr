import TheMovieDb from '@server/api/themoviedb';
import type { TmdbListResponse } from '@server/api/themoviedb/interfaces';
import type {
  MediaListItem,
  MediaListPage,
  MediaListProvider,
} from '@server/lib/medialists/types';

/**
 * TMDB list ids are plain integers. Anything else is rejected before we make an
 * outbound request, which keeps admin-supplied slider data from being used to
 * build arbitrary URLs.
 */
const TMDB_LIST_ID_REGEX = /^[1-9]\d{0,11}$/;

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isTmdbId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

class MalformedListResponseError extends Error {
  constructor(reason: string) {
    super(`[TMDB] Malformed list response: ${reason}`);
    this.name = 'MalformedListResponseError';
  }
}

export class TmdbListProvider implements MediaListProvider {
  public readonly id = 'tmdb';

  public validateListId(listId: string): boolean {
    return TMDB_LIST_ID_REGEX.test(listId);
  }

  public async fetchListPage(
    listId: string,
    { page, language }: { page: number; language?: string }
  ): Promise<MediaListPage | null> {
    if (!this.validateListId(listId)) {
      return null;
    }

    const tmdb = new TheMovieDb();

    const response = await tmdb.getList({
      listId: Number(listId),
      page,
      language,
    });

    if (!response) {
      return null;
    }

    return this.mapResponse(listId, response);
  }

  /**
   * Validates the upstream payload before it is allowed anywhere near the cache.
   * A response that does not match the documented shape is treated as an
   * upstream failure (thrown), never as an empty or partially usable list.
   */
  private mapResponse(
    listId: string,
    response: TmdbListResponse
  ): MediaListPage {
    if (typeof response !== 'object') {
      throw new MalformedListResponseError('response is not an object');
    }

    // `page` is 1-based; `total_pages`/`total_results` are 0 for an empty list.
    if (!isTmdbId(response.page)) {
      throw new MalformedListResponseError('page is not a positive integer');
    }

    if (!isCount(response.total_pages) || !isCount(response.total_results)) {
      throw new MalformedListResponseError(
        'total_pages/total_results are not counts'
      );
    }

    if (!Array.isArray(response.items)) {
      throw new MalformedListResponseError('items is not an array');
    }

    const items = response.items.reduce<MediaListItem[]>((acc, item) => {
      if (typeof item !== 'object' || item === null) {
        throw new MalformedListResponseError('item is not an object');
      }

      if (!isTmdbId(item.id)) {
        throw new MalformedListResponseError(
          'item id is not a positive integer'
        );
      }

      if (item.media_type === 'tv') {
        acc.push({ mediaType: 'tv', tmdbId: item.id, tmdbResult: item });
      } else if (item.media_type === 'movie' || item.media_type === undefined) {
        // Classic v3 lists hold movies only and leave media_type out entirely,
        // so an absent discriminator is a movie rather than a broken payload.
        acc.push({
          mediaType: 'movie',
          tmdbId: item.id,
          tmdbResult: { ...item, media_type: 'movie' },
        });
      } else {
        throw new MalformedListResponseError(
          `unsupported item media_type "${
            (item as { media_type?: unknown }).media_type
          }"`
        );
      }

      return acc;
    }, []);

    return {
      providerId: this.id,
      listId,
      name: typeof response.name === 'string' ? response.name : undefined,
      description:
        typeof response.description === 'string' && response.description
          ? response.description
          : undefined,
      page: response.page,
      totalPages: response.total_pages,
      totalResults: response.total_results,
      // TMDB returns the items in the order defined by the list owner; we keep it.
      items,
    };
  }
}

export default TmdbListProvider;
