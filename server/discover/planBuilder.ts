import type { SortOptions } from '@server/api/themoviedb';
import { buildComplement } from '@server/discover/countryCodes';
import type {
  DiscoverFilter,
  DiscoverPlan,
  PostFilterSpec,
  TmdbDiscoverMovieParams,
  TmdbDiscoverTvParams,
} from './types';

const PAGE_SIZE = 20;

const ALL_TV_STATUS = ['0', '1', '2', '3', '4', '5'];

/** Normalise a date string to YYYY-MM-DD as TMDB expects. */
const normalizeDate = (d?: string): string | undefined =>
  d ? new Date(d).toISOString().split('T')[0] : undefined;

const join = (arr?: string[]): string | undefined =>
  arr?.length ? arr.join(',') : undefined;

/**
 * Translate a structured discover filter into the options the TMDB wrapper
 * needs plus any post-filter rules the route handler must apply after TMDB
 * returns. Centralising this here keeps the route handlers thin.
 *
 * Some dimensions are filtered natively by TMDB (genres, companies, watch
 * providers). Others cannot be, because the data source exposes no param or
 * no field on the list response — those are handled either by post-filtering
 * the returned items (language) or by asking TMDB to include the complement
 * of what we want to exclude (movie country, TV status).
 */
export function buildDiscoverPlan(
  filter: DiscoverFilter,
  mediaType: 'movie' | 'tv',
  allCountryCodes: string[]
): DiscoverPlan {
  const discoverOptions =
    mediaType === 'movie'
      ? ({} as TmdbDiscoverMovieParams)
      : ({} as TmdbDiscoverTvParams);
  const postFilter: PostFilterSpec = {};

  // Normalise: ensure every dimension exists (the schema always produces a
  // full object, but callers may pass partials).
  const dim = (d: typeof filter.genres | undefined) => d ?? {};

  // ── Sort / page ──
  if (filter.sortBy) {
    discoverOptions.sortBy = filter.sortBy as SortOptions;
  }

  // Genres — TMDB filters natively via with_genres / without_genres
  if (dim(filter.genres).include?.length)
    discoverOptions.genre = filter.genres.include!.join(',');
  if (dim(filter.genres).exclude?.length)
    discoverOptions.excludeGenres = filter.genres.exclude!.join(',');

  // Keywords — TMDB filters natively via with_keywords / without_keywords
  discoverOptions.keywords = join(dim(filter.keywords).include);
  if (dim(filter.keywords).exclude?.length)
    discoverOptions.excludeKeywords = filter.keywords!.exclude!.join(',');

  // Studio — movies only (TMDB: with_companies / without_companies)
  if (mediaType === 'movie') {
    const movieOptions = discoverOptions as TmdbDiscoverMovieParams;
    movieOptions.studio = join(dim(filter.studio).include);
    if (dim(filter.studio).exclude?.length)
      movieOptions.excludeStudio = filter.studio!.exclude!.join(',');
  }

  // Watch providers — TMDB filters natively via with_watch_providers
  // (exclude is technically possible via without_watch_providers but not
  // surfaced in the UI — see FILTER_CAPABILITIES).
  discoverOptions.watchProviders = join(dim(filter.watchProviders).include);

  // Language — original_language is on both movie and TV list responses, so
  // exclude can be applied as a post-filter. Include uses the native param.
  if (dim(filter.language).include?.length)
    discoverOptions.originalLanguage = filter.language!.include!.join('|');
  if (dim(filter.language).exclude?.length)
    postFilter.excludeLanguages = filter.language!.exclude;

  // Country — origin_country is absent from the movie list response but
  // present on TV. Excluding a movie country therefore has to be done by
  // asking TMDB to include the complement; excluding a TV country can be
  // done locally after TMDB returns.
  if (mediaType === 'movie') {
    const movieOptions = discoverOptions as TmdbDiscoverMovieParams;
    if (dim(filter.country).exclude?.length) {
      movieOptions.originCountryParam = buildComplement(
        allCountryCodes,
        filter.country!.exclude!
      );
    } else if (dim(filter.country).include?.length) {
      movieOptions.originCountryParam = filter.country!.include!.join('|');
    }
  } else {
    const tvOptions = discoverOptions as TmdbDiscoverTvParams;
    if (dim(filter.country).include?.length)
      tvOptions.country = filter.country!.include!.join('|');
    if (dim(filter.country).exclude?.length)
      postFilter.excludeCountries = filter.country!.exclude;
  }

  // TV status — no without_status param, so exclude by asking for the
  // complement of the excluded values via with_status.
  if (mediaType === 'tv') {
    const tvOptions = discoverOptions as TmdbDiscoverTvParams;
    if (dim(filter.status).exclude?.length) {
      tvOptions.withStatus = buildComplement(
        ALL_TV_STATUS,
        filter.status!.exclude!
      );
    } else if (dim(filter.status).include?.length) {
      tvOptions.withStatus = filter.status!.include!.join('|');
    }
  }

  // ── Ranges ──
  if (mediaType === 'movie' && filter.primaryReleaseDate) {
    const movieOptions = discoverOptions as TmdbDiscoverMovieParams;
    movieOptions.primaryReleaseDateGte = normalizeDate(
      filter.primaryReleaseDate.gte
    );
    movieOptions.primaryReleaseDateLte = normalizeDate(
      filter.primaryReleaseDate.lte
    );
  }
  if (mediaType === 'tv' && filter.firstAirDate) {
    const tvOptions = discoverOptions as TmdbDiscoverTvParams;
    tvOptions.firstAirDateGte = normalizeDate(filter.firstAirDate.gte);
    tvOptions.firstAirDateLte = normalizeDate(filter.firstAirDate.lte);
  }
  if (filter.runtime) {
    discoverOptions.withRuntimeGte = filter.runtime.gte;
    discoverOptions.withRuntimeLte = filter.runtime.lte;
  }
  if (filter.voteAverage) {
    discoverOptions.voteAverageGte = filter.voteAverage.gte;
    discoverOptions.voteAverageLte = filter.voteAverage.lte;
  }
  if (filter.voteCount) {
    discoverOptions.voteCountGte = filter.voteCount.gte;
    discoverOptions.voteCountLte = filter.voteCount.lte;
  }
  if (filter.certification) {
    discoverOptions.certification = filter.certification.value;
    discoverOptions.certificationGte = filter.certification.gte;
    discoverOptions.certificationLte = filter.certification.lte;
    discoverOptions.certificationCountry = filter.certification.country;
  }

  return { discoverOptions, postFilter };
}

export { PAGE_SIZE };
