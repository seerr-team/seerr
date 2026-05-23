import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import Tvdb from '@server/api/tvdb';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import type { ExternalProviderMediaType } from '@server/entity/ExternalProvider';
import ExternalProvider, {
  ExternalProviderIdType,
} from '@server/entity/ExternalProvider';
import Media from '@server/entity/Media';
import type { User } from '@server/entity/User';
import logger from '@server/logger';
import type { MovieResult, TvResult } from '@server/models/Search';
import {
  mapMovieDetailsToResult,
  mapMovieResult,
  mapTvDetailsToResult,
  mapTvResult,
} from '@server/models/Search';
import axios from 'axios';
import { get } from 'lodash';
import NodeCache from 'node-cache';

type JsonObject = Record<string, unknown>;

type ParsedExternalItem = {
  tmdbId?: number;
  tvdbId?: number;
  mediaType?: MediaType;
};

type HydratedExternalItem =
  | {
      raw: TmdbMovieDetails;
      tmdbId: number;
      mediaType: MediaType.MOVIE;
    }
  | {
      raw: TmdbTvDetails;
      tmdbId: number;
      tvdbId?: number;
      mediaType: MediaType.TV;
    };

type ExternalDiscoverPayload = {
  page: number;
  totalPages: number;
  totalResults: number;
  results: (MovieResult | TvResult)[];
};

type ArrayCandidate = {
  items: unknown[];
  score: number;
  path: string;
};

const cache = new NodeCache();

const emptyPayload = (): ExternalDiscoverPayload => ({
  page: 1,
  totalPages: 1,
  totalResults: 0,
  results: [],
});

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : undefined;
};

const normalizeMediaType = (
  value: unknown,
  fallback?: MediaType | string
): MediaType | undefined => {
  const raw = String(value ?? fallback ?? '')
    .trim()
    .toLowerCase();

  if (['movie', 'movies', 'film', 'films'].includes(raw)) {
    return MediaType.MOVIE;
  }

  if (
    [
      'tv',
      'show',
      'shows',
      'series',
      'serie',
      'tvshow',
      'tv_show',
      'television',
    ].includes(raw)
  ) {
    return MediaType.TV;
  }

  return undefined;
};

const getValueByPossiblePaths = (
  item: unknown,
  paths: string[]
): unknown | undefined => {
  for (const path of paths) {
    const value = get(item, path);

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
};

const getAutoTmdbId = (item: unknown): number | undefined => {
  if (!isObject(item)) {
    return undefined;
  }

  return normalizeNumber(
    getValueByPossiblePaths(item, [
      'tmdbId',
      'tmdbID',
      'tmdb_id',
      'tmdb',
      'ids.tmdb',
      'externalIds.tmdb',
      'external_ids.tmdb',
      'external.tmdb',
      'external.tmdbId',
      'external.tmdb_id',
      'metadata.tmdb',
      'metadata.tmdbId',
      'metadata.tmdb_id',
    ])
  );
};

const getAutoTvdbId = (item: unknown): number | undefined => {
  if (!isObject(item)) {
    return undefined;
  }

  return normalizeNumber(
    getValueByPossiblePaths(item, [
      'tvdbId',
      'tvdbID',
      'tvdb_id',
      'tvdb',
      'ids.tvdb',
      'externalIds.tvdb',
      'external_ids.tvdb',
      'external.tvdb',
      'external.tvdbId',
      'external.tvdb_id',
      'metadata.tvdb',
      'metadata.tvdbId',
      'metadata.tvdb_id',
    ])
  );
};

const getAutoMediaType = (
  item: unknown,
  fallback?: MediaType | string
): MediaType | undefined => {
  if (!isObject(item)) {
    return normalizeMediaType(undefined, fallback);
  }

  const explicitMediaType = normalizeMediaType(
    getValueByPossiblePaths(item, [
      'mediaType',
      'media_type',
      'type',
      'kind',
      'contentType',
      'content_type',
      'category',
      'itemType',
      'item_type',
    ]),
    fallback
  );

  if (explicitMediaType) {
    return explicitMediaType;
  }

  const movieIndicator = getValueByPossiblePaths(item, [
    'title',
    'original_title',
    'release_date',
  ]);

  if (
    movieIndicator !== undefined &&
    movieIndicator !== null &&
    movieIndicator !== ''
  ) {
    return MediaType.MOVIE;
  }

  const tvIndicator = getValueByPossiblePaths(item, [
    'name',
    'original_name',
    'first_air_date',
  ]);

  if (tvIndicator !== undefined && tvIndicator !== null && tvIndicator !== '') {
    return MediaType.TV;
  }

  return normalizeMediaType(undefined, fallback);
};

const getAutoFallbackId = (
  item: unknown,
  idType: ExternalProviderIdType
): number | undefined => {
  if (!isObject(item)) {
    return normalizeNumber(item);
  }

  if (
    idType === ExternalProviderIdType.TMDB ||
    idType === ExternalProviderIdType.TVDB
  ) {
    return normalizeNumber(getValueByPossiblePaths(item, ['id']));
  }

  return undefined;
};

const getArrayPathScore = (path: string): number => {
  const normalizedPath = path.toLowerCase();

  if (
    ['results', 'items', 'data.items', 'data.results'].includes(normalizedPath)
  ) {
    return 10;
  }

  if (
    normalizedPath.includes('recommendations') ||
    normalizedPath.includes('movies') ||
    normalizedPath.includes('shows') ||
    normalizedPath.includes('series') ||
    normalizedPath.includes('watchlist') ||
    normalizedPath.includes('trending')
  ) {
    return 6;
  }

  if (
    normalizedPath.includes('genres') ||
    normalizedPath.includes('seasons') ||
    normalizedPath.includes('episodes') ||
    normalizedPath.includes('credits') ||
    normalizedPath.includes('cast') ||
    normalizedPath.includes('crew')
  ) {
    return -8;
  }

  return 0;
};

const scoreArrayItem = (
  item: unknown,
  idType: ExternalProviderIdType,
  fallbackMediaType?: MediaType
): number => {
  if (!isObject(item)) {
    return normalizeNumber(item) && fallbackMediaType ? 3 : 0;
  }

  let score = 0;

  if (getAutoTmdbId(item)) {
    score += 8;
  }

  if (getAutoTvdbId(item)) {
    score += 8;
  }

  if (getAutoMediaType(item, fallbackMediaType)) {
    score += 3;
  }

  if (getAutoFallbackId(item, idType)) {
    score += 2;
  }

  return score;
};

const findArrayCandidates = (
  value: unknown,
  idType: ExternalProviderIdType,
  fallbackMediaType?: MediaType,
  path = '',
  candidates: ArrayCandidate[] = []
): ArrayCandidate[] => {
  if (Array.isArray(value)) {
    const itemScore = value
      .slice(0, 20)
      .reduce(
        (sum, item) => sum + scoreArrayItem(item, idType, fallbackMediaType),
        0
      );

    const score = itemScore + getArrayPathScore(path);

    if (score > 0) {
      candidates.push({
        items: value,
        score,
        path,
      });
    }

    value.forEach((item, index) =>
      findArrayCandidates(
        item,
        idType,
        fallbackMediaType,
        `${path}[${index}]`,
        candidates
      )
    );

    return candidates;
  }

  if (isObject(value)) {
    Object.entries(value).forEach(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;

      findArrayCandidates(
        child,
        idType,
        fallbackMediaType,
        childPath,
        candidates
      );
    });
  }

  return candidates;
};

const getDefaultMediaType = (
  providerMediaType?: ExternalProviderMediaType | string | null,
  defaultMediaType?: string | null,
  idType?: ExternalProviderIdType | string
): MediaType | undefined => {
  const configuredDefault = normalizeMediaType(defaultMediaType ?? undefined);

  if (configuredDefault) {
    return configuredDefault;
  }

  const providerType = normalizeMediaType(providerMediaType ?? undefined);

  if (providerType) {
    return providerType;
  }

  if (idType === ExternalProviderIdType.TVDB) {
    return MediaType.TV;
  }

  return undefined;
};

const getItemsFromPayload = (
  payload: unknown,
  options: {
    itemsPath?: string | null;
    idType: ExternalProviderIdType;
    fallbackMediaType?: MediaType;
  }
): unknown[] => {
  if (options.itemsPath && options.itemsPath.trim() !== '') {
    const configuredItems = get(payload, options.itemsPath);

    if (Array.isArray(configuredItems)) {
      return configuredItems;
    }
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = findArrayCandidates(
    payload,
    options.idType,
    options.fallbackMediaType
  ).sort((a, b) => b.score - a.score);

  return candidates[0]?.items ?? [];
};

const parseExternalItems = (
  payload: unknown,
  provider: {
    idType: ExternalProviderIdType;
    mediaType?: ExternalProviderMediaType | string | null;
    itemsPath?: string | null;
    tmdbIdPath?: string | null;
    tvdbIdPath?: string | null;
    mediaTypePath?: string | null;
    defaultMediaType?: string | null;
  }
): ParsedExternalItem[] => {
  const fallbackMediaType = getDefaultMediaType(
    provider.mediaType,
    provider.defaultMediaType,
    provider.idType
  );

  const rawItems = getItemsFromPayload(payload, {
    itemsPath: provider.itemsPath,
    idType: provider.idType,
    fallbackMediaType,
  });

  return rawItems
    .map((item): ParsedExternalItem | null => {
      const configuredMediaType = provider.mediaTypePath
        ? get(item, provider.mediaTypePath)
        : undefined;

      const mediaType =
        normalizeMediaType(configuredMediaType, fallbackMediaType) ??
        getAutoMediaType(item, fallbackMediaType);

      const configuredTmdbId = provider.tmdbIdPath
        ? normalizeNumber(get(item, provider.tmdbIdPath))
        : undefined;

      const configuredTvdbId = provider.tvdbIdPath
        ? normalizeNumber(get(item, provider.tvdbIdPath))
        : undefined;

      const autoTmdbId = getAutoTmdbId(item);
      const autoTvdbId = getAutoTvdbId(item);
      const fallbackId = getAutoFallbackId(item, provider.idType);

      const tmdbId =
        configuredTmdbId ??
        autoTmdbId ??
        (provider.idType === ExternalProviderIdType.TMDB
          ? fallbackId
          : undefined);

      const tvdbId =
        configuredTvdbId ??
        autoTvdbId ??
        (provider.idType === ExternalProviderIdType.TVDB
          ? fallbackId
          : undefined);

      if (!tmdbId && !tvdbId) {
        return null;
      }

      return {
        tmdbId,
        tvdbId,
        mediaType,
      };
    })
    .filter((item): item is ParsedExternalItem => item !== null);
};

const deduplicateParsedItems = (
  items: ParsedExternalItem[]
): ParsedExternalItem[] => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.mediaType ?? 'unknown'}:${item.tmdbId ?? ''}:${
      item.tvdbId ?? ''
    }`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
};

const hydrateExternalItem = async (
  item: ParsedExternalItem,
  tmdb: TheMovieDb,
  language?: string
): Promise<HydratedExternalItem | null> => {
  if (item.tmdbId && item.mediaType === MediaType.MOVIE) {
    const movie = await tmdb.getMovie({
      movieId: item.tmdbId,
      language,
    });

    return {
      raw: movie,
      tmdbId: movie.id,
      mediaType: MediaType.MOVIE,
    };
  }

  if (item.tmdbId && item.mediaType === MediaType.TV) {
    const tv = await tmdb.getTvShow({
      tvId: item.tmdbId,
      language,
    });

    return {
      raw: tv,
      tmdbId: tv.id,
      mediaType: MediaType.TV,
    };
  }

  if (item.tvdbId && (!item.mediaType || item.mediaType === MediaType.TV)) {
    const tvdb = await Tvdb.getInstance();

    const tv = await tvdb.getShowByTvdbId({
      tvdbId: item.tvdbId,
      language,
    });

    return {
      raw: tv,
      tmdbId: tv.id,
      tvdbId: item.tvdbId,
      mediaType: MediaType.TV,
    };
  }

  if (item.tmdbId && !item.mediaType) {
    try {
      const movie = await tmdb.getMovie({
        movieId: item.tmdbId,
        language,
      });

      return {
        raw: movie,
        tmdbId: movie.id,
        mediaType: MediaType.MOVIE,
      };
    } catch (movieError) {
      logger.debug('TMDB ID did not resolve as movie, trying TV.', {
        label: 'External Discover',
        tmdbId: item.tmdbId,
        errorMessage: getErrorMessage(movieError),
      });
    }

    try {
      const tv = await tmdb.getTvShow({
        tvId: item.tmdbId,
        language,
      });

      return {
        raw: tv,
        tmdbId: tv.id,
        mediaType: MediaType.TV,
      };
    } catch (tvError) {
      logger.debug('TMDB ID did not resolve as TV.', {
        label: 'External Discover',
        tmdbId: item.tmdbId,
        errorMessage: getErrorMessage(tvError),
      });
    }
  }

  return null;
};

const getRequestHeaders = (provider: {
  authType?: string;
  apiKey?: string | null;
  apiKeyHeader?: string | null;
  bearerToken?: string | null;
}) => {
  const headers: Record<string, string> = {};

  if (provider.authType === 'apiKey' && provider.apiKey) {
    headers[provider.apiKeyHeader || 'X-Api-Key'] = provider.apiKey;
  }

  if (provider.authType === 'bearer' && provider.bearerToken) {
    headers.Authorization = `Bearer ${provider.bearerToken}`;
  }

  return headers;
};

export const getExternalDiscoverItems = async (
  providerId: number,
  user?: User,
  language?: string
): Promise<ExternalDiscoverPayload> => {
  const providerRepository = getRepository(ExternalProvider);

  const provider = await providerRepository.findOne({
    where: {
      id: providerId,
      enabled: true,
    },
  });

  if (!provider) {
    logger.warn('External discover provider not found or disabled.', {
      label: 'External Discover',
      providerId,
    });

    return emptyPayload();
  }

  const cacheKey = `external-discover:${provider.id}:${language ?? 'default'}`;

  if (provider.cacheMinutes > 0) {
    const cached = cache.get<ExternalDiscoverPayload>(cacheKey);

    if (cached) {
      return cached;
    }
  }

  try {
    const response = await axios.get(provider.url, {
      headers: getRequestHeaders(provider),
      timeout: 15000,
    });

    const parsedItems = deduplicateParsedItems(
      parseExternalItems(response.data, {
        idType: provider.idType,
        mediaType: provider.mediaType,
        itemsPath: provider.itemsPath,
        tmdbIdPath: provider.tmdbIdPath,
        tvdbIdPath: provider.tvdbIdPath,
        mediaTypePath: provider.mediaTypePath,
        defaultMediaType: provider.defaultMediaType,
      })
    );

    logger.debug('External discover parsed items.', {
      label: 'External Discover',
      providerId: provider.id,
      parsedCount: parsedItems.length,
      sample: parsedItems.slice(0, 5),
    });

    const tmdb = new TheMovieDb();

    const hydratedItems = (
      await Promise.all(
        parsedItems.map(async (item) => {
          try {
            return await hydrateExternalItem(item, tmdb, language);
          } catch (e) {
            logger.warn('Failed to hydrate external discover item.', {
              label: 'External Discover',
              providerId: provider.id,
              item,
              errorMessage: getErrorMessage(e),
            });

            return null;
          }
        })
      )
    ).filter((item): item is HydratedExternalItem => item !== null);

    logger.debug('External discover hydrated items.', {
      label: 'External Discover',
      providerId: provider.id,
      hydratedCount: hydratedItems.length,
    });

    const relatedMedia = await Media.getRelatedMedia(
      user,
      hydratedItems.map((item) => ({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
      }))
    );

    const results = hydratedItems.map((item) => {
      const media = relatedMedia.find(
        (related) =>
          related.tmdbId === item.tmdbId && related.mediaType === item.mediaType
      );

      if (item.mediaType === MediaType.MOVIE) {
        return mapMovieResult(mapMovieDetailsToResult(item.raw), media);
      }

      return mapTvResult(mapTvDetailsToResult(item.raw), media);
    });

    const payload: ExternalDiscoverPayload = {
      page: 1,
      totalPages: 1,
      totalResults: results.length,
      results,
    };

    if (provider.cacheMinutes > 0) {
      cache.set(cacheKey, payload, provider.cacheMinutes * 60);
    }

    return payload;
  } catch (e) {
    logger.error('Something went wrong retrieving external discover items.', {
      label: 'External Discover',
      providerId: provider.id,
      errorMessage: getErrorMessage(e),
    });

    return emptyPayload();
  }
};

export const testExternalDiscoverProvider = async (provider: {
  url: string;
  authType?: string;
  apiKey?: string | null;
  apiKeyHeader?: string | null;
  bearerToken?: string | null;
  idType: ExternalProviderIdType;
  mediaType?: ExternalProviderMediaType | string | null;
  itemsPath?: string | null;
  tmdbIdPath?: string | null;
  tvdbIdPath?: string | null;
  mediaTypePath?: string | null;
  defaultMediaType?: string | null;
}) => {
  const response = await axios.get(provider.url, {
    headers: getRequestHeaders(provider),
    timeout: 15000,
  });

  const parsedItems = deduplicateParsedItems(
    parseExternalItems(response.data, {
      idType: provider.idType,
      mediaType: provider.mediaType,
      itemsPath: provider.itemsPath,
      tmdbIdPath: provider.tmdbIdPath,
      tvdbIdPath: provider.tvdbIdPath,
      mediaTypePath: provider.mediaTypePath,
      defaultMediaType: provider.defaultMediaType,
    })
  );

  return {
    ok: parsedItems.length > 0,
    status: response.status,
    totalParsed: parsedItems.length,
    sample: parsedItems.slice(0, 5),
  };
};
