import TheMovieDb from '@server/api/themoviedb';
import Media from '@server/entity/Media';
import type { User } from '@server/entity/User';
import cacheManager from '@server/lib/cache';
import { TmdbListProvider } from '@server/lib/medialists/providers/tmdb';
import type {
  HydratedMediaList,
  HydratedMediaListItem,
  MediaListItem,
  MediaListProvider,
  MediaListResponse,
} from '@server/lib/medialists/types';
import logger from '@server/logger';
import {
  mapMovieDetailsToResult,
  mapMovieResult,
  mapTvDetailsToResult,
  mapTvResult,
} from '@server/models/Search';

/** Serve the cached list without refetching for this long. */
const FRESH_TTL_MS = 6 * 60 * 60 * 1000;

/** Number of items returned per page, matching TMDB's discover endpoints. */
export const MEDIA_LIST_PAGE_SIZE = 20;

/** How many missing TMDB payloads we resolve concurrently during hydration. */
const HYDRATION_CONCURRENCY = 10;

const providers: Record<string, MediaListProvider> = {
  tmdb: new TmdbListProvider(),
};

export const getMediaListProvider = (
  providerId: string
): MediaListProvider | undefined => providers[providerId];

export const getMediaListCacheKey = (
  providerId: string,
  listId: string,
  language?: string
): string => `${providerId}:${listId}:${language ?? ''}`;

interface CachedMediaList {
  /** `null` records a list that is missing or private, so we stop hammering. */
  list: HydratedMediaList | null;
  fetchedAt: number;
  /** Set once we have logged the unavailability, to keep the log to one line. */
  loggedUnavailable?: boolean;
}

const inFlight = new Map<string, Promise<CachedMediaList>>();

/**
 * Fills in the TMDB payload for any item a provider could only resolve to an
 * id. Providers backed by TMDB's own lists return fully populated items, so
 * this is a no-op for them. Items that cannot be resolved are dropped rather
 * than rendered as blanks.
 */
const hydrateItems = async (
  items: MediaListItem[],
  language?: string
): Promise<HydratedMediaListItem[]> => {
  const missing = items.filter((item) => !item.tmdbResult);

  if (missing.length === 0) {
    return items as HydratedMediaListItem[];
  }

  const tmdb = new TheMovieDb();
  const resolved = new Map<string, HydratedMediaListItem>();

  for (let i = 0; i < missing.length; i += HYDRATION_CONCURRENCY) {
    const chunk = missing.slice(i, i + HYDRATION_CONCURRENCY);

    await Promise.all(
      chunk.map(async (item) => {
        try {
          const hydrated: HydratedMediaListItem =
            item.mediaType === 'movie'
              ? {
                  mediaType: 'movie',
                  tmdbId: item.tmdbId,
                  tmdbResult: mapMovieDetailsToResult(
                    await tmdb.getMovie({ movieId: item.tmdbId, language })
                  ),
                }
              : {
                  mediaType: 'tv',
                  tmdbId: item.tmdbId,
                  tmdbResult: mapTvDetailsToResult(
                    await tmdb.getTvShow({ tvId: item.tmdbId, language })
                  ),
                };

          resolved.set(`${item.mediaType}:${item.tmdbId}`, hydrated);
        } catch (e) {
          logger.debug('Failed to hydrate media list item', {
            label: 'Media List',
            mediaType: item.mediaType,
            tmdbId: item.tmdbId,
            errorMessage: e.message,
          });
        }
      })
    );
  }

  return items.reduce<HydratedMediaListItem[]>((acc, item) => {
    if (item.tmdbResult) {
      acc.push(item as HydratedMediaListItem);
      return acc;
    }

    const hydrated = resolved.get(`${item.mediaType}:${item.tmdbId}`);
    if (hydrated) {
      acc.push(hydrated);
    }

    return acc;
  }, []);
};

const fetchAndCache = async (
  provider: MediaListProvider,
  listId: string,
  language: string | undefined,
  cacheKey: string,
  stale: CachedMediaList | undefined
): Promise<CachedMediaList> => {
  const cache = cacheManager.getCache('medialist').data;

  try {
    const list = await provider.fetchList(listId, { language });

    const entry: CachedMediaList = {
      list: list
        ? { ...list, items: await hydrateItems(list.items, language) }
        : null,
      fetchedAt: Date.now(),
      loggedUnavailable: stale?.loggedUnavailable,
    };

    if (!list && !entry.loggedUnavailable) {
      logger.warn(
        'Media list is unavailable; it may have been deleted or made private. The slider will render empty.',
        { label: 'Media List', provider: provider.id, listId }
      );
      entry.loggedUnavailable = true;
    }

    cache.set(cacheKey, entry);
    return entry;
  } catch (e) {
    // Serve the stale copy rather than failing the whole discover page.
    if (stale) {
      logger.debug('Failed to refresh media list; serving stale data', {
        label: 'Media List',
        provider: provider.id,
        listId,
        errorMessage: e.message,
      });
      return stale;
    }

    throw e;
  }
};

const getMediaList = async (
  provider: MediaListProvider,
  listId: string,
  language?: string
): Promise<HydratedMediaList | null> => {
  const cacheKey = getMediaListCacheKey(provider.id, listId, language);
  const cache = cacheManager.getCache('medialist').data;
  const cached = cache.get<CachedMediaList>(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < FRESH_TTL_MS) {
    return cached.list;
  }

  // Single-flight: concurrent requests for the same list share one fetch.
  const existing = inFlight.get(cacheKey);
  if (existing) {
    return (await existing).list;
  }

  const pending = fetchAndCache(
    provider,
    listId,
    language,
    cacheKey,
    cached
  ).finally(() => {
    inFlight.delete(cacheKey);
  });

  inFlight.set(cacheKey, pending);

  return (await pending).list;
};

/**
 * Resolves a single page of a provider list, mapped into the same shape the
 * discover endpoints return so that `MediaSlider` can consume it directly.
 *
 * The list itself is cached per provider/list/language; the local availability
 * of each title is resolved per request because it depends on the user.
 */
export const getMediaListPage = async ({
  provider,
  listId,
  page = 1,
  language,
  user,
}: {
  provider: MediaListProvider;
  listId: string;
  page?: number;
  language?: string;
  user?: User;
}): Promise<MediaListResponse> => {
  const list = await getMediaList(provider, listId, language);
  const items = list?.items ?? [];

  const currentPage = Math.max(1, page);
  const offset = (currentPage - 1) * MEDIA_LIST_PAGE_SIZE;
  const pageItems = items.slice(offset, offset + MEDIA_LIST_PAGE_SIZE);

  const media = await Media.getRelatedMedia(
    user,
    pageItems.map((item) => ({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
    }))
  );

  return {
    page: currentPage,
    totalPages: Math.max(1, Math.ceil(items.length / MEDIA_LIST_PAGE_SIZE)),
    totalResults: items.length,
    list: {
      providerId: provider.id,
      listId,
      name: list?.name,
      description: list?.description,
    },
    results: pageItems.map((item) => {
      const relatedMedia = media.find(
        (m) => m.tmdbId === item.tmdbId && m.mediaType === item.mediaType
      );

      return item.mediaType === 'movie'
        ? mapMovieResult(item.tmdbResult, relatedMedia)
        : mapTvResult(item.tmdbResult, relatedMedia);
    }),
  };
};
