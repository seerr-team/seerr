import CoverArtArchive from '@server/api/coverartarchive';
import type { CoverArtResponse } from '@server/api/coverartarchive/interfaces';
import ExternalAPI from '@server/api/externalapi';
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

function resetSettings(): void {
  const settings = getSettings();
  settings.artworkProviders = {
    coverArtArchive: { maxRPS: 50, maxRequests: 20 },
  };
}

describe('CoverArtArchive API client', () => {
  let getMock: MockGet;

  beforeEach(() => {
    resetSettings();
    getMock = installGetMock();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('maps release-group images to archive.org thumbnail URLs', async () => {
    const releaseMbid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const groupMbid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    getMock.impl = (): CoverArtResponse => ({
      images: [
        {
          approved: true,
          front: true,
          id: 12345,
          thumbnails: { 250: '' },
        },
      ],
      release: `/release/${releaseMbid}`,
    });

    const caa = new CoverArtArchive();
    const result = await caa.getCoverArt(groupMbid);

    assert.equal(getMock.calls.length, 1);
    assert.equal(getMock.calls[0].endpoint, `/release-group/${groupMbid}`);
    assert.equal(result.images.length, 1);
    assert.equal(
      result.images[0].thumbnails[250],
      `https://archive.org/download/mbid-${releaseMbid}/mbid-${releaseMbid}-12345_thumb250.jpg`
    );
  });

  it('returns an empty response when the upstream throws', async () => {
    getMock.impl = () => {
      throw new Error('boom');
    };

    const caa = new CoverArtArchive();
    const result = await caa.getCoverArt('some-id');

    assert.deepEqual(result.images, []);
    assert.equal(result.release, '/release/some-id');
  });

  describe('testConnection', () => {
    it('returns true when the upstream responds successfully', async () => {
      getMock.impl = (): CoverArtResponse => ({
        images: [],
        release: '/release/test',
      });

      const caa = new CoverArtArchive();
      const ok = await caa.testConnection();

      assert.equal(ok, true);
      assert.equal(getMock.calls.length, 1);
      assert.ok(getMock.calls[0].endpoint.startsWith('/release-group/'));
    });

    it('returns false when the upstream throws', async () => {
      getMock.impl = () => {
        throw new Error('network down');
      };

      const caa = new CoverArtArchive();
      const ok = await caa.testConnection();

      assert.equal(ok, false);
    });
  });
});
