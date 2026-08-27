import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import axios from 'axios';

import { requireTraktCallbackUrl } from '@server/lib/trakt/config';
import { proxyRequestInterceptor } from '@server/utils/customProxyAgent';

const TRAKT_AUTH_URL = 'https://auth.trakt.tv';
const TRAKT_API_URL = 'https://api.trakt.tv';
const REQUEST_TIMEOUT = 10_000;

export interface TraktTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface TraktProfile {
  username: string | null;
  slug: string | null;
  displayName: string | null;
  traktUserId: string;
}

export class TraktApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryAfterSeconds?: number,
    /** OAuth `error` field, which distinguishes a dead grant from bad client credentials. */
    public readonly oauthError?: string
  ) {
    super(message);
    this.name = 'TraktApiError';
  }
}

interface TraktTokenResponse {
  access_token: string;
  refresh_token: string;
  created_at?: number;
  expires_in: number;
}

interface TraktSettingsResponse {
  user?: {
    username?: string;
    name?: string;
    ids?: {
      slug?: string;
      uuid?: unknown;
    };
  };
}

interface TraktSearchResult {
  type?: 'movie' | 'show';
  movie?: { ids?: { trakt?: number } };
  show?: { ids?: { trakt?: number } };
}

interface TraktHistoryEntry {
  watched_at?: string;
}

interface TraktShowProgressResponse {
  seasons?: {
    number?: number;
    aired?: number;
    completed?: number;
    episodes?: {
      number?: number;
      completed?: boolean;
    }[];
  }[];
}

export interface TraktSeasonProgress {
  seasonNumber: number;
  airedEpisodes: number;
  watchedEpisodes: number;
  episodes: { episodeNumber: number; watched: boolean }[];
}

const createTraktHttp = (baseURL: string): AxiosInstance => {
  const client = axios.create({ baseURL, timeout: REQUEST_TIMEOUT });
  client.interceptors.request.use(proxyRequestInterceptor);

  return client;
};

export default class TraktAPI {
  private accessTokenValidated = false;

  public constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly accessToken?: string,
    private readonly authHttp: AxiosInstance = createTraktHttp(TRAKT_AUTH_URL),
    private readonly apiHttp: AxiosInstance = createTraktHttp(TRAKT_API_URL)
  ) {}

  public buildAuthorizationUrl(state: string): string {
    const url = new URL('/oauth/authorize', TRAKT_AUTH_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', requireTraktCallbackUrl());
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'login');

    return url.toString();
  }

  public async exchangeCode(code: string): Promise<TraktTokenSet> {
    try {
      const response = await this.authHttp.post<TraktTokenResponse>(
        `${TRAKT_AUTH_URL}/oauth/token`,
        {
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: requireTraktCallbackUrl(),
          grant_type: 'authorization_code',
        },
        { timeout: REQUEST_TIMEOUT }
      );

      return this.toTokenSet(response.data, Date.now());
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  public async refresh(refreshToken: string): Promise<TraktTokenSet> {
    try {
      const response = await this.authHttp.post<TraktTokenResponse>(
        `${TRAKT_AUTH_URL}/oauth/token`,
        {
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: requireTraktCallbackUrl(),
          grant_type: 'refresh_token',
        },
        { timeout: REQUEST_TIMEOUT }
      );

      return this.toTokenSet(response.data, Date.now());
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  public async revoke(token: string): Promise<void> {
    try {
      await this.authHttp.post(
        `${TRAKT_AUTH_URL}/oauth/revoke`,
        {
          token,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        { timeout: REQUEST_TIMEOUT }
      );
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  public async getProfile(): Promise<TraktProfile> {
    try {
      const response = await this.apiHttp.get<TraktSettingsResponse>(
        '/users/settings',
        this.apiRequestConfig()
      );
      const user = response.data.user;

      const result = {
        username: user?.username ?? null,
        slug: user?.ids?.slug ?? null,
        displayName: user?.name ?? null,
        traktUserId: this.getStableProfileId(response.data),
      };
      this.accessTokenValidated = true;
      return result;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  public async findByTmdbId(
    mediaType: 'movie' | 'tv',
    tmdbId: number,
    signal?: AbortSignal
  ): Promise<number | null> {
    const resultType = mediaType === 'movie' ? 'movie' : 'show';

    try {
      const response = await this.apiHttp.get<TraktSearchResult[]>(
        `/search/tmdb/${tmdbId}`,
        this.apiRequestConfig({ params: { type: resultType }, signal })
      );
      const result = response.data.find((entry) => entry.type === resultType);

      return result?.[resultType]?.ids?.trakt ?? null;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  public async getWatchHistory(
    mediaType: 'movie' | 'tv',
    traktId: number,
    signal?: AbortSignal
  ): Promise<{ watchedAt: string } | null> {
    const pathType = mediaType === 'movie' ? 'movies' : 'shows';

    try {
      const response = await this.apiHttp.get<TraktHistoryEntry[]>(
        `/sync/history/${pathType}/${traktId}`,
        this.apiRequestConfig({ signal })
      );
      const watchedAt = response.data.reduce<string | null>((newest, entry) => {
        if (!entry.watched_at || Number.isNaN(Date.parse(entry.watched_at))) {
          return newest;
        }

        if (!newest || Date.parse(entry.watched_at) > Date.parse(newest)) {
          return entry.watched_at;
        }

        return newest;
      }, null);

      const result = watchedAt ? { watchedAt } : null;
      this.accessTokenValidated = true;
      return result;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  /**
   * Specials are requested because Seerr renders season 0 when enabled, but excluded from
   * the overall counts so they cannot make a season look incomplete.
   */
  public async getShowProgress(
    traktShowId: number,
    signal?: AbortSignal
  ): Promise<TraktSeasonProgress[]> {
    try {
      const response = await this.apiHttp.get<TraktShowProgressResponse>(
        `/shows/${traktShowId}/progress/watched`,
        this.apiRequestConfig({
          params: { specials: true, count_specials: false },
          signal,
        })
      );

      const seasons = (response.data.seasons ?? []).flatMap((season) =>
        typeof season.number === 'number'
          ? [
              {
                seasonNumber: season.number,
                airedEpisodes: season.aired ?? 0,
                watchedEpisodes: season.completed ?? 0,
                episodes: (season.episodes ?? []).flatMap((episode) =>
                  typeof episode.number === 'number'
                    ? [
                        {
                          episodeNumber: episode.number,
                          watched: episode.completed === true,
                        },
                      ]
                    : []
                ),
              },
            ]
          : []
      );
      this.accessTokenValidated = true;

      return seasons;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  public didValidateAccessToken(): boolean {
    return this.accessTokenValidated;
  }

  private toTokenSet(
    token: TraktTokenResponse,
    receiptTime: number
  ): TraktTokenSet {
    const createdAt = token.created_at ?? receiptTime / 1000;

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date((createdAt + token.expires_in) * 1000),
    };
  }

  /**
   * Keyed on `uuid` because Trakt users have no numeric `ids.trakt` and `ids.slug` follows
   * username changes.
   */
  private getStableProfileId(settings: TraktSettingsResponse): string {
    const uuid = settings.user?.ids?.uuid;

    if (typeof uuid !== 'string' || uuid.trim().length === 0) {
      throw new TraktApiError(
        'Trakt returned an invalid profile',
        0,
        'INVALID_RESPONSE'
      );
    }

    return uuid;
  }

  private apiRequestConfig(
    config: AxiosRequestConfig = {}
  ): AxiosRequestConfig {
    return {
      ...config,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'trakt-api-version': '2',
        'trakt-api-key': this.clientId,
        ...(this.accessToken
          ? { Authorization: `Bearer ${this.accessToken}` }
          : {}),
      },
    };
  }

  private toApiError(error: unknown): TraktApiError {
    if (error instanceof TraktApiError) {
      return error;
    }

    const response =
      typeof error === 'object' && error !== null && 'response' in error
        ? (error.response as {
            status?: unknown;
            headers?: unknown;
            data?: unknown;
          })
        : undefined;
    const status = typeof response?.status === 'number' ? response.status : 0;
    const data = response?.data;
    const oauthError =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : undefined;

    if (status === 401) {
      return new TraktApiError(
        'Trakt authentication failed',
        status,
        'UNAUTHORIZED',
        undefined,
        oauthError
      );
    }

    if (status === 429) {
      return new TraktApiError(
        'Trakt rate limit exceeded',
        status,
        'RATE_LIMITED',
        this.retryAfterSeconds(response?.headers)
      );
    }

    if (status >= 500 && status < 600) {
      return new TraktApiError(
        'Trakt service temporarily unavailable',
        status,
        'UPSTREAM_ERROR'
      );
    }

    if (status === 0) {
      return new TraktApiError(
        'Trakt network request failed',
        status,
        'NETWORK_ERROR'
      );
    }

    return new TraktApiError(
      'Trakt request failed',
      status,
      'REQUEST_FAILED',
      undefined,
      oauthError
    );
  }

  private retryAfterSeconds(headers: unknown): number | undefined {
    if (!headers || typeof headers !== 'object') {
      return undefined;
    }

    const typedHeaders = headers as {
      get?: (name: string) => unknown;
      ['retry-after']?: unknown;
      ['Retry-After']?: unknown;
    };
    const value =
      typedHeaders.get?.('retry-after') ??
      typedHeaders['retry-after'] ??
      typedHeaders['Retry-After'];

    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return Math.ceil(value);
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds);
    }

    const retryAt = Date.parse(value);
    return Number.isNaN(retryAt)
      ? undefined
      : Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
  }
}
