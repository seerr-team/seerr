import { MediaType } from '@server/constants/media';
import { z } from 'zod';

export const watchlistCreate = z.object({
  ratingKey: z.coerce.string().optional(),
  tmdbId: z.coerce.number().optional(),
  mbId: z.coerce.string().optional(),
  mediaType: z.nativeEnum(MediaType),
  title: z.coerce.string().optional(),
});
