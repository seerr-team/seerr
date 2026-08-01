import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import axios, { type AxiosInstance } from 'axios';

import TraktAPI, { TraktApiError, type TraktProfile } from '@server/api/trakt';
import { getSettings } from '@server/lib/settings';
import { requireTraktCallbackUrl } from '@server/lib/trakt/config';

getSettings().main.applicationUrl = 'https://requests.example.com';

const CLIENT_ID = 'client-id';
const CLIENT_SECRET = 'client-secret';
const ACCESS_TOKEN = 'access-token';

function buildClient(accessToken = ACCESS_TOKEN): {
  client: TraktAPI;
  authHttp: AxiosInstance;
  apiHttp: AxiosInstance;
} {
  const authHttp = axios.create();
  const apiHttp = axios.create();

  return {
    client: new TraktAPI(
      CLIENT_ID,
      CLIENT_SECRET,
      accessToken,
      authHttp,
      apiHttp
    ),
    authHttp,
    apiHttp,
  };
}

function assertApiRequest(config: unknown, signal?: AbortSignal): void {
  const request = config as {
    headers?: Record<string, string>;
    timeout?: number;
    signal?: AbortSignal;
  };

  assert.equal(request.timeout, 10_000);
  assert.deepEqual(request.headers, {
    'trakt-api-version': '2',
    'trakt-api-key': CLIENT_ID,
    Authorization: `Bearer ${ACCESS_TOKEN}`,
  });
  assert.equal(request.signal, signal);
}

describe('TraktAPI OAuth protocol', () => {
  it('builds the authorization URL with the required auth host and parameters', () => {
    const { client } = buildClient();

    const authorizationUrl = client.buildAuthorizationUrl('opaque-state');
    const parsed = new URL(authorizationUrl);

    assert.equal(parsed.origin, 'https://auth.trakt.tv');
    assert.equal(parsed.pathname, '/oauth/authorize');
    assert.equal(parsed.searchParams.get('response_type'), 'code');
    assert.equal(parsed.searchParams.get('client_id'), CLIENT_ID);
    assert.equal(
      parsed.searchParams.get('redirect_uri'),
      requireTraktCallbackUrl()
    );
    assert.equal(parsed.searchParams.get('state'), 'opaque-state');
    assert.equal(parsed.searchParams.get('prompt'), 'login');
  });

  it('exchanges an authorization code at the auth host with the exact OAuth body', async () => {
    const { client, authHttp } = buildClient();
    const post = mock.method(authHttp, 'post', async () => ({
      data: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        created_at: 1_700_000_000,
        expires_in: 3600,
      },
    }));

    const tokenSet = await client.exchangeCode('authorization-code');

    assert.deepEqual(tokenSet, {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: new Date(1_700_003_600_000),
    });
    assert.deepEqual(post.mock.calls[0].arguments, [
      'https://auth.trakt.tv/oauth/token',
      {
        code: 'authorization-code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: requireTraktCallbackUrl(),
        grant_type: 'authorization_code',
      },
      { timeout: 10_000 },
    ]);
  });

  it('uses code-exchange response receipt time when created_at is absent', async () => {
    const { client, authHttp } = buildClient();
    let now = 1_000;
    mock.method(Date, 'now', () => now);
    mock.method(authHttp, 'post', async () => {
      now = 2_000;

      return {
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 60,
        },
      };
    });

    try {
      const tokenSet = await client.exchangeCode('authorization-code');

      assert.equal(tokenSet.expiresAt.getTime(), 62_000);
    } finally {
      mock.restoreAll();
    }
  });

  it('uses refresh response receipt time when created_at is absent', async () => {
    const { client, authHttp } = buildClient();
    let now = 1_000;
    mock.method(Date, 'now', () => now);
    mock.method(authHttp, 'post', async () => {
      now = 2_000;

      return {
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 60,
        },
      };
    });

    try {
      const tokenSet = await client.refresh('refresh-token');

      assert.equal(tokenSet.expiresAt.getTime(), 62_000);
    } finally {
      mock.restoreAll();
    }
  });

  it('refreshes a token at the auth host with the exact OAuth body', async () => {
    const { client, authHttp } = buildClient();
    const post = mock.method(authHttp, 'post', async () => ({
      data: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        created_at: 1_700_000_000,
        expires_in: 3600,
      },
    }));

    await client.refresh('refresh-token');

    assert.deepEqual(post.mock.calls[0].arguments, [
      'https://auth.trakt.tv/oauth/token',
      {
        refresh_token: 'refresh-token',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: requireTraktCallbackUrl(),
        grant_type: 'refresh_token',
      },
      { timeout: 10_000 },
    ]);
  });

  it('revokes a token at the auth host', async () => {
    const { client, authHttp } = buildClient();
    const post = mock.method(authHttp, 'post', async () => ({}));

    await client.revoke('access-token-to-revoke');

    assert.deepEqual(post.mock.calls[0].arguments, [
      'https://auth.trakt.tv/oauth/revoke',
      {
        token: 'access-token-to-revoke',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
      { timeout: 10_000 },
    ]);
  });
});

describe('TraktAPI API protocol', () => {
  it('gets the stable profile identity from the API host', async () => {
    const { client, apiHttp } = buildClient();
    const get = mock.method(apiHttp, 'get', async () => ({
      data: {
        user: {
          username: 'mutable-username',
          name: 'Mutable display name',
          ids: {
            slug: 'mutable-slug',
            uuid: '4ceb2f68-1f8a-4f4a-9b1e-1c8a6b2f4d3e',
          },
        },
      },
    }));

    assert.equal(client.didValidateAccessToken(), false);
    const profile: TraktProfile = await client.getProfile();

    assert.deepEqual(profile, {
      username: 'mutable-username',
      slug: 'mutable-slug',
      displayName: 'Mutable display name',
      traktUserId: '4ceb2f68-1f8a-4f4a-9b1e-1c8a6b2f4d3e',
    });
    assert.equal(get.mock.calls[0]!.arguments[0], '/users/settings');
    assertApiRequest(get.mock.calls[0]!.arguments[1]);
    assert.equal(client.didValidateAccessToken(), true);
  });

  it('rejects a profile without a stable Trakt ID', async () => {
    const { client, apiHttp } = buildClient();
    mock.method(apiHttp, 'get', async () => ({
      data: { user: { name: 'secret display name', ids: { slug: 'a-slug' } } },
    }));

    await assert.rejects(
      () => client.getProfile(),
      (error: unknown) => {
        assert.ok(error instanceof TraktApiError);
        const traktError = error as TraktApiError;
        assert.equal(traktError.status, 0);
        assert.equal(traktError.code, 'INVALID_RESPONSE');
        assert.equal(traktError.message.includes('secret'), false);
        return true;
      }
    );
  });

  it('rejects a profile with an invalid stable Trakt ID', async () => {
    const { client, apiHttp } = buildClient();
    mock.method(apiHttp, 'get', async () => ({
      data: {
        user: {
          name: 'secret display name',
          ids: { slug: 'a-slug', uuid: '' },
        },
      },
    }));

    await assert.rejects(
      () => client.getProfile(),
      (error: unknown) => {
        assert.ok(error instanceof TraktApiError);
        const traktError = error as TraktApiError;
        assert.equal(traktError.status, 0);
        assert.equal(traktError.code, 'INVALID_RESPONSE');
        assert.equal(traktError.message.includes('secret'), false);
        return true;
      }
    );
  });

  it('maps movies by TMDB ID using only the movie result ID', async () => {
    const { client, apiHttp } = buildClient();
    const controller = new AbortController();
    const get = mock.method(apiHttp, 'get', async () => ({
      data: [
        { type: 'show', show: { ids: { trakt: 100 } } },
        { type: 'movie', movie: { ids: { trakt: 200 } } },
      ],
    }));

    assert.equal(
      await client.findByTmdbId('movie', 99, controller.signal),
      200
    );
    assert.equal(get.mock.calls[0]!.arguments[0], '/search/tmdb/99');
    assert.deepEqual(get.mock.calls[0]!.arguments[1]?.params, {
      type: 'movie',
    });
    assertApiRequest(get.mock.calls[0]!.arguments[1], controller.signal);
    assert.equal(client.didValidateAccessToken(), false);
  });

  it('maps TV by TMDB ID using only the show result ID', async () => {
    const { client, apiHttp } = buildClient();
    const get = mock.method(apiHttp, 'get', async () => ({
      data: [
        { type: 'movie', movie: { ids: { trakt: 100 } } },
        { type: 'show', show: { ids: { trakt: 300 } } },
      ],
    }));

    assert.equal(await client.findByTmdbId('tv', 99), 300);
    assert.equal(get.mock.calls[0]!.arguments[0], '/search/tmdb/99');
    assert.deepEqual(get.mock.calls[0]!.arguments[1]?.params, { type: 'show' });
    assertApiRequest(get.mock.calls[0]!.arguments[1]);
  });

  it('returns null when TMDB search has no matching typed result', async () => {
    const { client, apiHttp } = buildClient();
    mock.method(apiHttp, 'get', async () => ({
      data: [{ type: 'show', show: { ids: { trakt: 100 } } }],
    }));

    assert.equal(await client.findByTmdbId('movie', 99), null);
  });

  it('returns the newest valid movie watch timestamp', async () => {
    const { client, apiHttp } = buildClient();
    const get = mock.method(apiHttp, 'get', async () => ({
      data: [
        { watched_at: 'not-a-date' },
        { watched_at: '2024-01-01T00:00:00.000Z' },
        { watched_at: '2025-02-03T04:05:06.000Z' },
      ],
    }));

    assert.deepEqual(await client.getWatchHistory('movie', 123), {
      watchedAt: '2025-02-03T04:05:06.000Z',
    });
    assert.equal(get.mock.calls[0]!.arguments[0], '/sync/history/movies/123');
    assertApiRequest(get.mock.calls[0]!.arguments[1]);
    assert.equal(client.didValidateAccessToken(), true);
  });

  it('uses the show history endpoint and maps empty history to not watched', async () => {
    const { client, apiHttp } = buildClient();
    const get = mock.method(apiHttp, 'get', async () => ({ data: [] }));

    assert.equal(await client.getWatchHistory('tv', 456), null);
    assert.equal(get.mock.calls[0]!.arguments[0], '/sync/history/shows/456');
    assertApiRequest(get.mock.calls[0]!.arguments[1]);
  });
});

describe('TraktAPI errors', () => {
  it('converts unauthorized, rate-limited, temporary, and network failures without exposing response bodies', async () => {
    const { client, apiHttp } = buildClient();
    const failures = [
      {
        error: { response: { status: 401, data: { token: 'secret' } } },
        status: 401,
        code: 'UNAUTHORIZED',
        retryAfterSeconds: undefined,
      },
      {
        error: {
          response: {
            status: 429,
            headers: { 'retry-after': '17' },
            data: { token: 'secret' },
          },
        },
        status: 429,
        code: 'RATE_LIMITED',
        retryAfterSeconds: 17,
      },
      {
        error: { response: { status: 503, data: { token: 'secret' } } },
        status: 503,
        code: 'UPSTREAM_ERROR',
        retryAfterSeconds: undefined,
      },
      {
        error: { message: 'socket failed with token secret' },
        status: 0,
        code: 'NETWORK_ERROR',
        retryAfterSeconds: undefined,
      },
    ];

    for (const failure of failures) {
      mock.method(apiHttp, 'get', async () => {
        throw failure.error;
      });

      await assert.rejects(
        () => client.getProfile(),
        (error: unknown) => {
          assert.ok(error instanceof TraktApiError);
          const traktError = error as TraktApiError;
          assert.equal(traktError.status, failure.status);
          assert.equal(traktError.code, failure.code);
          assert.equal(traktError.retryAfterSeconds, failure.retryAfterSeconds);
          assert.equal(traktError.message.includes('secret'), false);
          return true;
        }
      );
      mock.restoreAll();
    }
  });
});
