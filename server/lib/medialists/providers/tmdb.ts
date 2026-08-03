import TheMovieDb from '@server/api/themoviedb';
import type {
  MediaList,
  MediaListItem,
  MediaListProvider,
} from '@server/lib/medialists/types';

/**
 * TMDB list ids are plain integers. Anything else is rejected before we make an
 * outbound request, which keeps admin-supplied slider data from being used to
 * build arbitrary URLs.
 */
const TMDB_LIST_ID_REGEX = /^[1-9]\d{0,11}$/;

/**
 * TMDB serves lists 20 items at a time. We cap how far we page to keep a single
 * cold cache fill bounded; sliders only ever surface the first handful of pages.
 */
const MAX_PAGES = 25;

export class TmdbListProvider implements MediaListProvider {
  public readonly id = 'tmdb';

  public validateListId(listId: string): boolean {
    return TMDB_LIST_ID_REGEX.test(listId);
  }

  public async fetchList(
    listId: string,
    { language }: { language?: string } = {}
  ): Promise<MediaList | null> {
    if (!this.validateListId(listId)) {
      return null;
    }

    const tmdb = new TheMovieDb();
    const numericListId = Number(listId);

    const firstPage = await tmdb.getList({
      listId: numericListId,
      page: 1,
      language,
    });

    if (!firstPage) {
      return null;
    }

    const pages = [firstPage];
    const totalPages = Math.min(firstPage.total_pages ?? 1, MAX_PAGES);

    for (let page = 2; page <= totalPages; page++) {
      const nextPage = await tmdb.getList({
        listId: numericListId,
        page,
        language,
      });

      if (!nextPage) {
        break;
      }

      pages.push(nextPage);
    }

    return {
      providerId: this.id,
      listId,
      name: firstPage.name,
      description: firstPage.description || undefined,
      // TMDB returns the items in the order defined by the list owner; we keep it.
      items: pages
        .flatMap((page) => page.items ?? [])
        .reduce<MediaListItem[]>((acc, item) => {
          if (item.media_type === 'movie') {
            acc.push({
              mediaType: 'movie',
              tmdbId: item.id,
              tmdbResult: item,
            });
          } else if (item.media_type === 'tv') {
            acc.push({ mediaType: 'tv', tmdbId: item.id, tmdbResult: item });
          }

          return acc;
        }, []),
    };
  }
}

export default TmdbListProvider;
