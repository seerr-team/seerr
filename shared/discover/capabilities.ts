/**
 * Capabilities matrix — the single source of truth for what the discover
 * filter UI can do per (dimension, mediaType).
 *
 * The UI reads this table to decide two things:
 *   1. Whether a section renders at all          → include || exclude
 *   2. Whether the Include/Excluded toggle renders → exclude
 *
 * Every entry here must correspond to a real section in `FilterSlideover`.
 * The `false` values exist because the underlying data source (TMDB's
 * discover endpoint) makes the operation impossible — not because the feature
 * is unfinished.
 */
import type { DimensionKey } from './types';

export type Capability = { include: boolean; exclude: boolean };

export const FILTER_CAPABILITIES: {
  movie: Record<DimensionKey, Capability>;
  tv: Record<DimensionKey, Capability>;
} = {
  movie: {
    genres: { include: true, exclude: true }, // TMDB: with_genres + without_genres
    keywords: { include: true, exclude: true }, // TMDB: with_keywords + without_keywords
    studio: { include: true, exclude: true }, // TMDB: with_companies + without_companies
    watchProviders: {
      include: true,
      // TMDB exposes without_watch_providers, but discover only surfaces the
      // include direction ("where can I watch this"). No toggle is rendered.
      exclude: false,
    },
    language: { include: true, exclude: true }, // post-filtered on original_language
    country: {
      include: true, // TMDB: with_origin_country
      exclude: true, // no without_origin_country; excluded via complement query
    },
    // Movies have no status field on the TMDB discover endpoint — the section
    // is hidden entirely (both flags false).
    status: { include: false, exclude: false },
  },
  tv: {
    genres: { include: true, exclude: true },
    keywords: { include: true, exclude: true },
    // TV has no studio dimension (it uses networks, which discover does not
    // surface) — the section is hidden entirely.
    studio: { include: false, exclude: false },
    watchProviders: {
      include: true,
      exclude: false,
    },
    language: { include: true, exclude: true },
    country: {
      include: true, // TMDB: with_origin_country
      exclude: true, // post-filtered on origin_country (present on TV list items)
    },
    status: {
      include: true, // TMDB: with_status
      exclude: true, // no without_status; excluded via complement query
    },
  },
};
