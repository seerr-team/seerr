import ExternalAPI from '@server/api/externalapi';
import ListenBrainzAPI, {
  resolveListenBrainzApiUrl,
  resolveListenBrainzWebUrl,
} from '@server/api/listenbrainz';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

interface GetCall {
  endpoint: string;
  config?: { params?: Record<string, string>; baseURL?: string };
  ttl?: number;
}

interface PostCall {
  endpoint: string;
  data?: Record<string, unknown>;
  config?: { params?: Record<string, string>; baseURL?: string };
  ttl?: number;
}

interface MockState {
  getCalls: GetCall[];
  postCalls: PostCall[];
  getImpl: (call: GetCall) => unknown;
  postImpl: (call: PostCall) => unknown;
}

function installMocks(): MockState {
  const state: MockState = {
    getCalls: [],
    postCalls: [],
    getImpl: () => ({}),
    postImpl: () => ({}),
  };

  const externalProto = ExternalAPI.prototype as unknown as {
    get: (...args: unknown[]) => Promise<unknown>;
    post: (...args: unknown[]) => Promise<unknown>;
  };

  mock.method(
    externalProto,
    'get',
    async (
      endpoint: string,
      config?: { params?: Record<string, string>; baseURL?: string },
      ttl?: number
    ) => {
      const call: GetCall = { endpoint, config, ttl };
      state.getCalls.push(call);
      return state.getImpl(call);
    }
  );

  mock.method(
    externalProto,
    'post',
    async (
      endpoint: string,
      data?: Record<string, unknown>,
      config?: { params?: Record<string, string>; baseURL?: string },
      ttl?: number
    ) => {
      const call: PostCall = { endpoint, data, config, ttl };
      state.postCalls.push(call);
      return state.postImpl(call);
    }
  );

  return state;
}

describe('ListenBrainz API client', () => {
  let state: MockState;

  beforeEach(() => {
    state = installMocks();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('resolveListenBrainzApiUrl', () => {
    it('appends /1 when only a host is given', () => {
      assert.equal(
        resolveListenBrainzApiUrl('https://api.listenbrainz.org'),
        'https://api.listenbrainz.org/1'
      );
    });

    it('keeps an explicit /<n> suffix untouched', () => {
      assert.equal(
        resolveListenBrainzApiUrl('https://api.listenbrainz.org/1'),
        'https://api.listenbrainz.org/1'
      );
    });

    it('strips trailing slashes', () => {
      assert.equal(
        resolveListenBrainzApiUrl('https://api.listenbrainz.org/'),
        'https://api.listenbrainz.org/1'
      );
      assert.equal(
        resolveListenBrainzApiUrl('https://api.listenbrainz.org/1/'),
        'https://api.listenbrainz.org/1'
      );
    });

    it('falls back to the public API when given an empty value', () => {
      assert.equal(
        resolveListenBrainzApiUrl(''),
        'https://api.listenbrainz.org/1'
      );
    });
  });

  describe('resolveListenBrainzWebUrl', () => {
    it('accepts a host-only URL', () => {
      assert.equal(
        resolveListenBrainzWebUrl('https://listenbrainz.org'),
        'https://listenbrainz.org'
      );
    });

    it('strips trailing slashes', () => {
      assert.equal(
        resolveListenBrainzWebUrl('https://listenbrainz.org/'),
        'https://listenbrainz.org'
      );
    });

    it('falls back to the public site when given an empty value', () => {
      assert.equal(resolveListenBrainzWebUrl(''), 'https://listenbrainz.org');
    });
  });

  describe('getFreshReleases', () => {
    it('queries /explore/fresh-releases with defaults', async () => {
      state.getImpl = () => ({ payload: { releases: [] } });

      const lb = new ListenBrainzAPI();
      await lb.getFreshReleases();

      assert.equal(state.getCalls.length, 1);
      const call = state.getCalls[0];
      assert.equal(call.endpoint, '/explore/fresh-releases');
      assert.deepEqual(call.config?.params, {
        days: '7',
        sort: 'release_date',
        offset: '0',
        count: '20',
      });
    });

    it('passes through custom days/sort/offset/count', async () => {
      state.getImpl = () => ({ payload: { releases: [] } });

      const lb = new ListenBrainzAPI();
      await lb.getFreshReleases({
        days: 30,
        sort: 'confidence',
        offset: 40,
        count: 5,
      });

      assert.deepEqual(state.getCalls[0].config?.params, {
        days: '30',
        sort: 'confidence',
        offset: '40',
        count: '5',
      });
    });
  });

  describe('getTopAlbums', () => {
    it('queries /stats/sitewide/release-groups with defaults', async () => {
      state.getImpl = () => ({ payload: { release_groups: [] } });

      const lb = new ListenBrainzAPI();
      await lb.getTopAlbums();

      const call = state.getCalls[0];
      assert.equal(call.endpoint, '/stats/sitewide/release-groups');
      assert.deepEqual(call.config?.params, {
        offset: '0',
        range: 'month',
        count: '20',
      });
    });

    // Regression: the options bag previously had no `= {}` default, so
    // calling `lb.getTopAlbums()` threw before any request was made.
    it('can be called with no arguments', async () => {
      state.getImpl = () => ({ payload: { release_groups: [] } });

      const lb = new ListenBrainzAPI();
      await assert.doesNotReject(() => lb.getTopAlbums());
    });
  });

  describe('getTopArtists', () => {
    it('queries /stats/sitewide/artists with defaults', async () => {
      state.getImpl = () => ({ payload: { artists: [] } });

      const lb = new ListenBrainzAPI();
      await lb.getTopArtists();

      const call = state.getCalls[0];
      assert.equal(call.endpoint, '/stats/sitewide/artists');
      assert.deepEqual(call.config?.params, {
        offset: '0',
        range: 'month',
        count: '20',
      });
    });

    // Regression: see `getTopAlbums` \u2014 the options bag previously had no
    // `= {}` default, causing `lb.getTopArtists()` to throw.
    it('can be called with no arguments', async () => {
      state.getImpl = () => ({ payload: { artists: [] } });

      const lb = new ListenBrainzAPI();
      await assert.doesNotReject(() => lb.getTopArtists());
    });
  });

  describe('getAlbum', () => {
    it('GETs /metadata/release_group/ with the release-group MBID', async () => {
      state.getImpl = () => ({
        'rg-1': {
          release_group: { name: 'Test Album' },
          artist: { name: 'Test Artist' },
        },
      });

      const lb = new ListenBrainzAPI();
      const result = await lb.getAlbum('rg-1');

      assert.equal(state.getCalls.length, 1);
      const call = state.getCalls[0];
      assert.equal(call.endpoint, '/metadata/release_group/');
      assert.deepEqual(call.config?.params, {
        release_group_mbids: 'rg-1',
        inc: 'artist tag release',
      });
      assert.equal(result?.release_group?.name, 'Test Album');
    });

    it('returns null when the upstream response has no entry for the MBID', async () => {
      state.getImpl = () => ({});

      const lb = new ListenBrainzAPI();
      const result = await lb.getAlbum('rg-missing');

      assert.equal(result, null);
    });

    it('wraps upstream errors with a [ListenBrainz] prefix', async () => {
      state.getImpl = () => {
        throw new Error('boom');
      };

      const lb = new ListenBrainzAPI();
      await assert.rejects(
        () => lb.getAlbum('rg-1'),
        (err) => {
          assert.ok(err instanceof Error);
          assert.match(
            err.message,
            /^\[ListenBrainz\] Failed to fetch album details:/
          );
          return true;
        }
      );
    });
  });

  describe('getArtist', () => {
    it('GETs /metadata/artist/ with the artist MBID', async () => {
      state.getImpl = () => [
        {
          artist_mbid: 'a-1',
          name: 'Test Artist',
        },
      ];

      const lb = new ListenBrainzAPI();
      const result = await lb.getArtist('a-1');

      const call = state.getCalls[0];
      assert.equal(call.endpoint, '/metadata/artist/');
      assert.deepEqual(call.config?.params, {
        artist_mbids: 'a-1',
        inc: 'tag',
      });
      assert.equal(result?.artist_mbid, 'a-1');
      assert.equal(result?.name, 'Test Artist');
    });

    it('returns null when the upstream response is empty', async () => {
      state.getImpl = () => [];

      const lb = new ListenBrainzAPI();
      const result = await lb.getArtist('a-missing');

      assert.equal(result, null);
    });
  });

  // Regression: the test endpoint must validate the candidate config the
  // admin is editing, not the last-persisted settings. That requires the
  // client to accept an override settings object at construction time.
  describe('constructor override settings', () => {
    it('uses overridden apiBaseUrl/webBaseUrl/userToken instead of the global settings', () => {
      const override = {
        apiBaseUrl: 'https://api.override.example',
        webBaseUrl: 'https://web.override.example',
        userToken: 'override-token',
      };
      const lb = new ListenBrainzAPI(override);

      // The web base URL is exposed via the helper getters and used to
      // build absolute "View on ListenBrainz" links.
      assert.equal(
        lb.getAlbumWebUrl('rg-1'),
        'https://web.override.example/album/rg-1'
      );
      assert.equal(
        lb.getArtistWebUrl('a-1'),
        'https://web.override.example/artist/a-1'
      );
    });
  });

  describe('getAlbumWebUrl / getArtistWebUrl', () => {
    it('build absolute URLs against the configured web base URL', () => {
      const lb = new ListenBrainzAPI();
      assert.match(lb.getAlbumWebUrl('rg-1'), /^https:\/\/[^/]+\/album\/rg-1$/);
      assert.match(lb.getArtistWebUrl('a-1'), /^https:\/\/[^/]+\/artist\/a-1$/);
    });
  });
});
