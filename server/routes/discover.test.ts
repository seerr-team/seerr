import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

import TheMovieDb from '@server/api/themoviedb';
import type { TmdbListResponse } from '@server/api/themoviedb/interfaces';
import { DiscoverSliderType } from '@server/constants/discover';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import cacheManager from '@server/lib/cache';
import { getMediaListPage, getMediaListProvider } from '@server/lib/medialists';
import type { MediaListProvider } from '@server/lib/medialists/types';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import discoverRoutes from './discover';
import discoverSettingRoutes from './settings/discover';

import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';

const MOVIE_ITEM = {
  id: 603,
  media_type: 'movie' as const,
  title: 'The Matrix',
  original_title: 'The Matrix',
  release_date: '1999-03-30',
  adult: false,
  video: false,
  popularity: 50,
  poster_path: '/poster-movie.jpg',
  backdrop_path: '/backdrop-movie.jpg',
  vote_count: 100,
  vote_average: 8.2,
  genre_ids: [28],
  overview: 'A hacker learns the truth.',
  original_language: 'en',
};

const TV_ITEM = {
  id: 14929,
  media_type: 'tv' as const,
  name: 'Heartland',
  original_name: 'Heartland',
  first_air_date: '2007-10-14',
  origin_country: ['CA'],
  popularity: 34,
  poster_path: '/poster-tv.jpg',
  backdrop_path: '/backdrop-tv.jpg',
  vote_count: 580,
  vote_average: 8.3,
  genre_ids: [18],
  overview: 'Life on a ranch.',
  original_language: 'en',
};

const listResponse = (
  overrides: Partial<TmdbListResponse> = {}
): TmdbListResponse => ({
  id: 8542986,
  name: 'My Mixed List',
  description: 'A list with both movies and series',
  item_count: 2,
  page: 1,
  total_pages: 1,
  total_results: 2,
  // TV first, so we can assert that the list order is preserved
  items: [TV_ITEM, MOVIE_ITEM],
  ...overrides,
});

const LIST_ID = '8542986';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // Keep an unhandled rejection from taking the test process down before the
  // assertion that awaits it runs.
  promise.catch(() => undefined);

  return { promise, resolve, reject };
};

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

const tmdbProvider = (): MediaListProvider => {
  const provider = getMediaListProvider('tmdb');
  assert.ok(provider);
  return provider;
};

const cachedListKeys = () => cacheManager.getCache('medialist').data.keys();

let getListMock: ReturnType<typeof mock.method>['mock'];
let app: Express;

function createApp(queryParser?: 'simple' | 'extended') {
  const app = express();

  if (queryParser) {
    app.set('query parser', queryParser);
  }

  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(checkUser);
  app.use('/auth', authRoutes);
  // Mirrors how the router mounts discover in production.
  app.use('/discover', isAuthenticated(), discoverRoutes);
  app.use('/settings/discover', discoverSettingRoutes);
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res
        .status(err.status ?? 500)
        .json({ status: err.status ?? 500, message: err.message });
    }
  );
  return app;
}

before(async () => {
  app = createApp();
  getListMock = mock.method(TheMovieDb.prototype, 'getList', async () =>
    listResponse()
  ).mock;
});

beforeEach(() => {
  getListMock.resetCalls();
  getListMock.mockImplementation(async () => listResponse());
  cacheManager.getCache('medialist').flush();
});

setupTestDb();

async function loginAsAdmin(target: Express = app) {
  const settings = getSettings();
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;

  try {
    const agent = request.agent(target);
    const res = await agent
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'test1234' });
    assert.strictEqual(res.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
}

describe('GET /discover/list/:listId', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get(`/discover/list/${LIST_ID}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(getListMock.callCount(), 0);
  });

  it('returns mixed movie/tv results in list order', async () => {
    const agent = await loginAsAdmin();
    const res = await agent.get(`/discover/list/${LIST_ID}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 2);
    assert.strictEqual(res.body.totalPages, 1);
    assert.strictEqual(res.body.list.providerId, 'tmdb');
    assert.strictEqual(res.body.list.listId, LIST_ID);
    assert.strictEqual(res.body.list.name, 'My Mixed List');
    assert.strictEqual(res.body.list.unavailable, undefined);

    assert.deepStrictEqual(
      res.body.results.map((r: { id: number; mediaType: string }) => [
        r.mediaType,
        r.id,
      ]),
      [
        ['tv', 14929],
        ['movie', 603],
      ]
    );
  });

  it('attaches local media info to results', async () => {
    await getRepository(Media).save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 603,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const agent = await loginAsAdmin();
    const res = await agent.get(`/discover/list/${LIST_ID}`);

    assert.strictEqual(res.status, 200);
    const movie = res.body.results.find(
      (r: { mediaType: string }) => r.mediaType === 'movie'
    );
    assert.strictEqual(movie.mediaInfo.status, MediaStatus.AVAILABLE);
  });

  it('rejects a malformed list id without contacting the provider', async () => {
    const agent = await loginAsAdmin();

    for (const listId of [
      'abc',
      '..%2F..%2Fetc',
      'http:%2F%2Fevil.test',
      '0',
      '1a',
      '1234567890123',
    ]) {
      const res = await agent.get(`/discover/list/${listId}`);
      assert.strictEqual(res.status, 400, `expected 400 for "${listId}"`);
    }

    assert.strictEqual(getListMock.callCount(), 0);
  });

  it('rejects a malformed page without contacting the provider', async () => {
    const agent = await loginAsAdmin();

    const queries = [
      'page=0',
      'page=-1',
      'page=1.5',
      'page=Infinity',
      'page=abc',
      'page=',
      'page=99999999999999999999',
      // Repeated keys make `req.query.page` an array under every query parser.
      'page=1&page=2',
    ];

    for (const query of queries) {
      const res = await agent.get(`/discover/list/${LIST_ID}?${query}`);
      assert.strictEqual(res.status, 400, `expected 400 for "${query}"`);
    }

    assert.strictEqual(getListMock.callCount(), 0);
  });

  it('rejects array and object page values under an extended query parser', async () => {
    const agent = await loginAsAdmin(createApp('extended'));

    for (const query of ['page[]=1', 'page[foo]=1']) {
      const res = await agent.get(`/discover/list/${LIST_ID}?${query}`);
      assert.strictEqual(res.status, 400, `expected 400 for "${query}"`);
    }

    assert.strictEqual(getListMock.callCount(), 0);
  });

  it('fetches only the requested page and reports upstream totals', async () => {
    getListMock.mockImplementation(async ({ page }: { page: number }) =>
      listResponse({
        page,
        item_count: 812,
        total_pages: 41,
        total_results: 812,
        items: [MOVIE_ITEM],
      })
    );

    const agent = await loginAsAdmin();
    const res = await agent.get(`/discover/list/${LIST_ID}?page=7`);

    assert.strictEqual(res.status, 200);
    // Totals come from the upstream response, not from a truncated array.
    assert.strictEqual(res.body.totalResults, 812);
    assert.strictEqual(res.body.totalPages, 41);
    assert.strictEqual(res.body.page, 7);

    assert.strictEqual(getListMock.callCount(), 1);
    assert.strictEqual(
      (getListMock.calls[0].arguments[0] as { page: number }).page,
      7
    );
  });

  it('caches each page separately and serves repeats from the cache', async () => {
    getListMock.mockImplementation(async ({ page }: { page: number }) =>
      listResponse({ page, total_pages: 3, total_results: 45 })
    );

    const agent = await loginAsAdmin();

    await agent.get(`/discover/list/${LIST_ID}?page=1`);
    await agent.get(`/discover/list/${LIST_ID}?page=2`);
    assert.strictEqual(getListMock.callCount(), 2);

    await agent.get(`/discover/list/${LIST_ID}?page=1`);
    await agent.get(`/discover/list/${LIST_ID}?page=2`);
    assert.strictEqual(getListMock.callCount(), 2);
    assert.strictEqual(cachedListKeys().length, 2);
  });

  it('does not fetch the whole list to serve one page', async () => {
    getListMock.mockImplementation(async ({ page }: { page: number }) =>
      listResponse({ page, total_pages: 100, total_results: 2000 })
    );

    const agent = await loginAsAdmin();
    await agent.get(`/discover/list/${LIST_ID}?page=1`);

    assert.strictEqual(getListMock.callCount(), 1);
  });

  it('reports an unavailable list without failing the page', async () => {
    getListMock.mockImplementation(async () => null);

    const agent = await loginAsAdmin();
    const res = await agent.get(`/discover/list/${LIST_ID}`);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.results, []);
    assert.strictEqual(res.body.totalResults, 0);
    assert.strictEqual(res.body.totalPages, 1);
    assert.strictEqual(res.body.list.unavailable, true);
  });

  it('returns 500 when the provider fails and nothing is cached', async () => {
    getListMock.mockImplementation(async () => {
      throw new Error('TMDB is down');
    });

    const agent = await loginAsAdmin();
    const res = await agent.get(`/discover/list/${LIST_ID}`);

    assert.strictEqual(res.status, 500);
  });
});

describe('media list caching', () => {
  const ageCacheEntry = (ms: number) => {
    const cache = cacheManager.getCache('medialist').data;
    const [cacheKey] = cache.keys();
    const entry = cache.get<{ fetchedAt: number }>(cacheKey);
    assert.ok(entry);
    cache.set(cacheKey, { ...entry, fetchedAt: Date.now() - ms });
    return cacheKey;
  };

  it('collapses concurrent requests into a single upstream fetch', async () => {
    const gate = createDeferred<TmdbListResponse>();
    getListMock.mockImplementation(async () => gate.promise);

    // Every caller is started before anything resolves, so the assertion below
    // can only hold if they genuinely share one in-flight fetch.
    const pending = [1, 2, 3].map(() =>
      getMediaListPage({ provider: tmdbProvider(), listId: LIST_ID })
    );

    await flushMicrotasks();
    assert.strictEqual(getListMock.callCount(), 1);

    gate.resolve(listResponse());
    const results = await Promise.all(pending);

    assert.strictEqual(getListMock.callCount(), 1);
    results.forEach((result) => assert.strictEqual(result.totalResults, 2));
  });

  it('drops a rejected in-flight fetch so the next request retries', async () => {
    const gate = createDeferred<TmdbListResponse>();
    getListMock.mockImplementation(async () => gate.promise);

    const failing = getMediaListPage({
      provider: tmdbProvider(),
      listId: LIST_ID,
    });

    await flushMicrotasks();
    gate.reject(new Error('TMDB is down'));
    await assert.rejects(failing);

    getListMock.mockImplementation(async () => listResponse());
    const retried = await getMediaListPage({
      provider: tmdbProvider(),
      listId: LIST_ID,
    });

    assert.strictEqual(retried.totalResults, 2);
    assert.strictEqual(getListMock.callCount(), 2);
  });

  it('refreshes and replaces the content once the entry is no longer fresh', async () => {
    const agent = await loginAsAdmin();

    const fresh = await agent.get(`/discover/list/${LIST_ID}`);
    assert.strictEqual(fresh.body.list.name, 'My Mixed List');

    ageCacheEntry(7 * 60 * 60 * 1000);

    getListMock.mockImplementation(async () =>
      listResponse({
        name: 'Renamed List',
        item_count: 1,
        total_results: 1,
        items: [MOVIE_ITEM],
      })
    );

    const refreshed = await agent.get(`/discover/list/${LIST_ID}`);
    assert.strictEqual(refreshed.body.list.name, 'Renamed List');
    assert.strictEqual(refreshed.body.totalResults, 1);
    assert.strictEqual(getListMock.callCount(), 2);
  });

  it('serves stale data when the provider fails after the entry goes stale', async () => {
    const agent = await loginAsAdmin();

    const fresh = await agent.get(`/discover/list/${LIST_ID}`);
    assert.strictEqual(fresh.body.totalResults, 2);

    ageCacheEntry(7 * 60 * 60 * 1000);

    getListMock.mockImplementation(async () => {
      throw new Error('TMDB is down');
    });

    const stale = await agent.get(`/discover/list/${LIST_ID}`);
    assert.strictEqual(stale.status, 200);
    assert.strictEqual(stale.body.totalResults, 2);
    assert.strictEqual(getListMock.callCount(), 2);
  });

  it('does not serve an entry that has outlived its residency window', async () => {
    const agent = await loginAsAdmin();
    await agent.get(`/discover/list/${LIST_ID}`);

    // Expire the entry the same way node-cache would once the 48h TTL elapses.
    const cache = cacheManager.getCache('medialist').data;
    const [cacheKey] = cache.keys();
    cache.set(cacheKey, cache.get(cacheKey), -1);
    assert.strictEqual(cache.get(cacheKey), undefined);

    getListMock.mockImplementation(async () => {
      throw new Error('TMDB is down');
    });

    const res = await agent.get(`/discover/list/${LIST_ID}`);
    assert.strictEqual(res.status, 500);
  });

  it('shares one failed refresh between concurrent stale callers', async () => {
    await getMediaListPage({ provider: tmdbProvider(), listId: LIST_ID });
    assert.strictEqual(getListMock.callCount(), 1);

    ageCacheEntry(7 * 60 * 60 * 1000);

    const gate = createDeferred<TmdbListResponse>();
    getListMock.mockImplementation(async () => gate.promise);

    const pending = [1, 2, 3].map(() =>
      getMediaListPage({ provider: tmdbProvider(), listId: LIST_ID })
    );

    await flushMicrotasks();
    assert.strictEqual(getListMock.callCount(), 2);

    gate.reject(new Error('TMDB is down'));
    const results = await Promise.all(pending);

    // One shared refresh, and every caller gets the stale copy.
    assert.strictEqual(getListMock.callCount(), 2);
    results.forEach((result) => assert.strictEqual(result.totalResults, 2));
  });
});

describe('media list payload validation', () => {
  const malformedPayloads: [string, Partial<TmdbListResponse>][] = [
    ['a null item', { items: [null] } as unknown as Partial<TmdbListResponse>],
    [
      'a non-array items field',
      { items: 'nope' } as unknown as Partial<TmdbListResponse>,
    ],
    [
      'an unsupported media_type',
      {
        items: [{ ...MOVIE_ITEM, media_type: 'person' }],
      } as unknown as Partial<TmdbListResponse>,
    ],
    [
      'a non-numeric item id',
      {
        items: [{ ...MOVIE_ITEM, id: '603' }],
      } as unknown as Partial<TmdbListResponse>,
    ],
    ['a missing page', { page: undefined }],
    [
      'non-numeric pagination fields',
      { total_pages: 'many' } as unknown as Partial<TmdbListResponse>,
    ],
  ];

  for (const [label, overrides] of malformedPayloads) {
    it(`returns 500 and caches nothing for ${label}`, async () => {
      getListMock.mockImplementation(async () => listResponse(overrides));

      const agent = await loginAsAdmin();
      const res = await agent.get(`/discover/list/${LIST_ID}`);

      assert.strictEqual(res.status, 500);
      assert.strictEqual(cachedListKeys().length, 0);
    });
  }

  it('serves the stale copy rather than a malformed refresh', async () => {
    const agent = await loginAsAdmin();

    const fresh = await agent.get(`/discover/list/${LIST_ID}`);
    assert.strictEqual(fresh.body.totalResults, 2);

    const cache = cacheManager.getCache('medialist').data;
    const [cacheKey] = cache.keys();
    const entry = cache.get<{ fetchedAt: number }>(cacheKey);
    assert.ok(entry);
    cache.set(cacheKey, {
      ...entry,
      fetchedAt: Date.now() - 7 * 60 * 60 * 1000,
    });

    getListMock.mockImplementation(async () =>
      listResponse({ items: [null] } as unknown as Partial<TmdbListResponse>)
    );

    const stale = await agent.get(`/discover/list/${LIST_ID}`);
    assert.strictEqual(stale.status, 200);
    assert.strictEqual(stale.body.totalResults, 2);
    assert.strictEqual(stale.body.results.length, 2);
  });
});

describe('TMDB list slider validation', () => {
  it('rejects a slider whose data is not a numeric list id', async () => {
    const agent = await loginAsAdmin();

    const res = await agent.post('/settings/discover/add').send({
      type: DiscoverSliderType.TMDB_LIST,
      title: 'Evil list',
      data: 'https://evil.test/list',
    });

    assert.strictEqual(res.status, 400);
  });

  it('accepts a slider with a numeric list id', async () => {
    const agent = await loginAsAdmin();

    const res = await agent.post('/settings/discover/add').send({
      type: DiscoverSliderType.TMDB_LIST,
      title: 'My list',
      data: LIST_ID,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data, LIST_ID);
  });

  it('rejects an invalid list id when updating an existing slider', async () => {
    const agent = await loginAsAdmin();

    const created = await agent.post('/settings/discover/add').send({
      type: DiscoverSliderType.TMDB_LIST,
      title: 'My list',
      data: LIST_ID,
    });
    assert.strictEqual(created.status, 200);

    const res = await agent.put(`/settings/discover/${created.body.id}`).send({
      type: DiscoverSliderType.TMDB_LIST,
      title: 'My list',
      data: 'not-a-list',
    });

    assert.strictEqual(res.status, 400);
  });

  it('leaves other slider types untouched', async () => {
    const agent = await loginAsAdmin();

    const res = await agent.post('/settings/discover/add').send({
      type: DiscoverSliderType.TMDB_SEARCH,
      title: 'Search',
      data: 'the matrix',
    });

    assert.strictEqual(res.status, 200);
  });
});
