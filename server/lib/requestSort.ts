import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';

export type RequestSortField =
  | 'added'
  | 'modified'
  | 'popularity'
  | 'releaseDate'
  | 'voteAverage'
  | 'title';

export type RequestSortDirection = 'asc' | 'desc';

export interface ParsedRequestSort {
  field: RequestSortField;
  direction: RequestSortDirection;
}

const TMDB_SORT_FIELDS: RequestSortField[] = [
  'popularity',
  'releaseDate',
  'voteAverage',
  'title',
];

const SORT_FIELDS: RequestSortField[] = [
  'added',
  'modified',
  'popularity',
  'releaseDate',
  'voteAverage',
  'title',
];

export function isTmdbRequestSort(
  field: RequestSortField
): field is Exclude<RequestSortField, 'added' | 'modified'> {
  return TMDB_SORT_FIELDS.includes(field);
}

function isRequestSortField(value?: string): value is RequestSortField {
  return SORT_FIELDS.includes(value as RequestSortField);
}

export function parseRequestSort(
  sort?: string,
  sortDirection?: string
): ParsedRequestSort {
  const field: RequestSortField = isRequestSortField(sort) ? sort : 'added';
  const direction: RequestSortDirection =
    sortDirection === 'asc' ? 'asc' : 'desc';

  return { field, direction };
}

export type DbRequestSortField = 'added' | 'modified';

export function getRequestSortColumn(field: DbRequestSortField): string {
  switch (field) {
    case 'modified':
      return 'request.updatedAt';
    default:
      return 'request.createdAt';
  }
}

interface MediaSortCache {
  title: string;
  popularity: number;
  voteAverage: number;
  releaseDate: string;
}

interface TmdbSortProvider {
  getMovie: TheMovieDb['getMovie'];
  getTvShow: TheMovieDb['getTvShow'];
}

async function fetchMediaSortCache(
  tmdb: TmdbSortProvider,
  mediaType: MediaType,
  tmdbId: number
): Promise<MediaSortCache | null> {
  try {
    if (mediaType === MediaType.MOVIE) {
      const movie = await tmdb.getMovie({ movieId: tmdbId });

      return {
        title: movie.original_title?.toLowerCase() ?? '',
        popularity: movie.popularity ?? 0,
        voteAverage: movie.vote_average ?? 0,
        releaseDate: movie.release_date ?? '',
      };
    }

    const tv = await tmdb.getTvShow({ tvId: tmdbId });

    return {
      title: tv.original_name?.toLowerCase() ?? '',
      popularity: tv.popularity ?? 0,
      voteAverage: tv.vote_average ?? 0,
      releaseDate: tv.first_air_date ?? '',
    };
  } catch {
    return null;
  }
}

export async function sortRequestsByTmdbField(
  requests: MediaRequest[],
  field: Exclude<RequestSortField, 'added' | 'modified'>,
  direction: RequestSortDirection,
  tmdb: TmdbSortProvider = new TheMovieDb()
): Promise<MediaRequest[]> {
  const uniqueMedia = new Map<
    string,
    { mediaType: MediaType; tmdbId: number }
  >();

  for (const request of requests) {
    const key = `${request.type}-${request.media.tmdbId}`;

    if (!uniqueMedia.has(key)) {
      uniqueMedia.set(key, {
        mediaType: request.type,
        tmdbId: request.media.tmdbId,
      });
    }
  }

  const cacheMap = new Map<string, MediaSortCache>();

  await Promise.all(
    [...uniqueMedia.entries()].map(async ([key, { mediaType, tmdbId }]) => {
      const data = await fetchMediaSortCache(tmdb, mediaType, tmdbId);

      if (data) {
        cacheMap.set(key, data);
      }
    })
  );

  const multiplier = direction === 'asc' ? 1 : -1;

  return [...requests].sort((a, b) => {
    const keyA = `${a.type}-${a.media.tmdbId}`;
    const keyB = `${b.type}-${b.media.tmdbId}`;
    const cacheA = cacheMap.get(keyA);
    const cacheB = cacheMap.get(keyB);

    if (!cacheA && !cacheB) {
      return (a.id - b.id) * multiplier;
    }

    if (!cacheA) {
      return 1;
    }

    if (!cacheB) {
      return -1;
    }

    let comparison = 0;

    switch (field) {
      case 'title':
        comparison = cacheA.title.localeCompare(cacheB.title);
        break;
      case 'popularity':
        comparison = cacheA.popularity - cacheB.popularity;
        break;
      case 'voteAverage':
        comparison = cacheA.voteAverage - cacheB.voteAverage;
        break;
      case 'releaseDate':
        comparison = cacheA.releaseDate.localeCompare(cacheB.releaseDate);
        break;
    }

    if (comparison === 0) {
      return (a.id - b.id) * multiplier;
    }

    return comparison * multiplier;
  });
}
