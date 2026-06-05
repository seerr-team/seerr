import CoverArtArchive from '@server/api/coverartarchive';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import express from 'express';
import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import request from 'supertest';
import artworkProvidersRoutes from './artworkProviders';

setupTestDb();

let app: express.Express;

before(() => {
  app = express();
  app.use(express.json());
  app.use('/settings/artwork-providers', artworkProvidersRoutes);
});

beforeEach(() => {
  const settings = getSettings();
  settings.artworkProviders = {
    coverArtArchive: { maxRPS: 50, maxRequests: 20 },
  };
});

afterEach(() => {
  mock.restoreAll();
});

describe('Artwork Providers settings routes', () => {
  it('GET / returns the current settings with defaults applied', async () => {
    const res = await request(app).get('/settings/artwork-providers');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      coverArtArchive: { maxRPS: 50, maxRequests: 20 },
    });
  });

  it('PUT / merges partial bodies and coerces invalid numbers', async () => {
    const res = await request(app)
      .put('/settings/artwork-providers')
      .send({
        coverArtArchive: { maxRPS: 'not-a-number', maxRequests: 15 },
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    // Invalid maxRPS falls back to default
    assert.equal(res.body.coverArtArchive.maxRPS, 50);
    assert.equal(res.body.coverArtArchive.maxRequests, 15);

    // Round-trip
    const after = await request(app).get('/settings/artwork-providers');
    assert.equal(after.body.coverArtArchive.maxRequests, 15);
  });

  describe('POST /test', () => {
    it('reports ok when the provider succeeds', async () => {
      mock.method(
        CoverArtArchive.prototype,
        'testConnection',
        async () => true
      );

      const res = await request(app).post('/settings/artwork-providers/test');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.tests, {
        coverArtArchive: 'ok',
      });
    });

    it('reports failed and returns 500 when the provider fails', async () => {
      mock.method(
        CoverArtArchive.prototype,
        'testConnection',
        async () => false
      );

      const res = await request(app).post('/settings/artwork-providers/test');

      assert.equal(res.status, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.tests.coverArtArchive, 'failed');
    });

    it('reports failed when the provider throws', async () => {
      mock.method(CoverArtArchive.prototype, 'testConnection', async () => {
        throw new Error('boom');
      });

      const res = await request(app).post('/settings/artwork-providers/test');

      assert.equal(res.status, 500);
      assert.equal(res.body.tests.coverArtArchive, 'failed');
    });
  });
});
