import NodeCache from 'node-cache';

export type AvailableCacheIds =
  | 'tmdb'
  | 'radarr'
  | 'sonarr'
  | 'rt'
  | 'imdb'
  | 'github'
  | 'plexguid'
  | 'plextv'
  | 'plexwatchlist'
  | 'tvdb';

const DEFAULT_TTL = 300;
const DEFAULT_CHECK_PERIOD = 120;

class Cache {
  public id: AvailableCacheIds;
  public data: NodeCache;
  public name: string;

  constructor(
    id: AvailableCacheIds,
    name: string,
    options: { stdTtl?: number; checkPeriod?: number } = {}
  ) {
    this.id = id;
    this.name = name;
    this.data = new NodeCache({
      stdTTL: options.stdTtl ?? DEFAULT_TTL,
      checkperiod: options.checkPeriod ?? DEFAULT_CHECK_PERIOD,
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
      checkPeriod: 60 * 30,
    }),
    radarr: new Cache('radarr', 'Radarr API'),
    sonarr: new Cache('sonarr', 'Sonarr API'),
    rt: new Cache('rt', 'Rotten Tomatoes API', {
      stdTtl: 43200,
      checkPeriod: 60 * 30,
    }),
    imdb: new Cache('imdb', 'IMDB Radarr Proxy', {
      stdTtl: 43200,
      checkPeriod: 60 * 30,
    }),
    github: new Cache('github', 'GitHub API', {
      stdTtl: 21600,
      checkPeriod: 60 * 30,
    }),
    plexguid: new Cache('plexguid', 'Plex GUID', {
      stdTtl: 86400 * 7, // 1 week cache
      checkPeriod: 60 * 30,
    }),
    plextv: new Cache('plextv', 'Plex TV', {
      stdTtl: 86400 * 7, // 1 week cache
      checkPeriod: 60,
    }),
    plexwatchlist: new Cache('plexwatchlist', 'Plex Watchlist'),
    tvdb: new Cache('tvdb', 'The TVDB API', {
      stdTtl: 21600,
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
