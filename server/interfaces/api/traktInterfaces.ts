export interface TraktPublicSettings {
  clientId: string;
  clientSecretConfigured: boolean;
  callbackUrl: string | null;
}

export interface TraktSettingsUpdate {
  clientId: string;
  clientSecret?: string;
  confirmReconnectAll?: boolean;
}

/**
 * Membership depends on the configured application URL, so it is decided at runtime by
 * `isAllowedTraktOrigin` rather than by a fixed union.
 */
export type TraktAllowedOrigin = string;

export type TraktSafeResultCode =
  | 'access_denied'
  | 'actor_not_authorized'
  | 'client_id_changed'
  | 'confirm_reconnect_all_required'
  | 'invalid_state'
  | 'oauth_interrupted'
  | 'state_expired'
  | 'state_replayed'
  | 'target_has_different_trakt_account'
  | 'target_missing'
  | 'token_exchange_failed'
  | 'trakt_account_owned_by_another_user'
  | 'trakt_application_not_configured';

export interface TraktConnectionResponse {
  userId: number;
  traktUserId: string;
  traktUsername: string | null;
  traktSlug: string | null;
  displayName: string | null;
  status: 'active' | 'reconnect_required';
  connectedByUserId: number | null;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TraktAuthorizationResponse {
  transactionId: string;
  authorizationUrl: string;
  callbackOrigin: TraktAllowedOrigin;
  expiresAt: string;
}

export interface TraktUserSettingsResponse {
  applicationConfigured: boolean;
  connection: TraktConnectionResponse | null;
}

export interface TraktOAuthStatusResponse {
  status: 'pending' | 'succeeded' | 'failed';
  resultCode: TraktSafeResultCode | null;
}

export interface TraktWatchStatusItem {
  userId: number;
  displayName: string;
  traktUsername: string | null;
  watched: boolean;
  watchedAt: string | null;
  status: 'ok' | 'temporarily_unavailable';
}

export interface TraktWatchStatusResponse {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  items: TraktWatchStatusItem[];
}

export interface TraktWatcher {
  userId: number;
  displayName: string;
}

export interface TraktEpisodeWatchStatusItem {
  episodeNumber: number;
  watchedBy: TraktWatcher[];
}

export interface TraktSeasonWatchStatusItem {
  seasonNumber: number;
  airedEpisodes: number;
  /** Household members who have completed every aired episode of the season. */
  watchedBy: TraktWatcher[];
  episodes: TraktEpisodeWatchStatusItem[];
}

export interface TraktSeasonWatchStatusResponse {
  tmdbId: number;
  status: 'ok' | 'temporarily_unavailable';
  householdSize: number;
  seasons: TraktSeasonWatchStatusItem[];
}
