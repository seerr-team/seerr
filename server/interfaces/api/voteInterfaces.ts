import { MediaType } from '@server/constants/media';
import { VoteActionType } from '@server/entity/Vote';
import { z } from 'zod';
import type { PaginatedResponse } from './common';

export const voteCreate = z.object({
  tmdbId: z.coerce.number(),
  mediaType: z.nativeEnum(MediaType),
  actionType: z.nativeEnum(VoteActionType),
});

export const votePathParams = z.object({
  tmdbId: z.coerce.number(),
  mediaType: z.nativeEnum(MediaType),
});

export const voteHistoryQuery = z.object({
  take: z.coerce.number().min(1).max(100).optional().default(20),
  skip: z.coerce.number().min(0).optional().default(0),
  filter: z
    .enum(['all', VoteActionType.INTERESTED, VoteActionType.NOT_INTERESTED])
    .optional()
    .default('all'),
  mediaType: z
    .enum(['all', MediaType.MOVIE, MediaType.TV])
    .optional()
    .default('all'),
  sort: z.enum(['added']).optional().default('added'),
  sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

export interface VoteResponse {
  id: number;
  tmdbId: number;
  mediaType: MediaType;
  actionType: VoteActionType;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoteUpsertResponse extends VoteResponse {
  created: boolean;
}

export interface VoteLookupResponse {
  vote: VoteResponse | null;
}

export interface VoteHistoryResponse extends PaginatedResponse {
  results: VoteResponse[];
}
