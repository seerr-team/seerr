import { MediaType } from '@server/constants/media';
import { z } from 'zod';

export const watchlistCreate = z
  .object({
    ratingKey: z.coerce.string().optional(),
    mediaType: z.nativeEnum(MediaType),
    title: z.coerce.string().optional(),
  })
  .and(
    z.union([
      z.object({ tmdbId: z.coerce.number() }),
      z.object({ mbId: z.coerce.string() }),
    ])
  );
