import type { User } from '@server/entity/User';
import type { PaginatedResponse } from '@server/interfaces/api/common';

export interface BlacklistItem {
  externalId: number;
  mediaType: 'movie' | 'tv' | 'book';
  title?: string;
  createdAt?: Date;
  user?: User;
  blacklistedTags?: string;
}

export interface BlacklistResultsResponse extends PaginatedResponse {
  results: BlacklistItem[];
}
