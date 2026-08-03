import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

import TheMovieDb from '@server/api/themoviedb';
import type { TmdbListResponse } from '@server/api/themoviedb/interfaces';
import { DiscoverSliderType } from '@server/constants/discover';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import cacheManager from '@server/lib/cache';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import discoverRoutes from './discover';
import discoverSettingRoutes from './settings/discover';

import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';

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

let getListMock: ReturnType<typeof mock.method>['mock'];
let app: Express;

function createApp() {
  const app = express();
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
  app.use('/discover', discoverRoutes);
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

async function loginAsAdmin() {
  const settings = getSettings();
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;

  try {
    const agent = request.agent(app);
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
  it('returns mixed movie/tv results in list order', async () => {
    const agent = await loginAsAdmin();
    const res = await agent.get('/discover/list/8542986');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 2);
    assert.strictEqual(res.body.totalPages, 1);
    assert.strictEqual(res.body.list.providerId, 'tmdb');
    assert.strictEqual(res.body.list.listId, '8542986');
    assert.strictEqual(res.body.list.name, 'My Mixed List');

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
    const res = await agent.get('/discover/list/8542986');

    assert.strictEqual(res.status, 200);
    const movie = res.body.results.find(
      (r: { mediaType: string }) => r.mediaType === 'movie'
    );
    assert.strictEqual(movie.mediaInfo.status, MediaStatus.AVAILABLE);
  });

  it('rejects a non-numeric list id without contacting the provider', async () => {
    const agent = await loginAsAdmin();

    for (const listId of [
      'abc',
      '..%2F..%2Fetc',
      'http:%2F%2Fevil.test',
      '0',
      '1a',
    ]) {
      const res = await agent.get(`/discover/list/${listId}`);
      assert.strictEqual(res.status, 400, `expected 400 for "${listId}"`);
    }

    assert.strictEqual(getListMock.callCount(), 0);
  });

  it('paginates a long list without refetching it', async () => {
    const items = Array.from({ length: 45 }, (_, i) => ({
      ...MOVIE_ITEM,
      id: 1000 + i,
    }));

    getListMock.mockImplementation(async ({ page }: { page: number }) => {
      const start = (page - 1) * 20;
      return listResponse({
        item_count: items.length,
        total_pages: 3,
        total_results: items.length,
        page,
        items: items.slice(start, start + 20),
      });
    });

    const agent = await loginAsAdmin();

    const first = await agent.get('/discover/list/8542986?page=1');
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.totalResults, 45);
    assert.strictEqual(first.body.totalPages, 3);
    assert.strictEqual(first.body.results.length, 20);
    assert.strictEqual(first.body.results[0].id, 1000);

    // The provider is paged through once to build the cached list
    const callsAfterFirstRequest = getListMock.callCount();
    assert.strictEqual(callsAfterFirstRequest, 3);

    const third = await agent.get('/discover/list/8542986?page=3');
    assert.strictEqual(third.status, 200);
    assert.strictEqual(third.body.results.length, 5);
    assert.strictEqual(third.body.results[0].id, 1040);

    // Subsequent pages are served from the cache
    assert.strictEqual(getListMock.callCount(), callsAfterFirstRequest);
  });

  it('serves repeat requests from the cache', async () => {
    const agent = await loginAsAdmin();

    await agent.get('/discover/list/8542986');
    assert.strictEqual(getListMock.callCount(), 1);

    await agent.get('/discover/list/8542986');
    assert.strictEqual(getListMock.callCount(), 1);
  });

  it('collapses concurrent requests into a single upstream fetch', async () => {
    const agent = await loginAsAdmin();

    const [a, b, c] = await Promise.all([
      agent.get('/discover/list/8542986'),
      agent.get('/discover/list/8542986'),
      agent.get('/discover/list/8542986'),
    ]);

    assert.strictEqual(a.status, 200);
    assert.strictEqual(b.status, 200);
    assert.strictEqual(c.status, 200);
    assert.strictEqual(getListMock.callCount(), 1);
  });

  it('renders empty and does not crash when the list is missing or private', async () => {
    getListMock.mockImplementation(async () => null);

    const agent = await loginAsAdmin();
    const res = await agent.get('/discover/list/8542986');

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.results, []);
    assert.strictEqual(res.body.totalResults, 0);
    assert.strictEqual(res.body.totalPages, 1);
  });

  it('serves stale data when the provider fails after the entry goes stale', async () => {
    const agent = await loginAsAdmin();

    const fresh = await agent.get('/discover/list/8542986');
    assert.strictEqual(fresh.body.totalResults, 2);

    // Age the cache entry past the 6 hour freshness window
    const cache = cacheManager.getCache('medialist').data;
    const [cacheKey] = cache.keys();
    const entry = cache.get<{ fetchedAt: number }>(cacheKey);
    assert.ok(entry);
    cache.set(cacheKey, {
      ...entry,
      fetchedAt: Date.now() - 7 * 60 * 60 * 1000,
    });

    getListMock.mockImplementation(async () => {
      throw new Error('TMDB is down');
    });

    const stale = await agent.get('/discover/list/8542986');
    assert.strictEqual(stale.status, 200);
    assert.strictEqual(stale.body.totalResults, 2);
    assert.strictEqual(getListMock.callCount(), 2);
  });

  it('returns 500 when the provider fails and nothing is cached', async () => {
    getListMock.mockImplementation(async () => {
      throw new Error('TMDB is down');
    });

    const agent = await loginAsAdmin();
    const res = await agent.get('/discover/list/8542986');

    assert.strictEqual(res.status, 500);
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
      data: '8542986',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data, '8542986');
  });

  it('rejects an invalid list id when updating an existing slider', async () => {
    const agent = await loginAsAdmin();

    const created = await agent.post('/settings/discover/add').send({
      type: DiscoverSliderType.TMDB_LIST,
      title: 'My list',
      data: '8542986',
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
