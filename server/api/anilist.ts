import ExternalAPI from '@server/api/externalapi';
import TheMovieDb from '@server/api/themoviedb';
import cacheManager from '@server/lib/cache';
import logger from '@server/logger';
import axios from 'axios';

const ANILIST_API_URL = 'https://graphql.anilist.co';
// Community maintained mapping between AniList/MAL/AniDB and TMDB/TVDB ids
// https://github.com/Fribb/anime-lists
const FRIBB_MAPPING_URL =
  'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json';

const CACHE_TTL_SECONDS = 86400; // AniList is heavily rate limited; refresh daily
const MAX_SEASONAL_PAGES = 3; // 3 x 50 covers a full simulcast season
const TMDB_ANIMATION_GENRE_ID = 16;

export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export const getCurrentAnimeSeason = (
  date: Date = new Date()
): { season: AnimeSeason; year: number } => {
  const seasons: AnimeSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

  return {
    season: seasons[Math.floor(date.getMonth() / 3)],
    year: date.getFullYear(),
  };
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
  data: {
    Page: {
      pageInfo: {
        hasNextPage: boolean;
      };
      media: AniListMedia[];
    };
  };
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
      /\s*(?:(?:2nd|3rd|\d+th)\s+season|season\s+\d+|part\s+\d+|(?:II|III|IV|V|VI|VII|VIII|IX|X))\s*$/i,
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
  original_language: string;
  genre_ids: number[];
}

export const pickTvSearchResult = <T extends TvSearchResultLike>(
  results: T[]
): T | undefined => {
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

    for (let page = 1; page <= MAX_SEASONAL_PAGES; page++) {
      const response = await this.post<AniListPageResponse>(
        '',
        {
          query: SEASONAL_ANIME_QUERY,
          variables: { season, year, page },
        },
        undefined,
        CACHE_TTL_SECONDS
      );

      media.push(...response.data.Page.media);

      if (!response.data.Page.pageInfo.hasNextPage) {
        break;
      }
    }

    return media;
  }
}

let mappingCache: {
  expiresAt: number;
  anilistToTmdb: Map<number, AniListTmdbMapping>;
  tmdbToMal: Map<number, number>;
} | null = null;

const loadFribbMappings = async () => {
  if (mappingCache && mappingCache.expiresAt > Date.now()) {
    return mappingCache;
  }

  const response = await axios.get<FribbEntry[]>(FRIBB_MAPPING_URL, {
    timeout: 30000,
  });

  const anilistToTmdb = new Map<number, AniListTmdbMapping>();
  const malCandidates = new Map<number, FribbMalEntry[]>();

  for (const entry of response.data) {
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

  mappingCache = {
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    anilistToTmdb,
    tmdbToMal,
  };

  return mappingCache;
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

const searchTmdbFallback = async (
  tmdb: TheMovieDb,
  media: AniListMedia
): Promise<number | null> => {
  for (const query of buildSearchCandidates(media)) {
    const response = await tmdb.searchTvShows({ query });
    const match = pickTvSearchResult(response.results);

    if (match) {
      return match.id;
    }
  }

  return null;
};

export const getSeasonalAnimeList = async (): Promise<SeasonalAnimeItem[]> => {
  const { season, year } = getCurrentAnimeSeason();
  const cache = cacheManager.getCache('anilist').data;
  const cacheKey = `seasonal-resolved-${season}-${year}`;

  const cached = cache.get<SeasonalAnimeItem[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const anilist = new AniListAPI();
  const tmdb = new TheMovieDb();

  const [seasonal, mapping] = await Promise.all([
    anilist.getSeasonalAnime(season, year),
    getAniListTmdbMap(),
  ]);

  const resolved = await Promise.all(
    seasonal.map(async (media): Promise<SeasonalAnimeItem | null> => {
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
    })
  );

  const items = dedupeByTmdbId(
    resolved.filter((item): item is SeasonalAnimeItem => item !== null)
  );

  cache.set(cacheKey, items, CACHE_TTL_SECONDS);

  return items;
};

export default AniListAPI;
