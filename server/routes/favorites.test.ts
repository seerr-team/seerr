import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';

import TheMovieDb from '@server/api/themoviedb';
import type { TmdbMovieDetails } from '@server/api/themoviedb/interfaces';
import { getRepository } from '@server/datasource';
import { Favorites } from '@server/entity/Favorites';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import favoritesRoutes from './favorites';

// Mock TMDB to avoid real network calls
let getMovieImpl: () => Promise<Partial<TmdbMovieDetails>> = async () =>
  fakeTmdbMovie(550);

Object.defineProperty(TheMovieDb.prototype, 'getMovie', {
  set() {},
  get() {
    return async () => getMovieImpl();
  },
  configurable: true,
});

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  set() {},
  get() {
    return async () => ({ id: 1399, external_ids: { tvdb_id: 121361 } });
  },
  configurable: true,
});

function fakeTmdbMovie(id: number): Partial<TmdbMovieDetails> {
  return { id, external_ids: { imdb_id: 'tt0137523' } };
}

let app: Express;

function createApp() {
  const a = express();
  a.use(express.json());
  a.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  a.use(checkUser);
  a.use('/auth', authRoutes);
  a.use('/favorites', favoritesRoutes);
  a.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res.status(err.status ?? 500).json({ status: err.status ?? 500, message: err.message });
    }
  );
  return a;
}

before(async () => {
  app = createApp();
});

setupTestDb();

async function authenticatedAgent(email: string, password: string) {
  const agent = request.agent(app);
  const settings = getSettings();
  settings.main.localLogin = true;
  const res = await agent.post('/auth/local').send({ email, password });
  assert.strictEqual(res.status, 200);
  return agent;
}

// ---------------------------------------------------------------------------
// GET /favorites
// ---------------------------------------------------------------------------

describe('GET /favorites', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/favorites');
    assert.strictEqual(res.status, 401);
  });

  it('returns an empty list when the user has no favorites', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');
    const res = await agent.get('/favorites');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 0);
    assert.deepStrictEqual(res.body.results, []);
    assert.strictEqual(res.body.page, 1);
  });

  it('returns added favorites', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    await agent.post('/favorites').send({ tmdbId: 550, mediaType: 'movie', title: 'Fight Club' });

    const res = await agent.get('/favorites');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 1);
    assert.strictEqual(res.body.results[0].tmdbId, 550);
  });

  it('respects the take parameter', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    getMovieImpl = async () => fakeTmdbMovie(1);
    await agent.post('/favorites').send({ tmdbId: 1, mediaType: 'movie' });
    getMovieImpl = async () => fakeTmdbMovie(2);
    await agent.post('/favorites').send({ tmdbId: 2, mediaType: 'movie' });
    getMovieImpl = async () => fakeTmdbMovie(3);
    await agent.post('/favorites').send({ tmdbId: 3, mediaType: 'movie' });

    const res = await agent.get('/favorites?take=2');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.results.length, 2);
    assert.strictEqual(res.body.totalResults, 3);
    assert.strictEqual(res.body.totalPages, 2);
  });

  it('only returns the authenticated user\'s own favorites', async () => {
    const admin = await authenticatedAgent('admin@seerr.dev', 'test1234');
    const friend = await authenticatedAgent('friend@seerr.dev', 'test1234');

    getMovieImpl = async () => fakeTmdbMovie(550);
    await admin.post('/favorites').send({ tmdbId: 550, mediaType: 'movie' });

    const res = await friend.get('/favorites');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 0);
  });
});

// ---------------------------------------------------------------------------
// POST /favorites
// ---------------------------------------------------------------------------

describe('POST /favorites', () => {
  beforeEach(() => {
    getMovieImpl = async () => fakeTmdbMovie(550);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/favorites')
      .send({ tmdbId: 550, mediaType: 'movie' });
    assert.strictEqual(res.status, 401);
  });

  it('adds a movie favorite and returns 201', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const res = await agent
      .post('/favorites')
      .send({ tmdbId: 550, mediaType: 'movie', title: 'Fight Club' });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.tmdbId, 550);
    assert.strictEqual(res.body.mediaType, 'movie');
  });

  it('adds a tv favorite and returns 201', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const res = await agent
      .post('/favorites')
      .send({ tmdbId: 1399, mediaType: 'tv', title: 'Game of Thrones' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.tmdbId, 1399);
    assert.strictEqual(res.body.mediaType, 'tv');
  });

  it('returns 409 when the same item is added twice', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    await agent.post('/favorites').send({ tmdbId: 550, mediaType: 'movie' });
    const res = await agent.post('/favorites').send({ tmdbId: 550, mediaType: 'movie' });

    assert.strictEqual(res.status, 409);
  });

  it('allows different users to favorite the same item', async () => {
    const admin = await authenticatedAgent('admin@seerr.dev', 'test1234');
    const friend = await authenticatedAgent('friend@seerr.dev', 'test1234');

    const res1 = await admin.post('/favorites').send({ tmdbId: 550, mediaType: 'movie' });
    const res2 = await friend.post('/favorites').send({ tmdbId: 550, mediaType: 'movie' });

    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res2.status, 201);
  });

  it('returns 400 when tmdbId is missing', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');
    const res = await agent.post('/favorites').send({ mediaType: 'movie' });
    assert.strictEqual(res.status, 400);
  });

  it('returns 400 when mediaType is missing', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');
    const res = await agent.post('/favorites').send({ tmdbId: 550 });
    assert.strictEqual(res.status, 400);
  });

  it('returns 400 when mediaType is invalid', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');
    const res = await agent.post('/favorites').send({ tmdbId: 550, mediaType: 'book' });
    assert.strictEqual(res.status, 400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /favorites/:tmdbId
// ---------------------------------------------------------------------------

describe('DELETE /favorites/:tmdbId', () => {
  beforeEach(() => {
    getMovieImpl = async () => fakeTmdbMovie(550);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).delete('/favorites/550?mediaType=movie');
    assert.strictEqual(res.status, 401);
  });

  it('deletes a favorite and returns 204', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    await agent.post('/favorites').send({ tmdbId: 550, mediaType: 'movie' });

    const res = await agent.delete('/favorites/550?mediaType=movie');
    assert.strictEqual(res.status, 204);

    const favRepo = getRepository(Favorites);
    const remaining = await favRepo.findOne({ where: { tmdbId: 550 } });
    assert.strictEqual(remaining, null);
  });

  it('returns 404 when the favorite does not exist', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');
    const res = await agent.delete('/favorites/99999?mediaType=movie');
    assert.strictEqual(res.status, 404);
  });

  it('returns 400 when mediaType query param is missing or invalid', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const noType = await agent.delete('/favorites/550');
    assert.strictEqual(noType.status, 400);

    const badType = await agent.delete('/favorites/550?mediaType=book');
    assert.strictEqual(badType.status, 400);
  });

  it('does not allow a user to delete another user\'s favorite', async () => {
    const admin = await authenticatedAgent('admin@seerr.dev', 'test1234');
    const friend = await authenticatedAgent('friend@seerr.dev', 'test1234');

    await admin.post('/favorites').send({ tmdbId: 550, mediaType: 'movie' });

    const res = await friend.delete('/favorites/550?mediaType=movie');
    assert.strictEqual(res.status, 404);
  });
});
