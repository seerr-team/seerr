import { MediaType } from '@server/constants/media';
import { z } from 'zod';

export const recentsearchesCreate = z.object({
  ratingKey: z.coerce.string().optional(),
  tmdbId: z.coerce.number(),
  mediaType: z.nativeEnum(MediaType),
  title: z.coerce.string().optional(),
});
