import TheAudioDb from '@server/api/theaudiodb';
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
    theAudioDb: { apiKey: '195003', maxRPS: 25, maxRequests: 20 },
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
      theAudioDb: { apiKey: '195003', maxRPS: 25, maxRequests: 20 },
    });
  });

  it('PUT / merges partial bodies and coerces invalid numbers', async () => {
    const res = await request(app)
      .put('/settings/artwork-providers')
      .send({
        theAudioDb: { apiKey: 'my-key', maxRPS: 'not-a-number' },
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    // theAudioDb apiKey preserved, invalid maxRPS falls back to default
    assert.equal(res.body.theAudioDb.apiKey, 'my-key');
    assert.equal(res.body.theAudioDb.maxRPS, 25);
    assert.equal(res.body.theAudioDb.maxRequests, 20);

    // Round-trip
    const after = await request(app).get('/settings/artwork-providers');
    assert.equal(after.body.theAudioDb.apiKey, 'my-key');
  });

  describe('POST /test', () => {
    it('reports ok when the provider succeeds', async () => {
      mock.method(TheAudioDb.prototype, 'testConnection', async () => true);

      const res = await request(app).post('/settings/artwork-providers/test');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.tests, {
        theAudioDb: 'ok',
      });
    });

    it('reports failed and returns 500 when the provider fails', async () => {
      mock.method(TheAudioDb.prototype, 'testConnection', async () => false);

      const res = await request(app).post('/settings/artwork-providers/test');

      assert.equal(res.status, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.tests.theAudioDb, 'failed');
    });

    it('reports failed when the provider throws', async () => {
      mock.method(TheAudioDb.prototype, 'testConnection', async () => {
        throw new Error('boom');
      });

      const res = await request(app).post('/settings/artwork-providers/test');

      assert.equal(res.status, 500);
      assert.equal(res.body.tests.theAudioDb, 'failed');
    });

    it('marks TheAudioDB as not tested (and overall success) when no API key is configured', async () => {
      const settings = getSettings();
      settings.artworkProviders = {
        theAudioDb: { apiKey: '', maxRPS: 25, maxRequests: 20 },
      };

      // The route should short-circuit on hasApiKey() === false; testConnection
      // must not be invoked when the API key is empty.
      const tadbTest = mock.method(
        TheAudioDb.prototype,
        'testConnection',
        async () => true
      );

      const res = await request(app).post('/settings/artwork-providers/test');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.tests, {
        theAudioDb: 'not tested',
      });
      assert.equal(tadbTest.mock.callCount(), 0);
    });
  });
});
