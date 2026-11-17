import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeEach, describe, it, mock } from 'node:test';

import ImageProxy from '@server/lib/imageproxy';
import { getSettings } from '@server/lib/settings';
import express from 'express';
import request from 'supertest';
import imageproxyRoutes from './imageproxy';

const getImageMock = mock.method(
  ImageProxy.prototype,
  'getImage',
  async (imagePath: string) => ({
    imageBuffer: Buffer.from('fake-image-bytes'),
    meta: {
      revalidateAfter: 3600,
      curRevalidate: 3600,
      isStale: false,
      etag: 'mock-etag',
      extension: 'jpeg',
      cacheKey: imagePath,
      cacheMiss: true,
    },
  })
);

const app = express();
app.use('/imageproxy', imageproxyRoutes);
app.use(
  (
    err: { status?: number; message?: string },
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction
  ) => {
    res.status(err.status ?? 500).json({ message: err.message });
  }
);

// supertest resolves dot segments before sending, so send the path verbatim
async function getRawPath(path: string) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const { port } = server.address() as AddressInfo;

    return await new Promise<number | undefined>((resolve, reject) => {
      http
        .get({ host: '127.0.0.1', port, path, agent: false }, (res) => {
          res.resume();
          resolve(res.statusCode);
        })
        .on('error', reject);
    });
  } finally {
    server.close();
  }
}

describe('GET /imageproxy/:type/*path', () => {
  beforeEach(() => {
    getSettings().main.cacheImages = true;
    getImageMock.mock.resetCalls();
  });

  it('returns 404 when image caching is disabled', async () => {
    getSettings().main.cacheImages = false;

    const res = await request(app).get('/imageproxy/tmdb/t/p/w500/x.jpg');

    assert.strictEqual(res.status, 404);
    assert.strictEqual(getImageMock.mock.callCount(), 0);
  });

  it('rejects dot segments', async () => {
    for (const path of [
      '/imageproxy/tmdb/t/p/w500/./x.jpg',
      '/imageproxy/tmdb/t/p/x/../w500/x.jpg',
      '/imageproxy/tmdb/t/p/x/%2e%2e/w500/x.jpg',
      '/imageproxy/tmdb/t/p/x%2F..%2Fw500/x.jpg',
    ]) {
      assert.strictEqual(await getRawPath(path), 400, path);
    }

    assert.strictEqual(getImageMock.mock.callCount(), 0);
  });

  it('rejects characters outside the path allowlist', async () => {
    for (const path of [
      '/imageproxy/tmdb/t/p/w500/x.jpg%3Fa=1',
      '/imageproxy/tmdb/t/p/w500/x%252ejpg',
      '/imageproxy/tmdb/t/p/x/..%5Cw500/x.jpg',
      '/imageproxy/tmdb/t/p/w500/x.jpg%09',
      '/imageproxy/tmdb/t/p/w780_filter(x)/x.png',
      '/imageproxy/tmdb/t/p/w780_filter(duotone,ffffff,bababa)%3Fa=1/x.png',
    ]) {
      assert.strictEqual(await getRawPath(path), 400, path);
    }

    assert.strictEqual(getImageMock.mock.callCount(), 0);
  });

  it('serves duotone filter sizes', async () => {
    for (const path of [
      '/imageproxy/tmdb/t/p/w780_filter(duotone,ffffff,bababa)/x.png',
      '/imageproxy/tmdb/t/p/w1280_filter(duotone,991B1B,FCA5A5)/x.jpg',
    ]) {
      assert.strictEqual(await getRawPath(path), 200, path);
    }
  });

  it('serves repeated slashes from the same cache entry', async () => {
    const single = await request(app).get('/imageproxy/tmdb/t/p/w500/x.jpg');
    const repeated = await request(app).get(
      '/imageproxy/tmdb/t/p//w500///x.jpg'
    );

    assert.strictEqual(single.status, 200);
    assert.strictEqual(
      repeated.headers['os-cache-key'],
      single.headers['os-cache-key']
    );
  });
});
