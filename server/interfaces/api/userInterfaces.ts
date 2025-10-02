import type Media from '@server/entity/Media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { User } from '@server/entity/User';
import type { PaginatedResponse } from './common';

export interface UserResultsResponse extends PaginatedResponse {
  results: User[];
}

export interface UserRequestsResponse extends PaginatedResponse {
  results: MediaRequest[];
}

export interface QuotaStatus {
  days?: number;
  limit?: number;
  used: number;
  remaining?: number;
  restricted: boolean;
}

export type QuotaMode = 'split' | 'combined';

export interface QuotaResponse {
  mode: QuotaMode;
  movie: QuotaStatus;
  tv: QuotaStatus;
  combined: QuotaStatus;
}

export interface UserWatchDataResponse {
  recentlyWatched: Media[];
  playCount: number;
}
