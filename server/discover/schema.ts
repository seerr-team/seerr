/**
 * Discover filter parsing.
 *
 * The query schema is built from {@link DISCOVER_DIMENSIONS} so the flat
 * URL-param keys cannot drift from the structured type. Both the client
 * (flat `FilterOptions` shape, via `@server/discover/schema`) and the server
 * (structured `DiscoverFilter` via {@link DiscoverFilterSchema}) import it.
 *
 * `z.coerce.string()` accepts both Express `req.query` values (string |
 * string[]) and plain router strings, so one schema serves both consumers.
 */
import { z } from 'zod';
import {
  DISCOVER_DIMENSIONS,
  type DimensionFilter,
  type DimensionFlatKey,
  type DimensionKey,
  type DiscoverFilter,
} from './types';

const split = (v?: string): string[] | undefined => {
  // Seerr selectors use a mix of separators: LanguageSelector and
  // StatusSelector emit pipe-separated values (shared with user settings),
  // while GenreSelector, KeywordSelector, CountrySelector, etc. use commas.
  // Accepting both keeps the URL contract compatible with the existing
  // components instead of forcing a migration to a single separator.
  const arr = v?.split(/[,|]/).filter(Boolean);
  return arr?.length ? arr : undefined;
};

const range = (gte?: string, lte?: string) =>
  gte || lte ? { gte, lte } : undefined;

// Build the dimension shape directly from the registry so the flat keys stay
// in lockstep with the structured type. `Object.fromEntries` widens keys, so
// we cast back to the exact literal union.
const dimensionShape = Object.fromEntries(
  (
    Object.entries(DISCOVER_DIMENSIONS) as [
      DimensionKey,
      (typeof DISCOVER_DIMENSIONS)[DimensionKey],
    ][]
  ).flatMap(([, { includeKey, excludeKey }]) => [
    [includeKey, z.coerce.string().optional()],
    [excludeKey, z.coerce.string().optional()],
  ])
) as Record<DimensionFlatKey, z.ZodOptional<z.ZodString>>;

/**
 * Flat URL-param schema. The single source of truth for which query params
 * discover accepts. Imported by the client as `QueryFilterOptions` and by the
 * server as the base of {@link DiscoverFilterSchema}.
 */
export const DiscoverFilterQuerySchema = z.object({
  ...dimensionShape,
  // Ranges
  primaryReleaseDateGte: z.coerce.string().optional(),
  primaryReleaseDateLte: z.coerce.string().optional(),
  firstAirDateGte: z.coerce.string().optional(),
  firstAirDateLte: z.coerce.string().optional(),
  withRuntimeGte: z.coerce.string().optional(),
  withRuntimeLte: z.coerce.string().optional(),
  voteAverageGte: z.coerce.string().optional(),
  voteAverageLte: z.coerce.string().optional(),
  voteCountGte: z.coerce.string().optional(),
  voteCountLte: z.coerce.string().optional(),
  // Certification
  certification: z.coerce.string().optional(),
  certificationGte: z.coerce.string().optional(),
  certificationLte: z.coerce.string().optional(),
  certificationCountry: z.coerce.string().optional(),
  certificationMode: z.enum(['exact', 'range']).optional(),
  // Watch providers
  watchRegion: z.coerce.string().optional(),
  // Scalars
  sortBy: z.coerce.string().optional(),
});

/** Server-side transform: flat params → structured, plan-ready filter. */
export const DiscoverFilterSchema = DiscoverFilterQuerySchema.transform(
  (raw): DiscoverFilter => {
    const dimensions = {} as Record<DimensionKey, DimensionFilter>;
    for (const [dim, { includeKey, excludeKey }] of Object.entries(
      DISCOVER_DIMENSIONS
    ) as [DimensionKey, (typeof DISCOVER_DIMENSIONS)[DimensionKey]][]) {
      dimensions[dim] = {
        include: split(raw[includeKey]),
        exclude: split(raw[excludeKey]),
      };
    }
    return {
      ...dimensions,
      primaryReleaseDate: range(
        raw.primaryReleaseDateGte,
        raw.primaryReleaseDateLte
      ),
      firstAirDate: range(raw.firstAirDateGte, raw.firstAirDateLte),
      runtime: range(raw.withRuntimeGte, raw.withRuntimeLte),
      voteAverage: range(raw.voteAverageGte, raw.voteAverageLte),
      voteCount: range(raw.voteCountGte, raw.voteCountLte),
      certification:
        raw.certification ||
        raw.certificationGte ||
        raw.certificationLte ||
        raw.certificationCountry
          ? {
              value: raw.certification,
              gte: raw.certificationGte,
              lte: raw.certificationLte,
              country: raw.certificationCountry,
            }
          : undefined,
      sortBy: raw.sortBy,
    };
  }
);
