import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { AxiosInstance } from 'axios';

import type { RadarrMovieOptions } from '@server/api/servarr/radarr';
import RadarrAPI from '@server/api/servarr/radarr';

function buildRadarr(): RadarrAPI {
  return new RadarrAPI({ url: 'http://localhost:7878/api/v3', apiKey: 'test' });
}

function getAxios(radarr: RadarrAPI): AxiosInstance {
  return (radarr as unknown as { axios: AxiosInstance }).axios;
}

function baseOptions(
  overrides: Partial<RadarrMovieOptions> = {}
): RadarrMovieOptions {
  return {
    title: 'Test Movie',
    qualityProfileId: 1,
    minimumAvailability: 'released',
    tags: [],
    profileId: 1,
    year: 1999,
    rootFolderPath: '/movies',
    tmdbId: 550,
    monitored: true,
    ...overrides,
  };
}

function getMergeTags(
  radarr: RadarrAPI
): (
  existing: number[],
  incoming?: number[]
) => { tags: number[]; changed: boolean } {
  return (
    radarr as unknown as {
      mergeTags: (
        existing: number[],
        incoming?: number[]
      ) => { tags: number[]; changed: boolean };
    }
  ).mergeTags.bind(radarr);
}

describe('RadarrAPI removeMovie', () => {
  afterEach(() => mock.restoreAll());

  it('removes the movie when it exists in the library', async () => {
    const radarr = buildRadarr();
    mock.method(RadarrAPI.prototype, 'getMovieByTmdbId', async () => ({
      id: 7,
      title: 'Test Movie',
    }));
    const del = mock.method(getAxios(radarr), 'delete', async () => ({}));

    await radarr.removeMovie(550);

    assert.strictEqual(del.mock.callCount(), 1);
    assert.strictEqual(del.mock.calls[0].arguments[0], '/movie/7');
  });

  it('does nothing when the movie is not in the library', async () => {
    const radarr = buildRadarr();
    mock.method(getAxios(radarr), 'get', async () => ({
      data: [{ id: 0, title: 'Fight Club' }],
    }));
    const del = mock.method(getAxios(radarr), 'delete', async () => ({}));

    await assert.doesNotReject(() => radarr.removeMovie(550));
    assert.strictEqual(del.mock.callCount(), 0);
  });

  it('rejects when the tmdbId is unknown to the lookup', async () => {
    const radarr = buildRadarr();
    mock.method(getAxios(radarr), 'get', async () => ({ data: [] }));
    const del = mock.method(getAxios(radarr), 'delete', async () => ({}));

    await assert.rejects(() => radarr.removeMovie(550), /Movie not found/);
    assert.strictEqual(del.mock.callCount(), 0);
  });

  it('ignores a 404 when the movie was already removed in Radarr', async () => {
    const radarr = buildRadarr();
    mock.method(RadarrAPI.prototype, 'getMovieByTmdbId', async () => ({
      id: 7,
      title: 'Test Movie',
    }));
    mock.method(getAxios(radarr), 'delete', async () => {
      throw { response: { status: 404 } };
    });

    await assert.doesNotReject(() => radarr.removeMovie(550));
  });

  it('rethrows errors other than 404', async () => {
    const radarr = buildRadarr();
    mock.method(RadarrAPI.prototype, 'getMovieByTmdbId', async () => ({
      id: 7,
      title: 'Test Movie',
    }));
    mock.method(getAxios(radarr), 'delete', async () => {
      throw { response: { status: 500 } };
    });

    await assert.rejects(() => radarr.removeMovie(550));
  });

  it('rethrows a 404 from the lookup instead of treating it as removed', async () => {
    const radarr = buildRadarr();
    mock.method(getAxios(radarr), 'get', async () => {
      throw { response: { status: 404 } };
    });
    const del = mock.method(getAxios(radarr), 'delete', async () => ({}));

    await assert.rejects(
      () => radarr.removeMovie(550),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 404
    );
    assert.strictEqual(del.mock.callCount(), 0);
  });
});

describe('RadarrAPI mergeTags', () => {
  it('returns existing tags unchanged when no incoming tags are given', () => {
    const radarr = buildRadarr();
    const result = getMergeTags(radarr)([1, 2], undefined);
    assert.deepStrictEqual(result, { tags: [1, 2], changed: false });
  });

  it('reports unchanged when incoming tags are already a subset of existing tags', () => {
    const radarr = buildRadarr();
    const result = getMergeTags(radarr)([1, 2, 3], [2]);
    assert.strictEqual(result.changed, false);
    assert.deepStrictEqual(result.tags, [1, 2, 3]);
  });

  it('merges in new tags and reports changed', () => {
    const radarr = buildRadarr();
    const result = getMergeTags(radarr)([1, 2], [2, 3]);
    assert.strictEqual(result.changed, true);
    assert.deepStrictEqual(result.tags, [1, 2, 3]);
  });
});

describe('RadarrAPI addMovie', () => {
  afterEach(() => mock.restoreAll());

  it('merges the requester tag when the movie already has a file', async () => {
    const radarr = buildRadarr();
    mock.method(RadarrAPI.prototype, 'getMovieByTmdbId', async () => ({
      id: 7,
      title: 'Test Movie',
      hasFile: true,
      tags: [1, 2],
    }));
    const put = mock.method(
      getAxios(radarr),
      'put',
      async (_url: string, body: unknown) => ({
        data: { ...(body as Record<string, unknown>), id: 7 },
      })
    );

    const result = await radarr.addMovie(baseOptions({ tags: [3] }));

    assert.strictEqual(put.mock.callCount(), 1);
    assert.deepStrictEqual(
      (put.mock.calls[0].arguments[1] as { tags: number[] }).tags,
      [1, 2, 3]
    );
    assert.strictEqual(result.id, 7);
  });

  it('skips the PUT when the movie already has a file and no new tags to add', async () => {
    const radarr = buildRadarr();
    mock.method(RadarrAPI.prototype, 'getMovieByTmdbId', async () => ({
      id: 7,
      title: 'Test Movie',
      hasFile: true,
      tags: [1, 2],
    }));
    const put = mock.method(getAxios(radarr), 'put', async () => ({
      data: {},
    }));

    const result = await radarr.addMovie(baseOptions({ tags: [1] }));

    assert.strictEqual(put.mock.callCount(), 0);
    assert.strictEqual(result.id, 7);
  });

  it('merges the requester tag when the movie is monitored but not yet downloaded', async () => {
    const radarr = buildRadarr();
    mock.method(RadarrAPI.prototype, 'getMovieByTmdbId', async () => ({
      id: 7,
      title: 'Test Movie',
      hasFile: false,
      monitored: true,
      tags: [1],
    }));
    const put = mock.method(
      getAxios(radarr),
      'put',
      async (_url: string, body: unknown) => ({
        data: { ...(body as Record<string, unknown>), id: 7, hasFile: false },
      })
    );
    const search = mock.method(
      RadarrAPI.prototype,
      'searchMovie',
      async () => undefined
    );

    await radarr.addMovie(baseOptions({ tags: [2], searchNow: false }));

    assert.strictEqual(put.mock.callCount(), 1);
    assert.deepStrictEqual(
      (put.mock.calls[0].arguments[1] as { tags: number[] }).tags,
      [1, 2]
    );
    assert.strictEqual(search.mock.callCount(), 0);
  });

  it('triggers a search after merging tags when searchNow is set and the movie has no file', async () => {
    const radarr = buildRadarr();
    mock.method(RadarrAPI.prototype, 'getMovieByTmdbId', async () => ({
      id: 7,
      title: 'Test Movie',
      hasFile: false,
      monitored: true,
      tags: [1],
    }));
    mock.method(
      getAxios(radarr),
      'put',
      async (_url: string, body: unknown) => ({
        data: { ...(body as Record<string, unknown>), id: 7, hasFile: false },
      })
    );
    const search = mock.method(
      RadarrAPI.prototype,
      'searchMovie',
      async () => undefined
    );

    await radarr.addMovie(baseOptions({ tags: [2], searchNow: true }));

    assert.strictEqual(search.mock.callCount(), 1);
    assert.strictEqual(search.mock.calls[0].arguments[0], 7);
  });

  it('leaves an already-monitored movie with no new tags unchanged (regression guard)', async () => {
    const radarr = buildRadarr();
    mock.method(RadarrAPI.prototype, 'getMovieByTmdbId', async () => ({
      id: 7,
      title: 'Test Movie',
      hasFile: false,
      monitored: true,
      tags: [1],
    }));
    const put = mock.method(getAxios(radarr), 'put', async () => ({
      data: {},
    }));
    const search = mock.method(
      RadarrAPI.prototype,
      'searchMovie',
      async () => undefined
    );

    const result = await radarr.addMovie(
      baseOptions({ tags: [1], searchNow: false })
    );

    assert.strictEqual(put.mock.callCount(), 0);
    assert.strictEqual(search.mock.callCount(), 0);
    assert.strictEqual(result.id, 7);
  });
});

describe('RadarrAPI getMovieByTmdbId', () => {
  afterEach(() => mock.restoreAll());

  it('rethrows a 401 from the lookup with the status intact', async () => {
    const radarr = buildRadarr();
    mock.method(getAxios(radarr), 'get', async () => {
      throw { response: { status: 401 } };
    });

    await assert.rejects(
      () => radarr.getMovieByTmdbId(550),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 401
    );
  });

  it('throws "Movie not found" when the lookup returns no results', async () => {
    const radarr = buildRadarr();
    mock.method(getAxios(radarr), 'get', async () => ({ data: [] }));

    await assert.rejects(() => radarr.getMovieByTmdbId(550), {
      message: 'Movie not found',
    });
  });
});
