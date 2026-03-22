import type { User } from '@server/entity/User';
import type { PaginatedResponse } from '@server/interfaces/api/common';

export interface BlocklistItem {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title?: string;
  createdAt?: Date;
  user?: User;
  blocklistedTags?: string;
}

export interface BlocklistResultsResponse extends PaginatedResponse {
  results: BlocklistItem[];
}
