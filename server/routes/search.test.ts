import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import request from 'supertest';
import searchRoutes from './search';

let app: Express;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.locale = 'en';
    next();
  });
  app.use('/search', searchRoutes);
  // Error handler matching how next({ status, message }) calls are handled
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // We must provide a next function for the function signature here even though its not used
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
});

setupTestDb();

describe('GET /search', () => {
  it('returns results for searchType=all (default)', async () => {
    const res = await request(app).get('/search?query=test');

    assert.strictEqual(res.status, 200);
    // Should return multi-search results (movies + TV shows)
    assert.ok(res.body.totalResults >= 0);
  });

  it('returns movie-only results for searchType=movie', async () => {
    const res = await request(app).get('/search?query=test&searchType=movie');

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.totalResults >= 0);
    if (res.body.results.length > 0) {
      assert.strictEqual(res.body.results[0].mediaType, 'movie');
    }
  });

  it('returns tv-only results for searchType=tv', async () => {
    const res = await request(app).get('/search?query=test&searchType=tv');

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.totalResults >= 0);
    if (res.body.results.length > 0) {
      assert.strictEqual(res.body.results[0].mediaType, 'tv');
    }
  });

  it('returns person-only results for searchType=person', async () => {
    const res = await request(app).get('/search?query=test&searchType=person');

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.totalResults >= 0);
    if (res.body.results.length > 0) {
      assert.strictEqual(res.body.results[0].mediaType, 'person');
    }
  });

  it('returns collection-only results for searchType=collection', async () => {
    const res = await request(app).get(
      '/search?query=test&searchType=collection'
    );

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.totalResults >= 0);
    if (res.body.results.length > 0) {
      assert.strictEqual(res.body.results[0].mediaType, 'collection');
    }
  });

  it('uses default searchType=all for invalid searchType', async () => {
    const res = await request(app).get('/search?query=test&searchType=invalid');

    assert.strictEqual(res.status, 200);
    // Invalid searchType should fall back to 'all' behavior
    assert.ok(res.body.totalResults >= 0);
  });

  it('returns 400 when query is missing', async () => {
    const res = await request(app).get('/search');

    assert.strictEqual(res.status, 400);
  });
});
