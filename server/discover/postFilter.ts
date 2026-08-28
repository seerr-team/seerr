import type { ListResult, PostFilterSpec } from './types';

/**
 * Apply post-filter rules to discover results that have already been returned
 * by TMDB. Used for exclusion dimensions where TMDB has no native `without_*`
 * param and the relevant field IS present on the list response (language on
 * both movie/TV, origin_country on TV only).
 *
 * Pure function — no imports from the API, route, or DB layers.
 */
export function applyPostFilter<T extends ListResult>(
  results: T[],
  spec: PostFilterSpec
): { filtered: T[]; dropped: number } {
  const langSet = spec.excludeLanguages?.length
    ? new Set(spec.excludeLanguages)
    : null;
  const countrySet = spec.excludeCountries?.length
    ? new Set(spec.excludeCountries)
    : null;

  if (!langSet && !countrySet) {
    return { filtered: results, dropped: 0 };
  }

  const filtered = results.filter((item) => {
    if (
      langSet &&
      item.original_language &&
      langSet.has(item.original_language)
    ) {
      return false;
    }
    if (countrySet && item.origin_country?.some((c) => countrySet.has(c))) {
      return false;
    }
    return true;
  });

  return { filtered, dropped: results.length - filtered.length };
}
