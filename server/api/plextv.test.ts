import PlexTvAPI, { type PlexWatchlistCache } from '@server/api/plextv';
import cacheManager from '@server/lib/cache';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

function getAxios(api: PlexTvAPI): AxiosInstance {
  return (api as unknown as { axios: AxiosInstance }).axios;
}

function watchlistCache() {
  return cacheManager.getCache('plexwatchlist').data;
}

describe('PlexTvAPI getWatchlist', () => {
  afterEach(() => {
    mock.restoreAll();
    cacheManager.getCache('plexwatchlist').flush();
    cacheManager.getCache('plextv').flush();
  });

  it('does not cache or crash on a 2xx body without MediaContainer', async () => {
    const api = new PlexTvAPI('token-empty');
    mock.method(getAxios(api), 'get', async () => ({
      status: 200,
      headers: { etag: '"poison"' },
      data: { errors: [{ code: 1001, message: 'Unavailable' }] },
    }));

    const result = await api.getWatchlist();

    assert.deepEqual(result, {
      offset: 0,
      size: 20,
      totalSize: 0,
      items: [],
    });
    assert.equal(watchlistCache().get('token-empty'), undefined);
  });

  it('keeps a valid cached watchlist when Discover returns a 2xx without MediaContainer', async () => {
    const api = new PlexTvAPI('token-stale');
    watchlistCache().set<PlexWatchlistCache>('token-stale', {
      etag: '"good"',
      response: {
        MediaContainer: { totalSize: 4, Metadata: [] },
      },
    });
    mock.method(getAxios(api), 'get', async () => ({
      status: 200,
      headers: { etag: '"poison"' },
      data: '<html>error</html>',
    }));

    const result = await api.getWatchlist();

    assert.equal(result.totalSize, 4);
    assert.equal(
      watchlistCache().get<PlexWatchlistCache>('token-stale')?.etag,
      '"good"'
    );
  });

  it('drops a poisoned cache entry and does not send If-None-Match', async () => {
    const api = new PlexTvAPI('token-poisoned');
    watchlistCache().set('token-poisoned', {
      etag: '"bad"',
      response: { errors: ['nope'] },
    });

    let requestConfig: AxiosRequestConfig | undefined;
    mock.method(
      getAxios(api),
      'get',
      async (_url: string, config?: AxiosRequestConfig) => {
        requestConfig = config;
        return {
          status: 200,
          headers: { etag: '"fresh"' },
          data: { MediaContainer: { totalSize: 0 } },
        };
      }
    );

    const result = await api.getWatchlist();

    assert.equal(result.totalSize, 0);
    assert.equal(requestConfig?.headers?.['If-None-Match'], undefined);
    assert.equal(
      watchlistCache().get<PlexWatchlistCache>('token-poisoned')?.etag,
      '"fresh"'
    );
  });

  it('does not cache a 2xx body whose MediaContainer is an array', async () => {
    const api = new PlexTvAPI('token-array');
    mock.method(getAxios(api), 'get', async () => ({
      status: 200,
      headers: { etag: '"array"' },
      data: { MediaContainer: [] },
    }));

    const result = await api.getWatchlist();

    assert.deepEqual(result, {
      offset: 0,
      size: 20,
      totalSize: 0,
      items: [],
    });
    assert.equal(watchlistCache().get('token-array'), undefined);
  });

  it('does not cache a 2xx body whose totalSize is not a number', async () => {
    const api = new PlexTvAPI('token-bad-size');
    mock.method(getAxios(api), 'get', async () => ({
      status: 200,
      headers: { etag: '"bad-size"' },
      data: { MediaContainer: { totalSize: 'invalid' } },
    }));

    const result = await api.getWatchlist();

    assert.deepEqual(result, {
      offset: 0,
      size: 20,
      totalSize: 0,
      items: [],
    });
    assert.equal(watchlistCache().get('token-bad-size'), undefined);
  });

  it('returns an empty watchlist when the watchlist fetch fails', async () => {
    const api = new PlexTvAPI('token-fetch-error');
    mock.method(getAxios(api), 'get', async () => {
      throw new Error('network down');
    });

    const result = await api.getWatchlist();

    assert.deepEqual(result, {
      offset: 0,
      size: 20,
      totalSize: 0,
      items: [],
    });
  });

  it('propagates cache manager failures instead of returning an empty watchlist', async () => {
    const api = new PlexTvAPI('token-cache-error');
    const cacheError = new Error('cache unavailable');
    mock.method(cacheManager, 'getCache', () => {
      throw cacheError;
    });

    await assert.rejects(() => api.getWatchlist(), cacheError);
  });

  it('skips items whose metadata request returns 404', async () => {
    const api = new PlexTvAPI('token-404');
    mock.method(getAxios(api), 'get', async (url: string) => {
      if (url === '/library/sections/watchlist/all') {
        return {
          status: 200,
          headers: { etag: '"fresh"' },
          data: {
            MediaContainer: { totalSize: 1, Metadata: [{ ratingKey: 'abc' }] },
          },
        };
      }

      if (url === '/library/metadata/abc') {
        throw Object.assign(new Error('not found'), {
          response: { status: 404 },
        });
      }

      throw new Error(`unexpected url: ${url}`);
    });

    const result = await api.getWatchlist();

    assert.deepEqual(result, {
      offset: 0,
      size: 20,
      totalSize: 1,
      items: [],
    });
  });

  it('skips items whose metadata response contains no metadata', async () => {
    const api = new PlexTvAPI('token-no-meta');
    mock.method(getAxios(api), 'get', async (url: string) => {
      if (url === '/library/sections/watchlist/all') {
        return {
          status: 200,
          headers: { etag: '"fresh"' },
          data: {
            MediaContainer: {
              totalSize: 2,
              Metadata: [{ ratingKey: 'empty' }, { ratingKey: 'good' }],
            },
          },
        };
      }

      if (url === '/library/metadata/empty') {
        return { status: 200, data: { MediaContainer: {} } };
      }

      if (url === '/library/metadata/good') {
        return {
          status: 200,
          data: {
            MediaContainer: {
              Metadata: [
                {
                  ratingKey: 'good',
                  type: 'movie',
                  title: 'Good Movie',
                  Guid: [{ id: 'tmdb://550' }],
                },
              ],
            },
          },
        };
      }

      throw new Error(`unexpected url: ${url}`);
    });

    const result = await api.getWatchlist();

    assert.deepEqual(result, {
      offset: 0,
      size: 20,
      totalSize: 2,
      items: [
        {
          ratingKey: 'good',
          tmdbId: 550,
          tvdbId: undefined,
          title: 'Good Movie',
          type: 'movie',
        },
      ],
    });
  });

  it('propagates non-404 errors from metadata resolution', async () => {
    const api = new PlexTvAPI('token-500');
    mock.method(getAxios(api), 'get', async (url: string) => {
      if (url === '/library/sections/watchlist/all') {
        return {
          status: 200,
          headers: { etag: '"fresh"' },
          data: {
            MediaContainer: { totalSize: 1, Metadata: [{ ratingKey: 'abc' }] },
          },
        };
      }

      if (url === '/library/metadata/abc') {
        throw Object.assign(new Error('upstream'), {
          response: { status: 500 },
        });
      }

      throw new Error(`unexpected url: ${url}`);
    });

    await assert.rejects(
      () => api.getWatchlist(),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 500
    );
  });
});
