import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import type { UserContentRatingLimits } from '@server/constants/contentRatings';
import {
  MOVIE_RATINGS,
  TV_RATINGS,
  UNRATED_VALUES,
  shouldFilterMovie,
  shouldFilterTv,
  type MovieRating,
  type TvRating,
} from '@server/constants/contentRatings';
import type { User } from '@server/entity/User';

export function getUserContentRatingLimits(
  user?: User
): UserContentRatingLimits | undefined {
  const maxMovieRating = user?.settings?.maxMovieRating ?? undefined;
  const maxTvRating = user?.settings?.maxTvRating ?? undefined;
  const blockUnrated = user?.settings?.blockUnrated ?? false;

  if (!maxMovieRating && !maxTvRating && !blockUnrated) {
    return undefined;
  }

  return { maxMovieRating, maxTvRating, blockUnrated };
}

// Most restrictive US release certification, excluding unrated-style values
// when a real certification also exists (an unrated cut shouldn't override
// the theatrical rating).
export function getMovieCertification(
  details: Pick<TmdbMovieDetails, 'release_dates'>
): string | undefined {
  const usCerts = details.release_dates?.results
    .find((r) => r.iso_3166_1 === 'US')
    ?.release_dates.map((rd) => rd.certification)
    .filter((cert) => !UNRATED_VALUES.includes(cert));

  return usCerts?.reduce<string | undefined>(
    (worst, cert) =>
      worst === undefined ||
      MOVIE_RATINGS.indexOf(cert as MovieRating) >
        MOVIE_RATINGS.indexOf(worst as MovieRating)
        ? cert
        : worst,
    undefined
  );
}

// A show can carry multiple US ratings (e.g. different seasons or networks);
// the most restrictive one wins.
export function getTvCertification(
  details: Pick<TmdbTvDetails, 'content_ratings'>
): string | undefined {
  const usRatings = details.content_ratings?.results
    .filter((r) => r.iso_3166_1 === 'US')
    .map((r) => r.rating)
    .filter((rating) => rating && !UNRATED_VALUES.includes(rating));

  return usRatings?.reduce<string | undefined>(
    (worst, rating) =>
      worst === undefined ||
      TV_RATINGS.indexOf(rating as TvRating) >
        TV_RATINGS.indexOf(worst as TvRating)
        ? rating
        : worst,
    undefined
  );
}

// Shared so the rate limiter is global rather than per-call.
let lookupTmdb: TheMovieDb | undefined;

async function filterList<T extends { id: number }>(
  items: T[],
  limits: UserContentRatingLimits | undefined,
  getCert: (id: number, tmdb: TheMovieDb) => Promise<string | undefined>,
  isBlocked: (cert: string | undefined) => boolean
): Promise<T[]> {
  if (!limits) return items;

  const tmdb = (lookupTmdb ??= new TheMovieDb());
  const settled = await Promise.allSettled(
    items.map(async (item) => ({ item, cert: await getCert(item.id, tmdb) }))
  );

  // A rejected lookup fails closed: the item is dropped.
  return settled.flatMap((outcome) =>
    outcome.status === 'fulfilled' && !isBlocked(outcome.value.cert)
      ? [outcome.value.item]
      : []
  );
}

export function filterMoviesByRating<T extends { id: number }>(
  items: T[],
  limits: UserContentRatingLimits | undefined
): Promise<T[]> {
  return filterList(
    items,
    limits,
    async (id, tmdb) =>
      getMovieCertification(await tmdb.getMovie({ movieId: id })),
    (cert) =>
      shouldFilterMovie(cert, limits?.maxMovieRating, limits?.blockUnrated)
  );
}

export function filterTvByRating<T extends { id: number }>(
  items: T[],
  limits: UserContentRatingLimits | undefined
): Promise<T[]> {
  return filterList(
    items,
    limits,
    async (id, tmdb) => getTvCertification(await tmdb.getTvShow({ tvId: id })),
    (cert) => shouldFilterTv(cert, limits?.maxTvRating, limits?.blockUnrated)
  );
}

function mediaTypeOf(item: unknown): string | undefined {
  const record = item as { media_type?: string; mediaType?: string };
  return record.media_type ?? record.mediaType;
}

// Splits a mixed result list (movie/tv/person, e.g. trending or search) by
// media type. Person entries pass through untouched; anything that isn't
// movie/tv/person is dropped rather than let an unrecognized shape through.
export async function filterMixedResults<T extends { id: number }>(
  items: T[],
  limits: UserContentRatingLimits | undefined
): Promise<T[]> {
  if (!limits) return items;

  const movies = items.filter((item) => mediaTypeOf(item) === 'movie');
  const tv = items.filter((item) => mediaTypeOf(item) === 'tv');

  const [allowedMovies, allowedTv] = await Promise.all([
    filterMoviesByRating(movies, limits),
    filterTvByRating(tv, limits),
  ]);
  const allowed = new Set<T>([...allowedMovies, ...allowedTv]);

  return items.filter(
    (item) => mediaTypeOf(item) === 'person' || allowed.has(item)
  );
}

export const COALESCE_FACTOR = 2;

export interface CoalescedPage<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
}

// Search and trending have no TMDB-side certification filter, so filtering
// leaves pages sparse. Client page N is built from a fixed window of upstream
// pages ((N-1)*k+1 .. N*k), which keeps pages full with no cursor to track and
// no overlap. totalResults stays as TMDB reported it, an upper bound either way.
export async function coalescePages<T>(
  clientPage: number,
  fetchPage: (page: number) => Promise<{
    page: number;
    total_pages: number;
    total_results: number;
    results: T[];
  }>,
  filterResults: (results: T[]) => Promise<T[]>
): Promise<CoalescedPage<T>> {
  const first = (clientPage - 1) * COALESCE_FACTOR + 1;
  const firstData = await fetchPage(first);
  const upstreamTotal = firstData.total_pages;

  const restPages = [];
  for (
    let p = first + 1;
    p <= clientPage * COALESCE_FACTOR && p <= upstreamTotal;
    p++
  ) {
    restPages.push(p);
  }
  const rest = await Promise.all(restPages.map((p) => fetchPage(p)));

  const combined = ([firstData, ...rest] as { results: T[] }[]).flatMap(
    (d) => d.results
  );

  return {
    page: clientPage,
    totalPages: Math.ceil(upstreamTotal / COALESCE_FACTOR),
    totalResults: firstData.total_results,
    results: await filterResults(combined),
  };
}
