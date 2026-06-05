import type {
  LidarrAlbum,
  LidarrAlbumOptions,
} from '@server/api/servarr/lidarr';
import LidarrAPI from '@server/api/servarr/lidarr';
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

/**
 * These tests verify that LidarrAPI calls the correct upstream Lidarr v1
 * endpoints with the expected method, URL, params, and request bodies.
 * The upstream API surface is documented at
 * https://lidarr.audio/docs/api/ (OAS3).
 */

interface AxiosCall {
  method: 'get' | 'post' | 'put' | 'delete';
  url: string;
  data?: unknown;
  config?: { params?: Record<string, unknown> };
}

function createFakeAxios(responses: Record<string, unknown>) {
  const calls: AxiosCall[] = [];

  const respond = (method: string, url: string) => {
    const key = `${method.toUpperCase()} ${url}`;
    if (!(key in responses)) {
      throw new Error(`Unexpected ${key}`);
    }
    return { data: responses[key] };
  };

  return {
    calls,
    axios: {
      get: async (url: string, config?: AxiosCall['config']) => {
        calls.push({ method: 'get', url, config });
        return respond('get', url);
      },
      post: async (
        url: string,
        data?: unknown,
        config?: AxiosCall['config']
      ) => {
        calls.push({ method: 'post', url, data, config });
        return respond('post', url);
      },
      put: async (
        url: string,
        data?: unknown,
        config?: AxiosCall['config']
      ) => {
        calls.push({ method: 'put', url, data, config });
        return respond('put', url);
      },
      delete: async (url: string, config?: AxiosCall['config']) => {
        calls.push({ method: 'delete', url, config });
        return respond('delete', url);
      },
    },
  };
}

function buildLidarr(responses: Record<string, unknown> = {}) {
  const api = new LidarrAPI({
    url: 'http://lidarr.test/api/v1',
    apiKey: 'test-key',
  });
  const fake = createFakeAxios(responses);
  // Replace the underlying axios instance with our fake. The `axios` property
  // is `protected` on ExternalAPI; cast to `any` for test access only.
  (api as unknown as { axios: typeof fake.axios }).axios = fake.axios;
  return { api, calls: fake.calls };
}

function fakeAlbum(overrides: Partial<LidarrAlbum> = {}): LidarrAlbum {
  return {
    id: 1,
    mbId: 'mbid-1',
    title: 'Test Album',
    monitored: true,
    artistId: 10,
    foreignAlbumId: 'foreign-1',
    titleSlug: 'test-album',
    profileId: 1,
    duration: 0,
    albumType: 'Album',
    statistics: {
      trackFileCount: 0,
      trackCount: 0,
      totalTrackCount: 0,
      sizeOnDisk: 0,
      percentOfTracks: 0,
    },
    ...overrides,
  };
}

function fakeAlbumOptions(
  overrides: Partial<LidarrAlbumOptions> = {}
): LidarrAlbumOptions {
  return {
    title: 'New Album',
    artistId: 10,
    foreignAlbumId: 'foreign-new',
    monitored: true,
    anyReleaseOk: true,
    profileId: 1,
    albumType: 'Album',
    secondaryTypes: [],
    releases: [],
    genres: [],
    media: [],
    artist: {
      status: 'continuing',
      ended: false,
      artistName: 'Test Artist',
      foreignArtistId: 'artist-1',
      artistType: 'Group',
      links: [],
      images: [],
      path: '/music/Test Artist',
      qualityProfileId: 1,
      metadataProfileId: 1,
      monitored: true,
      monitorNewItems: 'all',
      rootFolderPath: '/music',
      genres: [],
      tags: [],
      id: 0,
    },
    images: [],
    links: [],
    addOptions: {
      searchForNewAlbum: false,
    },
    ...overrides,
  };
}

describe('LidarrAPI', () => {
  beforeEach(() => {
    mock.reset();
  });

  describe('getAlbums', () => {
    it('GETs /album', async () => {
      const { api, calls } = buildLidarr({ 'GET /album': [fakeAlbum()] });

      const result = await api.getAlbums();

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].method, 'get');
      assert.strictEqual(calls[0].url, '/album');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, 1);
    });
  });

  describe('getAlbumById', () => {
    it('GETs /album/:id', async () => {
      const { api, calls } = buildLidarr({
        'GET /album/42': fakeAlbum({ id: 42 }),
      });

      const result = await api.getAlbumById(42);

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].url, '/album/42');
      assert.strictEqual(result.id, 42);
    });
  });

  describe('getAlbumByForeignAlbumId', () => {
    it('GETs /album/lookup with term=lidarr:<mbid> and returns first result', async () => {
      const { api, calls } = buildLidarr({
        'GET /album/lookup': [fakeAlbum({ foreignAlbumId: 'abc-123' })],
      });

      const result = await api.getAlbumByForeignAlbumId('abc-123');

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].url, '/album/lookup');
      assert.deepStrictEqual(calls[0].config?.params, {
        term: 'lidarr:abc-123',
      });
      assert.strictEqual(result.foreignAlbumId, 'abc-123');
    });

    it('throws when no album is returned', async () => {
      const { api } = buildLidarr({ 'GET /album/lookup': [] });

      await assert.rejects(() => api.getAlbumByForeignAlbumId('missing'), {
        message: 'Album not found',
      });
    });
  });

  describe('addAlbum', () => {
    it('POSTs /album when the album does not already exist', async () => {
      const created = fakeAlbum({ id: 5, foreignAlbumId: 'foreign-new' });
      const { api, calls } = buildLidarr({
        // Lookup returns metadata without an id → not yet in library
        'GET /album/lookup': [
          fakeAlbum({ id: 0, foreignAlbumId: 'foreign-new' }),
        ],
        'POST /album': created,
      });

      const options = fakeAlbumOptions();
      const result = await api.addAlbum(options);

      const post = calls.find((c) => c.method === 'post');
      assert.ok(post, 'expected a POST call');
      assert.strictEqual(post.url, '/album');
      // monitored:true default is enforced when not explicitly set in body
      assert.strictEqual(
        (post.data as { monitored?: boolean }).monitored,
        true
      );
      assert.strictEqual(result.id, 5);
    });

    it('PUTs /album/:id when the album already exists and does not search by default', async () => {
      const existing = fakeAlbum({ id: 9, monitored: false });
      const { api, calls } = buildLidarr({
        'GET /album/lookup': [existing],
        'PUT /album/9': fakeAlbum({ id: 9, monitored: true }),
      });

      const result = await api.addAlbum(fakeAlbumOptions({ monitored: true }));

      const put = calls.find((c) => c.method === 'put');
      assert.ok(put, 'expected a PUT call');
      assert.strictEqual(put.url, '/album/9');
      assert.strictEqual((put.data as { monitored?: boolean }).monitored, true);
      // No POST /command (no automatic search) when searchForNewAlbum is false
      assert.strictEqual(
        calls.some((c) => c.method === 'post' && c.url === '/command'),
        false
      );
      assert.strictEqual(result.id, 9);
    });

    it('triggers AlbumSearch when addOptions.searchForNewAlbum is true on existing album', async () => {
      const existing = fakeAlbum({ id: 9 });
      const { api, calls } = buildLidarr({
        'GET /album/lookup': [existing],
        'PUT /album/9': fakeAlbum({ id: 9 }),
        'POST /command': { id: 1 },
      });

      await api.addAlbum(
        fakeAlbumOptions({ addOptions: { searchForNewAlbum: true } })
      );

      const command = calls.find(
        (c) => c.method === 'post' && c.url === '/command'
      );
      assert.ok(command, 'expected a POST /command call');
      assert.deepStrictEqual(command.data, {
        name: 'AlbumSearch',
        albumIds: [9],
      });
    });
  });

  describe('removeAlbum', () => {
    it('looks up the album by mbid then DELETEs /album/:id with the expected params', async () => {
      const { api, calls } = buildLidarr({
        'GET /album/lookup': [fakeAlbum({ id: 7 })],
        'DELETE /album/7': null,
      });

      await api.removeAlbum('some-mbid');

      const lookup = calls.find(
        (c) => c.method === 'get' && c.url === '/album/lookup'
      );
      assert.ok(lookup, 'expected an /album/lookup GET');
      assert.deepStrictEqual(lookup.config?.params, {
        term: 'lidarr:some-mbid',
      });

      const del = calls.find((c) => c.method === 'delete');
      assert.ok(del, 'expected a DELETE call');
      assert.strictEqual(del.url, '/album/7');
      assert.deepStrictEqual(del.config?.params, {
        deleteFiles: true,
        addImportExclusion: false,
      });
    });
  });

  describe('searchAlbum', () => {
    it('POSTs the AlbumSearch command with the given album id', async () => {
      const { api, calls } = buildLidarr({
        'POST /command': { id: 1 },
      });

      await api.searchAlbum(42);

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].method, 'post');
      assert.strictEqual(calls[0].url, '/command');
      assert.deepStrictEqual(calls[0].data, {
        name: 'AlbumSearch',
        albumIds: [42],
      });
    });
  });

  describe('getMetadataProfiles', () => {
    it('GETs /metadataprofile', async () => {
      const { api, calls } = buildLidarr({
        'GET /metadataprofile': [{ id: 1, name: 'Standard' }],
      });

      const result = await api.getMetadataProfiles();

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].url, '/metadataprofile');
      assert.deepStrictEqual(result, [{ id: 1, name: 'Standard' }]);
    });
  });
});
