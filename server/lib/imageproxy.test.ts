import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import type ImageProxyClass from '@server/lib/imageproxy';

const IMAGE_SIZE = 1000;
// Each image is charged 8 KiB on top of its size, so two fit
const MAX_CACHE_SIZE = 5 * 4096;

let ImageProxy: typeof ImageProxyClass;
let configDirectory: string;
let server: http.Server;
let baseUrl: string;
const upstreamRequests: (string | undefined)[] = [];
const failingPaths = new Set<string | undefined>();

before(async () => {
  configDirectory = await mkdtemp(join(tmpdir(), 'seerr-imageproxy-'));
  // The cache directory is resolved when the module loads
  process.env.CONFIG_DIRECTORY = configDirectory;
  ImageProxy = (await import('@server/lib/imageproxy')).default;

  server = http.createServer((req, res) => {
    upstreamRequests.push(req.url);

    if (failingPaths.has(req.url)) {
      res.writeHead(500);
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(Buffer.alloc(IMAGE_SIZE));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await rm(configDirectory, { recursive: true, force: true });
});

describe('ImageProxy cache size limit', () => {
  it('evicts the oldest images once the cache is over the limit', async () => {
    const proxy = new ImageProxy('eviction', baseUrl, {
      maxCacheSize: MAX_CACHE_SIZE,
    });

    for (const name of ['a', 'b', 'c', 'd']) {
      await proxy.getImage(`/${name}.jpg`);
    }

    const { imageCount } = await ImageProxy.getImageStats('eviction');
    assert.strictEqual(imageCount, 2);
    assert.strictEqual((await proxy.getImage('/d.jpg')).meta.cacheMiss, false);
    assert.strictEqual((await proxy.getImage('/a.jpg')).meta.cacheMiss, true);
  });

  it('counts images cached before the limit applied', async () => {
    const uncapped = new ImageProxy('existing', baseUrl);

    for (const name of ['a', 'b', 'c']) {
      await uncapped.getImage(`/${name}.jpg`);
    }

    const capped = new ImageProxy('existing', baseUrl, {
      maxCacheSize: MAX_CACHE_SIZE,
    });
    await capped.getImage('/d.jpg');

    const { imageCount } = await ImageProxy.getImageStats('existing');
    assert.strictEqual(imageCount, 2);
  });

  it('fetches an image once for concurrent misses', async () => {
    const proxy = new ImageProxy('concurrent', baseUrl, {
      maxCacheSize: MAX_CACHE_SIZE,
    });

    await Promise.all(
      Array.from({ length: 10 }, () => proxy.getImage('/same.jpg'))
    );

    assert.strictEqual(
      upstreamRequests.filter((url) => url === '/same.jpg').length,
      1
    );
  });

  it('retries an image after a failed fetch', async () => {
    const proxy = new ImageProxy('retry', baseUrl, {
      maxCacheSize: MAX_CACHE_SIZE,
    });

    failingPaths.add('/flaky.jpg');
    await assert.rejects(proxy.getImage('/flaky.jpg'));

    failingPaths.delete('/flaky.jpg');
    const image = await proxy.getImage('/flaky.jpg');
    assert.strictEqual(image.meta.cacheMiss, true);
  });
});
