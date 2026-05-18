import { MediaType } from '@server/constants/media';
import { z } from 'zod';

export const watchlistCreate = z.object({
  ratingKey: z.coerce.string().optional(),
  tmdbId: z.coerce.number(),
  mediaType: z.nativeEnum(MediaType),
  title: z.coerce.string().optional(),
});

export const plexWatchlistAction = z.object({
  tmdbId: z.coerce.number().int().positive(),
  mediaType: z.nativeEnum(MediaType),
});

export const plexWatchlistStatusQuery = z.object({
  tmdbId: z.coerce.number().int().positive(),
  mediaType: z.nativeEnum(MediaType),
});
