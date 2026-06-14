import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieReleaseResult,
  TmdbTvRatingResult,
} from '@server/api/themoviedb/interfaces';
import type { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';

/**
 * Per-user maturity rating caps.
 *
 * Seerr has no native per-user rating controls; this module adds an
 * admin-controlled, server-enforced cap so capped (e.g. child) accounts cannot
 * discover or request titles above their maximum certification.
 *
 * Caps are stored on the User entity as TMDB US certification strings
 * (e.g. "PG-13", "TV-14"). A null/undefined cap means "no limit".
 */

export const DEFAULT_RATING_COUNTRY = 'US';

// Ordered low -> high. Array index is the rank used for comparisons.
export const MOVIE_RATING_SCALE = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
export const TV_RATING_SCALE = [
  'TV-Y',
  'TV-Y7',
  'TV-G',
  'TV-PG',
  'TV-14',
  'TV-MA',
];

export interface EffectiveRatingCaps {
  movie: string | null;
  tv: string | null;
  // When true, titles with no/unknown certification are blocked for the user.
  blockUnrated: boolean;
}

const rankOf = (scale: string[], cert?: string | null): number | null => {
  if (!cert) {
    return null;
  }
  const idx = scale.indexOf(cert.toUpperCase());
  return idx === -1 ? null : idx;
};

/**
 * Returns the active caps for a user, or null when no filtering applies.
 *
 * Filtering is skipped for unauthenticated requests, users who can manage other
 * users (admins always bypass, mirroring quota behavior), and users with no cap
 * configured for either media type.
 */
export const getEffectiveRatingCaps = (
  user?: User
): EffectiveRatingCaps | null => {
  if (!user) {
    return null;
  }
  if (user.hasPermission(Permission.MANAGE_USERS)) {
    return null;
  }
  const movie = user.maxMovieRating ?? null;
  const tv = user.maxTvRating ?? null;
  if (!movie && !tv) {
    return null;
  }
  return {
    movie,
    tv,
    // Default to blocking unrated content when a cap is set (mirrors Jellyfin's
    // "block unrated items"). Admins can opt out per user.
    blockUnrated: user.ratingBlockUnrated ?? true,
  };
};

/** Extracts the US (or given country) certification string for a movie. */
export const extractMovieCertification = (
  releaseResult: TmdbMovieReleaseResult | undefined,
  country = DEFAULT_RATING_COUNTRY
): string | undefined => {
  const releaseDates = releaseResult?.results.find(
    (r) => r.iso_3166_1 === country
  )?.release_dates;
  return releaseDates?.find((r) => r.certification)?.certification || undefined;
};

/** Extracts the US (or given country) content rating string for a TV show. */
export const extractTvCertification = (
  ratingResult: TmdbTvRatingResult | undefined,
  country = DEFAULT_RATING_COUNTRY
): string | undefined => {
  return (
    ratingResult?.results.find((r) => r.iso_3166_1 === country)?.rating ||
    undefined
  );
};

/**
 * Core comparison: is a certification allowed given a cap?
 * - No cap -> always allowed.
 * - Unrated/unknown certification -> allowed only when blockUnrated is false.
 * - Otherwise allowed when its rank is at or below the cap's rank.
 */
const isCertificationAllowed = (
  cert: string | undefined,
  cap: string | null,
  scale: string[],
  blockUnrated: boolean
): boolean => {
  if (!cap) {
    return true;
  }
  const capRank = rankOf(scale, cap);
  if (capRank === null) {
    // Unknown cap value; fail open rather than block everything.
    return true;
  }
  const certRank = rankOf(scale, cert);
  if (certRank === null) {
    return !blockUnrated;
  }
  return certRank <= capRank;
};

export const isMovieCertificationAllowed = (
  cert: string | undefined,
  user?: User
): boolean => {
  const caps = getEffectiveRatingCaps(user);
  if (!caps || !caps.movie) {
    return true;
  }
  return isCertificationAllowed(
    cert,
    caps.movie,
    MOVIE_RATING_SCALE,
    caps.blockUnrated
  );
};

export const isTvCertificationAllowed = (
  cert: string | undefined,
  user?: User
): boolean => {
  const caps = getEffectiveRatingCaps(user);
  if (!caps || !caps.tv) {
    return true;
  }
  return isCertificationAllowed(
    cert,
    caps.tv,
    TV_RATING_SCALE,
    caps.blockUnrated
  );
};

/**
 * Filters a list of discover/search results, dropping any movie/tv item above
 * the user's cap. Person and collection results pass through (their underlying
 * titles are still gated at the detail and request layers).
 *
 * Runs only for capped users; everyone else gets the list back untouched with
 * zero extra TMDB calls. Certification lookups use lightweight, cached TMDB
 * endpoints. Note: filtering can produce shorter pages than requested — this is
 * an accepted trade-off for correctness over a cosmetic, gameable filter.
 */
export const filterResultsByRatingCaps = async <
  T extends { id: number; tmdbId?: number; mediaType: string },
>(
  items: T[],
  user: User | undefined
): Promise<T[]> => {
  const caps = getEffectiveRatingCaps(user);
  if (!caps) {
    return items;
  }

  const tmdb = new TheMovieDb();

  const keep = await Promise.all(
    items.map(async (item) => {
      // Discover/search results expose the TMDB id as `id`; watchlist rows use
      // `tmdbId` (their `id` is a local row id), so prefer `tmdbId`.
      const tmdbId = item.tmdbId ?? item.id;
      try {
        if (item.mediaType === 'movie') {
          if (!caps.movie) {
            return true;
          }
          const releases = await tmdb.getMovieReleaseDates({
            movieId: tmdbId,
          });
          return isCertificationAllowed(
            extractMovieCertification(releases),
            caps.movie,
            MOVIE_RATING_SCALE,
            caps.blockUnrated
          );
        }
        if (item.mediaType === 'tv') {
          if (!caps.tv) {
            return true;
          }
          const ratings = await tmdb.getTvContentRatings({ tvId: tmdbId });
          return isCertificationAllowed(
            extractTvCertification(ratings),
            caps.tv,
            TV_RATING_SCALE,
            caps.blockUnrated
          );
        }
        // person, collection, etc.
        return true;
      } catch (e) {
        logger.debug('Rating cap lookup failed; applying unrated policy', {
          label: 'Ratings',
          mediaType: item.mediaType,
          tmdbId,
          errorMessage: e.message,
        });
        // Native discover queries already enforce the cap at the TMDB level, so
        // a transient cert-lookup failure here must not drop a title — doing so
        // empties out otherwise-valid pages on a cold cache (20 concurrent
        // lookups can rate-limit). Fail open; the detail and request endpoints
        // remain the hard wall on anything genuinely over-cap.
        return true;
      }
    })
  );

  return items.filter((_, index) => keep[index]);
};

/**
 * Best-effort mapping of a Jellyfin user-policy MaxParentalRating (an integer
 * "block score" from Jellyfin's localization rating tables) to TMDB US
 * certification caps. Values follow Jellyfin's default US scores; admins can
 * always override the imported caps in the Seerr UI.
 *
 * Returns null caps when no limit is set in Jellyfin.
 */
export const jellyfinRatingToCaps = (
  maxParentalRating?: number | null
): { movie: string | null; tv: string | null } => {
  if (maxParentalRating == null) {
    return { movie: null, tv: null };
  }

  // Jellyfin (10.10+) uses age-based parental rating *scores*, not small
  // ordinals. With the default US localization the scores are:
  //   movies: G=0, PG=10, PG-13=13, R=17, NC-17=17
  //   tv:     TV-Y=0, TV-G=0, TV-Y7=7, TV-PG=10, TV-14=14, TV-MA=17
  // Map the user's max score to the highest TMDB certification still allowed at
  // that score (i.e. the most permissive cert whose Jellyfin score <= the cap).
  const v = maxParentalRating;

  let movie: string;
  if (v < 10) movie = 'G';
  else if (v < 13) movie = 'PG';
  else if (v < 17) movie = 'PG-13';
  else movie = 'NC-17';

  let tv: string;
  if (v < 10) tv = 'TV-G';
  else if (v < 14) tv = 'TV-PG';
  else if (v < 17) tv = 'TV-14';
  else tv = 'TV-MA';

  return { movie, tv };
};

/**
 * Imports maturity rating caps onto a Seerr user from a Jellyfin user policy
 * (issue #354). This is intentionally non-destructive: when Jellyfin has no
 * MaxParentalRating set, the user's existing Seerr caps are left untouched, so
 * an admin can still manage caps manually until Jellyfin becomes the source of
 * truth. Mutates the passed user; the caller is responsible for saving it.
 */
export const applyJellyfinRatingCaps = (
  user: User,
  policy?: { MaxParentalRating?: number | null; BlockUnratedItems?: string[] }
): void => {
  if (!policy || policy.MaxParentalRating == null) {
    return;
  }
  const caps = jellyfinRatingToCaps(policy.MaxParentalRating);
  user.maxMovieRating = caps.movie;
  user.maxTvRating = caps.tv;
  user.ratingBlockUnrated = (policy.BlockUnratedItems?.length ?? 0) > 0;
};
