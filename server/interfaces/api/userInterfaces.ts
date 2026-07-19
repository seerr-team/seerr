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

export interface QuotaResponse {
  movie: QuotaStatus;
  tv: QuotaStatus;
}

export interface RetentionLimitStatus {
  enabled: boolean;
  /** Maximum number of days this user may choose to keep media. Undefined means unlimited. */
  maxDays?: number;
  /** Whether this user may choose (or be granted) indefinite retention, exempting media from auto-purge entirely. Requires Permission.KEEP_MEDIA or admin-level request management. */
  canKeepIndefinitely: boolean;
  /**
   * The raw configured global default (or the user's own override, if set),
   * in days. Unlike maxDays, this is always populated regardless of
   * admin/bypass status - it's what an admin resets a request back to,
   * not a restriction. Undefined means the default itself is unlimited.
   */
  defaultDays?: number;
}

/**
 * Retention period applied when a user isn't allowed to choose indefinite
 * retention and no explicit day cap is configured. Keeps "no cap configured"
 * from silently meaning "kept forever" for users without KEEP_MEDIA.
 */
export const DEFAULT_RETENTION_FALLBACK_DAYS = 365;

export interface RetentionLimitResponse {
  movie: RetentionLimitStatus;
  tv: RetentionLimitStatus;
}

export interface UserWatchDataResponse {
  recentlyWatched: Media[];
  playCount: number;
}
