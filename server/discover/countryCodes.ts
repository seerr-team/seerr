import type TheMovieDb from '@server/api/themoviedb';

/**
 * Returns all ISO 3166-1 country codes. Reuses the existing `getRegions()`
 * method which is already cached for 24 hours via nodeCache.
 */
export async function getAllCountryCodes(tmdb: TheMovieDb): Promise<string[]> {
  const regions = await tmdb.getRegions();
  return regions.map((r) => r.iso_3166_1).filter(Boolean);
}

/**
 * Given the full set of codes and a subset to exclude, returns a pipe-joined
 * string of everything EXCEPT the excluded codes. TMDB has no way to exclude
 * an origin country directly, so we instead ask it to include the complement.
 */
export function buildComplement(allCodes: string[], exclude: string[]): string {
  const excludeSet = new Set(exclude);
  const result = allCodes.filter((c) => !excludeSet.has(c)).join('|');
  if (result.length > 7500) {
    throw new Error('Complement string exceeds safe URL length');
  }
  return result;
}
