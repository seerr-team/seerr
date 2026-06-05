import ExternalAPI from '@server/api/externalapi';
import TheAudioDb from '@server/api/theaudiodb';
import type { TadbArtistResponse } from '@server/api/theaudiodb/interfaces';
import { getSettings } from '@server/lib/settings';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

interface GetCall {
  endpoint: string;
  config?: { params?: Record<string, string> };
  ttl?: number;
}

interface MockGet {
  calls: GetCall[];
  impl: (call: GetCall) => unknown;
}

function installGetMock(): MockGet {
  const state: MockGet = {
    calls: [],
    impl: () => ({}),
  };
  mock.method(
    ExternalAPI.prototype as unknown as {
      get: (...args: unknown[]) => Promise<unknown>;
    },
    'get',
    async (
      endpoint: string,
      config?: { params?: Record<string, string> },
      ttl?: number
    ) => {
      const call: GetCall = { endpoint, config, ttl };
      state.calls.push(call);
      return state.impl(call);
    }
  );
  return state;
}

function setApiKey(apiKey: string): void {
  const settings = getSettings();
  settings.artworkProviders = {
    theAudioDb: { apiKey, maxRPS: 25, maxRequests: 20 },
  };
}

describe('TheAudioDB API client', () => {
  let getMock: MockGet;

  beforeEach(() => {
    setApiKey('test-key');
    getMock = installGetMock();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('passes the MusicBrainz artist id and configured API key', async () => {
    getMock.impl = (): TadbArtistResponse => ({
      artists: [
        {
          strArtistThumb: 'https://cdn/thumb.jpg',
          strArtistFanart: 'https://cdn/fanart.jpg',
        },
      ],
    });

    const tadb = new TheAudioDb();
    const result = await tadb.getArtistImages('artist-mbid');

    assert.equal(getMock.calls.length, 1);
    assert.equal(getMock.calls[0].endpoint, '/test-key/artist-mb.php');
    assert.deepEqual(getMock.calls[0].config?.params, { i: 'artist-mbid' });
    assert.deepEqual(result, {
      artistThumb: 'https://cdn/thumb.jpg',
      artistBackground: 'https://cdn/fanart.jpg',
    });
  });

  it('returns nulls when the upstream returns no artists', async () => {
    getMock.impl = (): TadbArtistResponse => ({ artists: [] });

    const tadb = new TheAudioDb();
    const result = await tadb.getArtistImages('artist-mbid');

    assert.deepEqual(result, {
      artistThumb: null,
      artistBackground: null,
    });
  });

  it('returns nulls when the upstream throws', async () => {
    getMock.impl = () => {
      throw new Error('boom');
    };

    const tadb = new TheAudioDb();
    const result = await tadb.getArtistImages('artist-mbid');

    assert.deepEqual(result, {
      artistThumb: null,
      artistBackground: null,
    });
  });

  it('short-circuits getArtistImages without calling upstream when API key is missing', async () => {
    setApiKey('');

    const tadb = new TheAudioDb();
    const result = await tadb.getArtistImages('artist-mbid');

    assert.equal(getMock.calls.length, 0);
    assert.deepEqual(result, {
      artistThumb: null,
      artistBackground: null,
    });
  });

  describe('testConnection', () => {
    it('returns false and skips upstream when API key is missing', async () => {
      setApiKey('');

      const tadb = new TheAudioDb();
      const ok = await tadb.testConnection();

      assert.equal(ok, false);
      assert.equal(getMock.calls.length, 0);
    });

    it('returns true when the upstream responds with an artists array', async () => {
      getMock.impl = (): TadbArtistResponse => ({
        artists: [
          {
            strArtistThumb: null,
            strArtistFanart: null,
          },
        ],
      });

      const tadb = new TheAudioDb();
      const ok = await tadb.testConnection();

      assert.equal(ok, true);
      assert.equal(getMock.calls.length, 1);
      assert.equal(getMock.calls[0].endpoint, '/test-key/artist-mb.php');
    });

    it('returns false when the upstream response is malformed', async () => {
      getMock.impl = () => ({}) as TadbArtistResponse;

      const tadb = new TheAudioDb();
      const ok = await tadb.testConnection();

      assert.equal(ok, false);
    });

    it('returns false when the upstream throws', async () => {
      getMock.impl = () => {
        throw new Error('network down');
      };

      const tadb = new TheAudioDb();
      const ok = await tadb.testConnection();

      assert.equal(ok, false);
    });
  });
});
