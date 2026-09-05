import PlexTvAPI, { WATCHLIST_METADATA_CONCURRENCY } from '@server/api/plextv';
import cacheManager from '@server/lib/cache';
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

class TestPlexTvAPI extends PlexTvAPI {
  public installAdapter(adapter: AxiosAdapter): void {
    this.axios.defaults.adapter = adapter;
  }
}

function axiosResponse<T>(
  config: InternalAxiosRequestConfig,
  data: T,
  headers: Record<string, string> = {}
): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers,
    config,
    request: {},
  };
}

function watchlistResponse(count: number) {
  return {
    MediaContainer: {
      totalSize: count,
      Metadata: Array.from({ length: count }, (_, index) => ({
        ratingKey: `rk-${index + 1}`,
      })),
    },
  };
}

function metadataResponse(ratingKey: string) {
  const id = ratingKey.replace('rk-', '');

  return {
    MediaContainer: {
      Metadata: [
        {
          ratingKey,
          type: 'movie' as const,
          title: `Movie ${id}`,
          Guid: [{ id: `tmdb://${id}` as const }],
        },
      ],
    },
  };
}

function isMetadataRequest(url: string | undefined): boolean {
  return !!url?.includes('/library/metadata/');
}

function isWatchlistRequest(url: string | undefined): boolean {
  return !!url?.includes('/library/sections/watchlist/all');
}

describe('PlexTvAPI.getWatchlist metadata fetching', () => {
  beforeEach(() => {
    cacheManager.getCache('plexwatchlist').flush();
    cacheManager.getCache('plextv').flush();
  });

  afterEach(() => {
    cacheManager.getCache('plexwatchlist').flush();
    cacheManager.getCache('plextv').flush();
  });

  it('limits concurrent metadata requests', async () => {
    const itemCount = 12;
    let inFlight = 0;
    let maxInFlight = 0;

    const api = new TestPlexTvAPI('test-token');
    api.installAdapter(async (config) => {
      const url = config.url;

      if (isWatchlistRequest(url)) {
        return axiosResponse(config, watchlistResponse(itemCount), {
          etag: 'test-etag',
        });
      }

      if (isMetadataRequest(url)) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight--;

        const ratingKey = url?.split('/library/metadata/')[1] ?? '';
        return axiosResponse(config, metadataResponse(ratingKey));
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const result = await api.getWatchlist({ size: itemCount });

    assert.strictEqual(result.items.length, itemCount);
    assert.ok(
      maxInFlight <= WATCHLIST_METADATA_CONCURRENCY,
      `expected at most ${WATCHLIST_METADATA_CONCURRENCY} concurrent metadata requests, saw ${maxInFlight}`
    );
  });

  it('returns partial results when individual metadata requests fail', async () => {
    const itemCount = 8;

    const api = new TestPlexTvAPI('test-token');
    api.installAdapter(async (config) => {
      const url = config.url;

      if (isWatchlistRequest(url)) {
        return axiosResponse(config, watchlistResponse(itemCount), {
          etag: 'test-etag',
        });
      }

      if (isMetadataRequest(url)) {
        const ratingKey = url?.split('/library/metadata/')[1] ?? '';

        if (Number(ratingKey.replace('rk-', '')) % 2 === 0) {
          const error = new Error('connect ETIMEDOUT') as Error & {
            code: string;
          };
          error.code = 'ETIMEDOUT';
          throw error;
        }

        return axiosResponse(config, metadataResponse(ratingKey));
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const result = await api.getWatchlist({ size: itemCount });

    assert.strictEqual(result.items.length, 4);
    assert.ok(
      result.items.every((item) => Number(item.tmdbId) % 2 === 1),
      'only odd-numbered watchlist items should be returned'
    );
  });
});
