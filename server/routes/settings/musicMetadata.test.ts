import ExternalAPI from '@server/api/externalapi';
import Settings, { getSettings } from '@server/lib/settings';
import musicMetadataRoutes from '@server/routes/settings/musicMetadata';
import express, { type Express } from 'express';
import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import request from 'supertest';

interface CallRecord {
  baseURL?: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

function captureExternalAPI(): {
  getCalls: CallRecord[];
  getImpl: { fn: () => unknown };
} {
  const getCalls: CallRecord[] = [];
  const getImpl = { fn: () => ({}) as unknown };

  const externalProto = ExternalAPI.prototype as unknown as {
    get: (...args: unknown[]) => Promise<unknown>;
  };

  mock.method(
    externalProto,
    'get',
    async function (this: { baseUrl?: string }, ..._args: unknown[]) {
      // Cast to the local args shape so we capture what the production
      // code is sending to the upstream client.
      const config = _args[1] as
        | { params?: Record<string, string>; headers?: Record<string, string> }
        | undefined;
      getCalls.push({
        baseURL: this?.baseUrl,
        params: config?.params,
        headers: config?.headers,
      });
      return getImpl.fn();
    }
  );

  return { getCalls, getImpl };
}

let app: Express;

before(() => {
  app = express();
  app.use(express.json());
  app.use('/', musicMetadataRoutes);
});

beforeEach(() => {
  // Prevent the route from writing settings.json during the PUT test.
  mock.method(Settings.prototype, 'save', async () => undefined);

  // Reset the singleton-backed settings to a known state. The Settings
  // class merges incoming values, so we set the music metadata explicitly
  // to known "saved" values.
  const settings = getSettings();
  settings.musicMetadata = {
    listenbrainz: {
      apiBaseUrl: 'https://saved-api.example',
      webBaseUrl: 'https://saved-web.example',
      userToken: 'saved-user-token',
    },
  };
});

afterEach(() => {
  mock.restoreAll();
});

describe('GET /', () => {
  it('returns the persisted settings', async () => {
    const res = await request(app).get('/');

    assert.equal(res.status, 200);
    assert.equal(
      res.body.listenbrainz.apiBaseUrl,
      'https://saved-api.example'
    );
  });
});

describe('PUT /', () => {
  it('persists candidate values', async () => {
    const res = await request(app)
      .put('/')
      .send({
        listenbrainz: {
          apiBaseUrl: 'https://updated-api.example',
          webBaseUrl: 'https://updated-web.example',
          userToken: 'new-token',
        },
      });

    assert.equal(res.status, 200);
    assert.equal(
      getSettings().musicMetadata.listenbrainz.apiBaseUrl,
      'https://updated-api.example'
    );
  });
});

describe('POST /test', () => {
  // Regression: the handler previously ignored req.body and rebuilt the
  // client from `getSettings()`, so the Test button could pass against
  // stale persisted values while the form contained broken candidate
  // values.
  it('tests the candidate config sent in the body, not the saved settings', async () => {
    const { getCalls, getImpl } = captureExternalAPI();
    getImpl.fn = () => ({
      payload: { releases: [] },
    });

    const res = await request(app)
      .post('/test')
      .send({
        listenbrainz: {
          apiBaseUrl: 'https://candidate-api.example',
          webBaseUrl: 'https://candidate-web.example',
          userToken: 'candidate-user-token',
        },
      });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.tests, {
      listenbrainz: 'ok',
    });

    // The ListenBrainz client must have been built against the candidate
    // base URL, not the saved one.
    const baseURLs = getCalls.map((c) => c.baseURL);
    assert.ok(
      baseURLs.some((url) => url === 'https://candidate-api.example/1'),
      `expected a request against the candidate ListenBrainz baseURL, got ${JSON.stringify(baseURLs)}`
    );
    assert.ok(
      !baseURLs.includes('https://saved-api.example/1'),
      'must not have made a request against the previously-saved ListenBrainz baseURL'
    );
  });

  it('reports per-provider failures with a 500 status when the client throws', async () => {
    const { getImpl } = captureExternalAPI();
    getImpl.fn = () => {
      throw new Error('upstream down');
    };

    const res = await request(app).post('/test').send({});

    assert.equal(res.status, 500);
    assert.equal(res.body.tests.listenbrainz, 'failed');
  });

  it('falls back to the saved config when the request body is empty', async () => {
    const { getCalls, getImpl } = captureExternalAPI();
    getImpl.fn = () => ({
      payload: { releases: [] },
    });

    const res = await request(app).post('/test').send({});

    assert.equal(res.status, 200);
    const baseURLs = getCalls.map((c) => c.baseURL);
    assert.ok(baseURLs.includes('https://saved-api.example/1'));
  });
});
