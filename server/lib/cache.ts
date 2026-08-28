import { LRUCache } from 'lru-cache';

export type AvailableCacheIds =
  | 'tmdb'
  | 'tmdbscan'
  | 'radarr'
  | 'sonarr'
  | 'rt'
  | 'imdb'
  | 'github'
  | 'plextv'
  | 'plexwatchlist'
  | 'tvdb'
  | 'anilist';

const DEFAULT_TTL = 300;

const OBJECT_VALUE_SIZE = 80;
const PROMISE_VALUE_SIZE = 80;
const ARRAY_VALUE_SIZE = 40;

// Limits key count, not memory, since TMDB never caps the credits rosters.
const TMDB_MAX_KEYS = 1000;

// Backstop against unbounded growth as the 15 minute TTL is what bounds this tier.
const TMDB_SCAN_MAX_KEYS = 2000;

// Only the rolling quality profile, root folder and language profile lookups reach
// these tiers, and keys are prefixed by server url, so this is a few keys per server.
const RADARR_MAX_KEYS = 64;
const SONARR_MAX_KEYS = 64;

// One key per searched title, each holding twenty search hits.
const RT_MAX_KEYS = 500;

// One key per IMDb id, requested from the same endpoint as the RT ratings.
const IMDB_MAX_KEYS = 500;

// Releases and commits, varying only by page size and branch.
const GITHUB_MAX_KEYS = 16;

// Watchlist item metadata, shared between users as the token is not part of the key.
const PLEX_TV_MAX_KEYS = 5000;

// Keyed by auth token, so one key per Plex linked user.
const PLEX_WATCHLIST_MAX_KEYS = 500;

// Several keys per show, holding the largest payloads of any tier as the extended
// series lookup carries every episode.
const TVDB_MAX_KEYS = 500;

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

export interface CacheStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttl?: number): boolean;
  del(key: string): number;
  getTtl(key: string): number | undefined;
  getStats(): CacheStats;
  flushAll(): void;
}

const keyLength = (key: string): number => key.toString().length;

const valueLength = (value: unknown): number => {
  if (typeof value === 'string') {
    return value.length;
  }
  if (Array.isArray(value)) {
    return ARRAY_VALUE_SIZE * value.length;
  }
  if (typeof value === 'number') {
    return 8;
  }
  if (
    typeof (value as { then?: unknown } | null | undefined)?.then === 'function'
  ) {
    return PROMISE_VALUE_SIZE;
  }
  if (Buffer.isBuffer(value)) {
    return value.length;
  }
  if (value != null && typeof value === 'object') {
    return OBJECT_VALUE_SIZE * Object.keys(value).length;
  }
  if (typeof value === 'boolean') {
    return 8;
  }
  return 0;
};

interface LruEntry {
  value: unknown;
  ksize: number;
  vsize: number;
}

class LruCacheStore implements CacheStore {
  private cache: LRUCache<string, LruEntry>;
  private stdTtl: number;
  private hits = 0;
  private misses = 0;
  private ksize = 0;
  private vsize = 0;

  constructor({ max, stdTtl }: { max: number; stdTtl: number }) {
    this.stdTtl = stdTtl;
    this.cache = new LRUCache<string, LruEntry>({
      max,
      ttl: stdTtl * 1000,
      // Without this, expired entries are only dropped when their key is read.
      ttlAutopurge: true,
      // Fires on every removal path, so one decrement here covers all of them.
      dispose: (entry) => {
        this.ksize -= entry.ksize;
        this.vsize -= entry.vsize;
      },
    });
  }

  // Cloned on read because callers mutate what they get back, as getTvSeason
  // does when it rewrites still_path in place.
  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (entry === undefined) {
      this.misses++;
      return undefined;
    }

    this.hits++;
    return structuredClone(entry.value) as T;
  }

  public set<T>(key: string, value: T, ttl?: number): boolean {
    const entry: LruEntry = {
      value: structuredClone(value),
      ksize: keyLength(key),
      vsize: valueLength(value),
    };

    // A ttl of 0 means the entry never expires.
    this.cache.set(key, entry, { ttl: (ttl ?? this.stdTtl) * 1000 });

    this.ksize += entry.ksize;
    this.vsize += entry.vsize;

    return true;
  }

  public del(key: string): number {
    return this.cache.delete(key) ? 1 : 0;
  }

  public getTtl(key: string): number | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const remaining = this.cache.getRemainingTTL(key);

    // Keys with no expiry report 0.
    return remaining === Infinity ? 0 : Date.now() + remaining;
  }

  public getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      keys: this.cache.size,
      ksize: this.ksize,
      vsize: this.vsize,
    };
  }

  public flushAll(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.ksize = 0;
    this.vsize = 0;
  }
}

class Cache {
  public id: AvailableCacheIds;
  public data: CacheStore;
  public name: string;

  constructor(
    id: AvailableCacheIds,
    name: string,
    options: { max: number; stdTtl?: number }
  ) {
    this.id = id;
    this.name = name;

    this.data = new LruCacheStore({
      max: options.max,
      stdTtl: options.stdTtl ?? DEFAULT_TTL,
    });
  }

  public getStats() {
    return this.data.getStats();
  }

  public flush(): void {
    this.data.flushAll();
  }
}

class CacheManager {
  private availableCaches: Record<AvailableCacheIds, Cache> = {
    tmdb: new Cache('tmdb', 'The Movie Database API', {
      stdTtl: 21600,
      max: TMDB_MAX_KEYS,
    }),
    tmdbscan: new Cache('tmdbscan', 'The Movie Database API (Library Scans)', {
      stdTtl: 900,
      max: TMDB_SCAN_MAX_KEYS,
    }),
    radarr: new Cache('radarr', 'Radarr API', { max: RADARR_MAX_KEYS }),
    sonarr: new Cache('sonarr', 'Sonarr API', { max: SONARR_MAX_KEYS }),
    rt: new Cache('rt', 'Rotten Tomatoes API', {
      stdTtl: 43200,
      max: RT_MAX_KEYS,
    }),
    imdb: new Cache('imdb', 'IMDB Radarr Proxy', {
      stdTtl: 43200,
      max: IMDB_MAX_KEYS,
    }),
    github: new Cache('github', 'GitHub API', {
      stdTtl: 21600,
      max: GITHUB_MAX_KEYS,
    }),
    plextv: new Cache('plextv', 'Plex TV', {
      stdTtl: 86400 * 7, // 1 week cache
      max: PLEX_TV_MAX_KEYS,
    }),
    plexwatchlist: new Cache('plexwatchlist', 'Plex Watchlist', {
      max: PLEX_WATCHLIST_MAX_KEYS,
    }),
    tvdb: new Cache('tvdb', 'The TVDB API', {
      stdTtl: 21600,
      max: TVDB_MAX_KEYS,
    }),
    anilist: new Cache('anilist', 'AniList API', {
      stdTtl: 86400,
      checkPeriod: 60 * 30,
    }),
  };

  public getCache(id: AvailableCacheIds): Cache {
    return this.availableCaches[id];
  }

  public getAllCaches(): Record<string, Cache> {
    return this.availableCaches;
  }
}

const cacheManager = new CacheManager();

export default cacheManager;
