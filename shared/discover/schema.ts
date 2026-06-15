/**
 * Single source of truth for discover filter parsing.
 *
 * Imported by both `server/routes/discover.ts` and
 * `src/components/Discover/constants.ts`. Parses paired flat URL params
 * (`?genre=28&excludeGenres=27`) into a structured {@link DiscoverFilter}
 * (`{ genres: { include: ['28'], exclude: ['27'] } }`).
 *
 * `z.coerce.string()` is used for server-side parsing (req.query values are
 * string arrays); the same schema accepts plain strings on the client.
 */
import { z } from 'zod';
import type { DiscoverFilter } from './types';

const split = (v?: string): string[] | undefined => {
  const arr = v?.split(',').filter(Boolean);
  return arr?.length ? arr : undefined;
};

const range = (gte?: string, lte?: string) =>
  gte || lte ? { gte, lte } : undefined;

export const DiscoverFilterSchema = z
  .object({
    // Paired dimensions
    genre: z.coerce.string().optional(),
    excludeGenres: z.coerce.string().optional(),
    keywords: z.coerce.string().optional(),
    excludeKeywords: z.coerce.string().optional(),
    studio: z.coerce.string().optional(),
    excludeStudio: z.coerce.string().optional(),
    watchProviders: z.coerce.string().optional(),
    excludeWatchProviders: z.coerce.string().optional(),
    language: z.coerce.string().optional(),
    excludeLanguages: z.coerce.string().optional(),
    country: z.coerce.string().optional(),
    excludeCountries: z.coerce.string().optional(),
    status: z.coerce.string().optional(),
    excludeStatus: z.coerce.string().optional(),
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
    // Client-only marker for which certification inputs to render
    certificationMode: z.enum(['exact', 'range']).optional(),
    // Scalars
    sortBy: z.coerce.string().optional(),
    page: z.coerce.number().optional(),
  })
  .transform(
    (raw): DiscoverFilter => ({
      genres: { include: split(raw.genre), exclude: split(raw.excludeGenres) },
      keywords: {
        include: split(raw.keywords),
        exclude: split(raw.excludeKeywords),
      },
      studio: {
        include: split(raw.studio),
        exclude: split(raw.excludeStudio),
      },
      watchProviders: {
        include: split(raw.watchProviders),
        exclude: split(raw.excludeWatchProviders),
      },
      language: {
        include: split(raw.language),
        exclude: split(raw.excludeLanguages),
      },
      country: {
        include: split(raw.country),
        exclude: split(raw.excludeCountries),
      },
      status: {
        include: split(raw.status),
        exclude: split(raw.excludeStatus),
      },
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
      page: raw.page,
    })
  );

/**
 * Flat representation derived from the structured filter. Used by client-side
 * helpers that still operate on flat URL params (e.g. `prepareFilterValues`,
 * `countActiveFilters`). Kept in sync with the schema's flat input shape.
 */
export const FlatFilterKeys = [
  'sortBy',
  'primaryReleaseDateGte',
  'primaryReleaseDateLte',
  'firstAirDateGte',
  'firstAirDateLte',
  'studio',
  'excludeStudio',
  'genre',
  'excludeGenres',
  'keywords',
  'excludeKeywords',
  'language',
  'excludeLanguages',
  'watchProviders',
  'excludeWatchProviders',
  'country',
  'excludeCountries',
  'status',
  'excludeStatus',
  'withRuntimeGte',
  'withRuntimeLte',
  'voteAverageGte',
  'voteAverageLte',
  'voteCountGte',
  'voteCountLte',
  'watchRegion',
  'certification',
  'certificationGte',
  'certificationLte',
  'certificationCountry',
  'certificationMode',
] as const;

export type FlatFilterKey = (typeof FlatFilterKeys)[number];

export type FlatFilterValues = Partial<Record<FlatFilterKey, string>>;

export const isFlatFilterKey = (k: string): k is FlatFilterKey =>
  (FlatFilterKeys as readonly string[]).includes(k);
