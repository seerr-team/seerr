import TheMovieDb from '@server/api/themoviedb';
import Media from '@server/entity/Media';
import type { User } from '@server/entity/User';
import cacheManager from '@server/lib/cache';
import { TmdbListProvider } from '@server/lib/medialists/providers/tmdb';
import type {
  HydratedMediaListItem,
  HydratedMediaListPage,
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

/** Serve the cached page without refetching for this long. */
const FRESH_TTL_MS = 6 * 60 * 60 * 1000;

/** How many missing TMDB payloads we resolve concurrently during hydration. */
const HYDRATION_CONCURRENCY = 10;

/**
 * Upper bound on the number of cached list pages. The cache is keyed partly by
 * request-controlled values (list id, page), so it needs a ceiling; the oldest
 * entries are dropped first.
 */
const MAX_CACHE_ENTRIES = 500;

/** Well-formed BCP-47-ish tags, which is all TMDB accepts. */
const LANGUAGE_REGEX = /^([a-z]{2,3})(?:-([a-z]{2}))?$/i;

const providers: Record<string, MediaListProvider> = {
  tmdb: new TmdbListProvider(),
};

export const getMediaListProvider = (
  providerId: string
): MediaListProvider | undefined => providers[providerId];

/**
 * Reduces a locale to a canonical form so that the cache key can only ever take
 * one of a small number of values. Anything unrecognised collapses to the empty
 * string, which lets the TMDB client fall back to its configured locale.
 */
export const normalizeMediaListLanguage = (language?: string): string => {
  const match = LANGUAGE_REGEX.exec((language ?? '').trim());

  if (!match) {
    return '';
  }

  return match[2]
    ? `${match[1].toLowerCase()}-${match[2].toUpperCase()}`
    : match[1].toLowerCase();
};

export const getMediaListCacheKey = (
  providerId: string,
  listId: string,
  language: string,
  page: number
): string => `${providerId}:${listId}:${language}:${page}`;

interface CachedMediaListPage {
  /** `null` records a list that is missing or private, so we stop hammering. */
  page: HydratedMediaListPage | null;
  fetchedAt: number;
  /** Set once we have logged the unavailability, to keep the log to one line. */
  loggedUnavailable?: boolean;
}

const inFlight = new Map<string, Promise<CachedMediaListPage>>();

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

/**
 * Keeps the cache under `MAX_CACHE_ENTRIES` by dropping the least recently
 * fetched pages, so that a burst of distinct list/page combinations cannot grow
 * it without bound.
 */
const evictOverflow = (reservedKey: string): void => {
  const cache = cacheManager.getCache('medialist').data;
  const keys = cache.keys().filter((key) => key !== reservedKey);

  const overflow = keys.length - (MAX_CACHE_ENTRIES - 1);

  if (overflow <= 0) {
    return;
  }

  keys
    .map((key) => ({
      key,
      fetchedAt: cache.get<CachedMediaListPage>(key)?.fetchedAt ?? 0,
    }))
    .sort((a, b) => a.fetchedAt - b.fetchedAt)
    .slice(0, overflow)
    .forEach(({ key }) => cache.del(key));
};

const fetchAndCache = async (
  provider: MediaListProvider,
  listId: string,
  page: number,
  language: string,
  cacheKey: string,
  stale: CachedMediaListPage | undefined
): Promise<CachedMediaListPage> => {
  const cache = cacheManager.getCache('medialist').data;

  try {
    const listPage = await provider.fetchListPage(listId, {
      page,
      language: language || undefined,
    });

    const entry: CachedMediaListPage = {
      page: listPage
        ? { ...listPage, items: await hydrateItems(listPage.items, language) }
        : null,
      fetchedAt: Date.now(),
      loggedUnavailable: stale?.loggedUnavailable,
    };

    if (!listPage && !entry.loggedUnavailable) {
      logger.warn(
        'Media list is unavailable; it may have been deleted or made private. The slider will be hidden.',
        { label: 'Media List', provider: provider.id, listId }
      );
      entry.loggedUnavailable = true;
    }

    evictOverflow(cacheKey);
    cache.set(cacheKey, entry);
    return entry;
  } catch (e) {
    // Serve the stale copy rather than failing the whole discover page.
    if (stale) {
      logger.debug('Failed to refresh media list; serving stale data', {
        label: 'Media List',
        provider: provider.id,
        listId,
        page,
        errorMessage: e.message,
      });
      return stale;
    }

    throw e;
  }
};

const getCachedListPage = async (
  provider: MediaListProvider,
  listId: string,
  page: number,
  language: string
): Promise<HydratedMediaListPage | null> => {
  const cacheKey = getMediaListCacheKey(provider.id, listId, language, page);
  const cache = cacheManager.getCache('medialist').data;
  const cached = cache.get<CachedMediaListPage>(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < FRESH_TTL_MS) {
    return cached.page;
  }

  // Single-flight: concurrent requests for the same page share one fetch.
  const existing = inFlight.get(cacheKey);
  if (existing) {
    return (await existing).page;
  }

  const pending = fetchAndCache(
    provider,
    listId,
    page,
    language,
    cacheKey,
    cached
  ).finally(() => {
    inFlight.delete(cacheKey);
  });

  inFlight.set(cacheKey, pending);

  return (await pending).page;
};

/**
 * Resolves a single page of a provider list, mapped into the same shape the
 * discover endpoints return so that `MediaSlider` can consume it directly.
 *
 * Only the requested page is fetched from, and cached for, the provider; the
 * local availability of each title is resolved per request because it depends
 * on the user.
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
  const normalizedLanguage = normalizeMediaListLanguage(language);
  const listPage = await getCachedListPage(
    provider,
    listId,
    page,
    normalizedLanguage
  );
  const items = listPage?.items ?? [];

  const media = await Media.getRelatedMedia(
    user,
    items.map((item) => ({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
    }))
  );

  return {
    page: listPage?.page ?? page,
    totalPages: Math.max(1, listPage?.totalPages ?? 1),
    totalResults: listPage?.totalResults ?? 0,
    list: {
      providerId: provider.id,
      listId,
      name: listPage?.name,
      description: listPage?.description,
      ...(listPage ? {} : { unavailable: true }),
    },
    results: items.map((item) => {
      const relatedMedia = media.find(
        (m) => m.tmdbId === item.tmdbId && m.mediaType === item.mediaType
      );

      return item.mediaType === 'movie'
        ? mapMovieResult(item.tmdbResult, relatedMedia)
        : mapTvResult(item.tmdbResult, relatedMedia);
    }),
  };
};
