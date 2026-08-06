import ExternalAPI from '@server/api/externalapi';
import TheMovieDb from '@server/api/themoviedb';
import type { TmdbSearchTvResponse } from '@server/api/themoviedb/interfaces';
import cacheManager from '@server/lib/cache';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios from 'axios';

const ANILIST_API_URL = 'https://graphql.anilist.co';
// Community maintained mapping between AniList/MAL/AniDB and TMDB/TVDB ids
// https://github.com/Fribb/anime-lists
const FRIBB_MAPPING_URL =
  'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json';

const CACHE_TTL_SECONDS = 86400; // AniList is heavily rate limited; refresh daily
const STALE_CACHE_TTL_SECONDS = CACHE_TTL_SECONDS * 7;
const MAX_SEASONAL_PAGES = 3; // 3 x 50 covers a full simulcast season
const MAX_TMDB_CONCURRENCY = 5;
const MAX_TMDB_SEARCH_CANDIDATES = 4;
const MAX_PROVIDER_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 5000;
const TMDB_ANIMATION_GENRE_ID = 16;
const FRIBB_CACHE_MARKER_KEY = 'fribb-mappings-loaded';

export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export const getCurrentAnimeSeason = (
  date: Date = new Date()
): { season: AnimeSeason; year: number } => {
  const seasons: AnimeSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

  return {
    season: seasons[Math.floor(date.getUTCMonth() / 3)],
    year: date.getUTCFullYear(),
  };
};

class RetryableProviderError extends Error {
  public readonly retryable = true;
}

const isRetryableProviderError = (error: unknown): boolean => {
  if (error instanceof RetryableProviderError) {
    return true;
  }

  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  return (
    [408, 425, 429].includes(error.response.status) ||
    error.response.status >= 500
  );
};

const getRetryDelayMs = (error: unknown, attempt: number): number => {
  const retryAfter = axios.isAxiosError(error)
    ? error.response?.headers?.['retry-after']
    : undefined;
  const retryAfterValue = Array.isArray(retryAfter)
    ? retryAfter[0]
    : retryAfter;

  if (retryAfterValue !== undefined) {
    const seconds = Number(retryAfterValue);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
    }

    const retryAt = Date.parse(String(retryAfterValue));
    if (Number.isFinite(retryAt)) {
      return Math.min(Math.max(retryAt - Date.now(), 0), MAX_RETRY_DELAY_MS);
    }
  }

  return Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
};

const withProviderRetries = async <T>(
  operation: () => Promise<T>,
  provider: string
): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (e) {
      if (attempt >= MAX_PROVIDER_RETRIES || !isRetryableProviderError(e)) {
        throw e;
      }

      const delay = getRetryDelayMs(e, attempt);
      logger.debug(`Retrying ${provider} request`, {
        label: 'AniList',
        attempt: attempt + 1,
        delay,
        errorMessage: e.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export interface AniListMedia {
  id: number;
  idMal: number | null;
  title: {
    romaji: string | null;
    english: string | null;
  };
  format: string;
  episodes: number | null;
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  };
  coverImage: {
    large: string | null;
  };
}

interface AniListPageResponse {
  data?: {
    Page: {
      pageInfo: {
        hasNextPage: boolean;
      };
      media: AniListMedia[];
    };
  };
  errors?: { message?: string }[];
}

const SEASONAL_ANIME_QUERY = `
query ($season: MediaSeason, $year: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(season: $season, seasonYear: $year, type: ANIME,
          format_in: [TV, TV_SHORT], sort: POPULARITY_DESC) {
      id
      idMal
      title { romaji english }
      format
      episodes
      startDate { year month day }
      coverImage { large }
    }
  }
}`;

// Fribb entries we care about. themoviedb_id is { tv: id } for series,
// { movie: [ids] } for movies; season carries the matching TMDB/TVDB season.
interface FribbEntry {
  anilist_id?: number;
  mal_id?: number;
  themoviedb_id?: number | { tv?: number; movie?: number[] } | null;
  season?: number | { tmdb?: number; tvdb?: number } | null;
  type?: string;
}

export interface AniListTmdbMapping {
  tmdbId: number;
  tmdbSeason?: number;
}

export const extractTmdbTvMapping = (
  entry: FribbEntry
): AniListTmdbMapping | null => {
  const tmdb = entry.themoviedb_id;

  let tmdbId: number | undefined;
  if (typeof tmdb === 'number' && entry.type !== 'MOVIE') {
    tmdbId = tmdb;
  } else if (tmdb && typeof tmdb === 'object' && typeof tmdb.tv === 'number') {
    tmdbId = tmdb.tv;
  }

  if (!tmdbId) {
    return null;
  }

  const season = entry.season;
  const tmdbSeason =
    typeof season === 'number'
      ? season
      : season && typeof season === 'object'
        ? season.tmdb
        : undefined;

  return { tmdbId, tmdbSeason };
};

export interface FribbMalEntry {
  malId: number;
  tmdbSeason?: number;
  isTv?: boolean;
}

// A TMDB show groups every AniList/MAL season under one id. To label the whole
// show with a single MAL score, pick the canonical entry: the base series, not
// a recap movie or OVA. Rank by TV type first (movies/OVAs share the show's
// TMDB id but carry season 0), then the earliest real season (season 0 =
// specials, sorted last), then the lowest MAL id as a stable tie-breaker.
const rankMalEntry = (entry: FribbMalEntry): [number, number, number] => [
  entry.isTv ? 0 : 1,
  entry.tmdbSeason && entry.tmdbSeason >= 1
    ? entry.tmdbSeason
    : Number.MAX_SAFE_INTEGER,
  entry.malId,
];

export const pickCanonicalMalId = (entries: FribbMalEntry[]): number | null => {
  let best: FribbMalEntry | null = null;
  for (const entry of entries) {
    if (!best) {
      best = entry;
      continue;
    }
    const [bt, bs, bm] = rankMalEntry(best);
    const [t, s, m] = rankMalEntry(entry);
    if (t < bt || (t === bt && (s < bs || (s === bs && m < bm)))) {
      best = entry;
    }
  }

  return best ? best.malId : null;
};

// Strips trailing season markers ("2nd Season", "Season 3", "III") so that
// sequel entries can be matched against the single TMDB show.
const stripSeasonSuffix = (title: string): string => {
  return title
    .replace(
      /\s*(?:\d+(?:st|nd|rd|th)\s+season|season\s+\d+|part\s+\d+|(?:II|III|IV|V|VI|VII|VIII|IX|X))\s*$/i,
      ''
    )
    .trim();
};

export const buildSearchCandidates = (media: AniListMedia): string[] => {
  const candidates: string[] = [];
  const push = (title?: string | null) => {
    const trimmed = title?.trim();
    if (trimmed && !candidates.includes(trimmed)) {
      candidates.push(trimmed);
    }
  };

  push(media.title.romaji);
  push(media.title.english);
  if (media.title.romaji) {
    push(stripSeasonSuffix(media.title.romaji));
    push(stripSeasonSuffix(media.title.romaji.split(':')[0]));
  }
  if (media.title.english) {
    push(stripSeasonSuffix(media.title.english));
  }

  return candidates;
};

interface TvSearchResultLike {
  id: number;
  original_language?: string;
  genre_ids?: number[];
  name?: string;
  original_name?: string;
  first_air_date?: string;
}

const normalizeTitle = (title: string): string =>
  title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const getTitleTokens = (title: string): Set<string> =>
  new Set(normalizeTitle(title).split(' ').filter(Boolean));

const getTitleMatchScore = (expected: string, actual: string): number => {
  const normalizedExpected = normalizeTitle(expected);
  const normalizedActual = normalizeTitle(actual);

  if (!normalizedExpected || !normalizedActual) {
    return 0;
  }

  if (normalizedExpected === normalizedActual) {
    return 100;
  }

  const strippedActual = normalizeTitle(stripSeasonSuffix(actual));
  if (normalizedExpected === strippedActual) {
    return 95;
  }

  const expectedTokens = getTitleTokens(expected);
  const actualTokens = getTitleTokens(actual);
  const commonTokens = [...expectedTokens].filter((token) =>
    actualTokens.has(token)
  ).length;
  const tokenCoverage =
    commonTokens / Math.max(expectedTokens.size, actualTokens.size);

  if (tokenCoverage >= 0.8) {
    return 80 + Math.round(tokenCoverage * 15);
  }

  return 0;
};

const hasSeasonMarker = (media: AniListMedia): boolean =>
  [media.title.romaji, media.title.english].some(
    (title) =>
      typeof title === 'string' &&
      /\b(?:season|part|cour|\d+(?:st|nd|rd|th)|II|III|IV|V|VI|VII|VIII|IX|X)\b/i.test(
        title
      )
  );

interface ScoredTvSearchResult<T> {
  result: T;
  score: number;
}

const scoreTvSearchResult = <T extends TvSearchResultLike>(
  result: T,
  media: AniListMedia
): number => {
  const expectedTitles = buildSearchCandidates(media);
  const resultTitles = [result.name, result.original_name].filter(
    (title): title is string => Boolean(title)
  );
  const titleScore = Math.max(
    0,
    ...expectedTitles.flatMap((expected) =>
      resultTitles.map((actual) => getTitleMatchScore(expected, actual))
    )
  );

  if (titleScore < 85) {
    return 0;
  }

  const isJapanese = result.original_language === 'ja';
  const isAnimation = result.genre_ids?.includes(TMDB_ANIMATION_GENRE_ID);
  if (!isJapanese && !isAnimation) {
    return 0;
  }

  const expectedYear = media.startDate.year;
  const resultYear = result.first_air_date
    ? Number(result.first_air_date.slice(0, 4))
    : undefined;
  if (
    expectedYear &&
    resultYear &&
    Number.isInteger(resultYear) &&
    resultYear !== expectedYear &&
    !hasSeasonMarker(media)
  ) {
    return 0;
  }

  return (
    titleScore +
    (isJapanese ? 8 : 0) +
    (isAnimation ? 8 : 0) +
    (expectedYear && resultYear === expectedYear ? 12 : 0)
  );
};

export const pickTvSearchResult = <T extends TvSearchResultLike>(
  results: T[],
  media?: AniListMedia
): T | undefined => {
  if (media) {
    const scored = results
      .map(
        (result): ScoredTvSearchResult<T> => ({
          result,
          score: scoreTvSearchResult(result, media),
        })
      )
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score);

    const best = scored[0];
    const second = scored[1];
    if (!best || (second && second.score >= best.score - 5)) {
      return undefined;
    }

    return best.result;
  }

  const japanese = results.filter(
    (result) => result.original_language === 'ja'
  );

  return (
    japanese.find((result) =>
      result.genre_ids?.includes(TMDB_ANIMATION_GENRE_ID)
    ) ?? japanese[0]
  );
};

export interface SeasonalAnimeItem {
  anilistId: number;
  tmdbId: number;
  title: string;
}

export const dedupeByTmdbId = (
  items: SeasonalAnimeItem[]
): SeasonalAnimeItem[] => {
  const seen = new Set<number>();

  return items.filter((item) => {
    if (seen.has(item.tmdbId)) {
      // Split-cours: two AniList entries can resolve to the same TMDB show
      return false;
    }
    seen.add(item.tmdbId);
    return true;
  });
};

class AniListAPI extends ExternalAPI {
  constructor() {
    super(
      ANILIST_API_URL,
      {},
      {
        nodeCache: cacheManager.getCache('anilist').data,
        timeout: getSettings().network.apiRequestTimeout,
        rateLimit: {
          maxRequests: 20,
          maxRPS: 1,
        },
      }
    );
  }

  public async getSeasonalAnime(
    season: AnimeSeason,
    year: number
  ): Promise<AniListMedia[]> {
    const media: AniListMedia[] = [];
    const cache = cacheManager.getCache('anilist').data;

    for (let page = 1; page <= MAX_SEASONAL_PAGES; page++) {
      const cacheKey = `seasonal-anilist-page-${season}-${year}-${page}`;
      const cached = cache.get<AniListPageResponse>(cacheKey);
      const response =
        cached ??
        (await withProviderRetries(async () => {
          const result = await this.axios.post<AniListPageResponse>('', {
            query: SEASONAL_ANIME_QUERY,
            variables: { season, year, page },
          });

          if (
            result.data.errors?.length ||
            !result.data.data?.Page ||
            !result.data.data.Page.pageInfo ||
            typeof result.data.data.Page.pageInfo.hasNextPage !== 'boolean' ||
            !Array.isArray(result.data.data.Page.media)
          ) {
            throw new RetryableProviderError(
              result.data.errors?.[0]?.message ??
                'AniList returned an invalid seasonal response'
            );
          }

          return result.data;
        }, 'AniList'));

      const pageData = response.data?.Page;
      if (!pageData) {
        throw new Error('AniList returned an empty seasonal page');
      }

      if (!cached && pageData.media.length > 0) {
        cache.set(cacheKey, response, CACHE_TTL_SECONDS);
      }

      media.push(...pageData.media);

      if (!pageData.pageInfo.hasNextPage) {
        break;
      }

      if (page === MAX_SEASONAL_PAGES) {
        logger.warn('AniList seasonal results were capped', {
          label: 'AniList',
          season,
          year,
          maxPages: MAX_SEASONAL_PAGES,
        });
      }
    }

    return media;
  }
}

class RetryingTheMovieDb extends TheMovieDb {
  private readonly searchLocale: string;
  private readonly requestTimeout: number;

  constructor() {
    super();

    const settings = getSettings();
    this.searchLocale = settings.main?.locale || 'en';
    this.requestTimeout = settings.network.apiRequestTimeout;
  }

  public searchTvShowsWithRetry = async (
    query: string
  ): Promise<TmdbSearchTvResponse> => {
    return withProviderRetries(async () => {
      return this.get<TmdbSearchTvResponse>('/search/tv', {
        params: {
          query,
          page: 1,
          include_adult: false,
          language: this.searchLocale,
        },
        timeout: this.requestTimeout,
      });
    }, 'TMDB');
  };
}

interface FribbMappingCache {
  expiresAt: number;
  staleUntil: number;
  anilistToTmdb: Map<number, AniListTmdbMapping>;
  tmdbToMal: Map<number, number>;
}

let mappingCache: FribbMappingCache | null = null;
let mappingLoadPromise: Promise<FribbMappingCache> | null = null;

const getAnilistCache = () => cacheManager.getCache('anilist').data;

const buildFribbMappingCache = (
  entries: FribbEntry[],
  now: number
): FribbMappingCache => {
  const anilistToTmdb = new Map<number, AniListTmdbMapping>();
  const malCandidates = new Map<number, FribbMalEntry[]>();

  for (const entry of entries) {
    const resolved = extractTmdbTvMapping(entry);

    if (resolved && entry.anilist_id) {
      anilistToTmdb.set(entry.anilist_id, resolved);
    }

    if (resolved && entry.mal_id) {
      const candidates = malCandidates.get(resolved.tmdbId) ?? [];
      candidates.push({
        malId: entry.mal_id,
        tmdbSeason: resolved.tmdbSeason,
        isTv: entry.type === 'TV',
      });
      malCandidates.set(resolved.tmdbId, candidates);
    }
  }

  const tmdbToMal = new Map<number, number>();
  for (const [tmdbId, candidates] of malCandidates) {
    const malId = pickCanonicalMalId(candidates);
    if (malId) {
      tmdbToMal.set(tmdbId, malId);
    }
  }

  logger.debug(
    `Loaded ${anilistToTmdb.size} AniList and ${tmdbToMal.size} MAL mappings`,
    { label: 'AniList' }
  );

  return {
    expiresAt: now + CACHE_TTL_SECONDS * 1000,
    staleUntil: now + STALE_CACHE_TTL_SECONDS * 1000,
    anilistToTmdb,
    tmdbToMal,
  };
};

const loadFribbMappings = async () => {
  const cache = getAnilistCache();
  const now = Date.now();
  const cacheMarker = cache.get<string>(FRIBB_CACHE_MARKER_KEY);

  if (mappingCache && !cacheMarker) {
    mappingCache = null;
  }

  if (mappingCache && mappingCache.expiresAt > now) {
    return mappingCache;
  }

  if (mappingLoadPromise) {
    return mappingLoadPromise;
  }

  const requestMarker = `${Date.now()}-${Math.random()}`;
  cache.set(FRIBB_CACHE_MARKER_KEY, requestMarker, STALE_CACHE_TTL_SECONDS);
  const previousCache = mappingCache;

  const request = (async () => {
    try {
      const response = await withProviderRetries(
        () =>
          axios.get<FribbEntry[]>(FRIBB_MAPPING_URL, {
            timeout: getSettings().network.apiRequestTimeout,
          }),
        'Fribb'
      );

      if (!Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('Fribb returned an empty or invalid mapping list');
      }

      if (cache.get<string>(FRIBB_CACHE_MARKER_KEY) !== requestMarker) {
        mappingCache = null;
        throw new Error('Fribb mapping refresh was invalidated');
      }

      const nextCache = buildFribbMappingCache(response.data, Date.now());
      if (nextCache.anilistToTmdb.size === 0) {
        throw new Error('Fribb returned no AniList TV mappings');
      }

      mappingCache = nextCache;
      return nextCache;
    } catch (e) {
      const invalidated =
        cache.get<string>(FRIBB_CACHE_MARKER_KEY) !== requestMarker;
      if (invalidated) {
        mappingCache = null;
      }

      if (
        !invalidated &&
        previousCache &&
        previousCache.staleUntil > Date.now()
      ) {
        logger.warn('Using stale Fribb mappings after refresh failure', {
          label: 'AniList',
          errorMessage: e.message,
        });
        return previousCache;
      }

      throw e;
    }
  })();

  mappingLoadPromise = request;
  try {
    return await request;
  } finally {
    if (mappingLoadPromise === request) {
      mappingLoadPromise = null;
    }
  }
};

const getAniListTmdbMap = async (): Promise<
  Map<number, AniListTmdbMapping>
> => {
  return (await loadFribbMappings()).anilistToTmdb;
};

export const getMalIdFromTmdb = async (
  tmdbId: number
): Promise<number | null> => {
  const { tmdbToMal } = await loadFribbMappings();
  return tmdbToMal.get(tmdbId) ?? null;
};

export const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('Concurrency must be a positive integer');
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
};

const searchTmdbFallback = async (
  tmdb: RetryingTheMovieDb,
  media: AniListMedia
): Promise<number | null> => {
  for (const query of buildSearchCandidates(media).slice(
    0,
    MAX_TMDB_SEARCH_CANDIDATES
  )) {
    const response = await tmdb.searchTvShowsWithRetry(query);
    const match = pickTvSearchResult(response.results, media);

    if (match) {
      return match.id;
    }
  }

  return null;
};

const seasonalLoadPromises = new Map<string, Promise<SeasonalAnimeItem[]>>();

const loadSeasonalAnimeList = async (
  season: AnimeSeason,
  year: number,
  cacheKey: string,
  staleCacheKey: string,
  stale: SeasonalAnimeItem[] | undefined
): Promise<SeasonalAnimeItem[]> => {
  const cache = getAnilistCache();
  const anilist = new AniListAPI();
  const tmdb = new RetryingTheMovieDb();

  try {
    const [seasonal, mapping] = await Promise.all([
      anilist.getSeasonalAnime(season, year),
      getAniListTmdbMap(),
    ]);

    if (seasonal.length === 0) {
      logger.warn('AniList returned no seasonal anime', {
        label: 'AniList',
        season,
        year,
      });
      return stale ?? [];
    }

    let tmdbFailures = 0;
    const resolved = await mapWithConcurrency(
      seasonal,
      MAX_TMDB_CONCURRENCY,
      async (media): Promise<SeasonalAnimeItem | null> => {
        const title = media.title.english ?? media.title.romaji ?? '';

        const mapped = mapping.get(media.id);
        if (mapped) {
          return { anilistId: media.id, tmdbId: mapped.tmdbId, title };
        }

        try {
          const tmdbId = await searchTmdbFallback(tmdb, media);
          if (tmdbId) {
            return { anilistId: media.id, tmdbId, title };
          }
        } catch (e) {
          tmdbFailures++;
          logger.debug('TMDB fallback search failed for seasonal anime', {
            label: 'AniList',
            errorMessage: e.message,
            title,
          });
        }

        logger.debug('No TMDB mapping found for seasonal anime', {
          label: 'AniList',
          anilistId: media.id,
          title,
        });
        return null;
      }
    );

    const items = dedupeByTmdbId(
      resolved.filter((item): item is SeasonalAnimeItem => item !== null)
    );

    if (items.length === 0) {
      return stale ?? [];
    }

    if (tmdbFailures > 0) {
      logger.warn('Seasonal anime results were partially resolved', {
        label: 'AniList',
        season,
        year,
        failures: tmdbFailures,
      });
      return stale ?? items;
    }

    cache.set(cacheKey, items, CACHE_TTL_SECONDS);
    cache.set(staleCacheKey, items, STALE_CACHE_TTL_SECONDS);

    return items;
  } catch (e) {
    if (stale) {
      logger.warn('Using stale seasonal anime results after refresh failure', {
        label: 'AniList',
        season,
        year,
        errorMessage: e.message,
      });
      return stale;
    }

    throw e;
  }
};

export const getSeasonalAnimeList = async (): Promise<SeasonalAnimeItem[]> => {
  const { season, year } = getCurrentAnimeSeason();
  const cache = getAnilistCache();
  const cacheKey = `seasonal-resolved-${season}-${year}`;
  const staleCacheKey = `seasonal-resolved-last-good-${season}-${year}`;

  const cached = cache.get<SeasonalAnimeItem[]>(cacheKey);
  if (cached?.length) {
    return cached;
  }

  if (cached) {
    cache.del(cacheKey);
  }

  const stale = cache.get<SeasonalAnimeItem[]>(staleCacheKey);
  const inFlight = seasonalLoadPromises.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = loadSeasonalAnimeList(
    season,
    year,
    cacheKey,
    staleCacheKey,
    stale?.length ? stale : undefined
  );
  seasonalLoadPromises.set(cacheKey, request);

  try {
    return await request;
  } finally {
    if (seasonalLoadPromises.get(cacheKey) === request) {
      seasonalLoadPromises.delete(cacheKey);
    }
  }
};

export default AniListAPI;
