import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import type { Express } from 'express';
import express from 'express';
import request from 'supertest';
import discoverRoutes from './discover';

let app: Express;

before(() => {
  app = express();
  app.use('/discover', discoverRoutes);
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
});

describe('GET /discover/anime', () => {
  for (const page of ['invalid', '0', '-1', '1.5']) {
    it(`rejects invalid page value ${page}`, async () => {
      const res = await request(app).get(`/discover/anime?page=${page}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, 'Invalid query parameters.');
    });
  }
});

describe('GET /discover/seasonal-anime', () => {
  for (const page of ['invalid', '0', '-1', '1.5']) {
    it(`rejects invalid page value ${page}`, async () => {
      const res = await request(app).get(
        `/discover/seasonal-anime?page=${page}`
      );

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, 'Invalid query parameters.');
    });
  }
});
