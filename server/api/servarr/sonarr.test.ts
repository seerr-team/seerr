import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { AxiosInstance } from 'axios';

import type {
  AddSeriesOptions,
  SonarrMissingSeasonsError,
  SonarrSeason,
} from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';

function buildSonarr(): SonarrAPI {
  return new SonarrAPI({ url: 'http://localhost:8989/api/v3', apiKey: 'test' });
}

function getAxios(sonarr: SonarrAPI): AxiosInstance {
  return (sonarr as unknown as { axios: AxiosInstance }).axios;
}

describe('SonarrAPI removeSeries', () => {
  afterEach(() => mock.restoreAll());

  it('removes the series when it exists in the library', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await sonarr.removeSeries(1234);

    assert.strictEqual(del.mock.callCount(), 1);
    assert.strictEqual(del.mock.calls[0].arguments[0], '/series/9');
  });

  it('does nothing when the series is not in the library', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({
      data: [{ id: 0, title: 'Breaking Bad' }],
    }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.doesNotReject(() => sonarr.removeSeries(1234));
    assert.strictEqual(del.mock.callCount(), 0);
  });

  it('rejects when the tvdbId is unknown to the lookup', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({ data: [] }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.rejects(() => sonarr.removeSeries(1234), /Series not found/);
    assert.strictEqual(del.mock.callCount(), 0);
  });

  it('ignores a 404 when the series was already removed in Sonarr', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    mock.method(getAxios(sonarr), 'delete', async () => {
      throw { response: { status: 404 } };
    });

    await assert.doesNotReject(() => sonarr.removeSeries(1234));
  });

  it('rethrows errors other than 404', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    mock.method(getAxios(sonarr), 'delete', async () => {
      throw { response: { status: 500 } };
    });

    await assert.rejects(() => sonarr.removeSeries(1234));
  });

  it('rethrows a 404 from the lookup instead of treating it as removed', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => {
      throw { response: { status: 404 } };
    });
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.rejects(
      () => sonarr.removeSeries(1234),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 404
    );
    assert.strictEqual(del.mock.callCount(), 0);
  });
});

describe('SonarrAPI addSeries', () => {
  afterEach(() => mock.restoreAll());

  const options: AddSeriesOptions = {
    tvdbid: 1234,
    title: 'Test Series',
    profileId: 1,
    seasons: [1, 2],
    seasonFolder: true,
    rootFolderPath: '/tv',
    seriesType: 'standard',
    searchNow: true,
  };

  function stubSonarr(sonarr: SonarrAPI, series: () => object) {
    const echo = async (_url: string, body: object) => ({
      data: { ...body, id: 9 },
    });

    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => series());
    mock.method(getAxios(sonarr), 'get', async () => ({ data: [] }));

    return {
      put: mock.method(getAxios(sonarr), 'put', echo),
      post: mock.method(getAxios(sonarr), 'post', echo),
    };
  }

  function sentSeasons(call: { arguments: unknown[] }): SonarrSeason[] {
    return (call.arguments[1] as { seasons: SonarrSeason[] }).seasons;
  }

  function sentUrls(calls: { arguments: unknown[] }[]): unknown[] {
    return calls.map((call) => call.arguments[0]);
  }

  function missesSeasonTwoOfAppliedSeries(e: unknown): boolean {
    const { message, series } = e as SonarrMissingSeasonsError;

    assert.match(message, /seasons 2 of/);
    assert.strictEqual(series?.id, 9);

    return true;
  }

  it('rejects after updating and searching the seasons Sonarr has', async () => {
    const sonarr = buildSonarr();
    const { put, post } = stubSonarr(sonarr, () => ({
      id: 9,
      title: 'Test Series',
      tags: [],
      seasons: [{ seasonNumber: 1, monitored: false }],
    }));

    await assert.rejects(
      () => sonarr.addSeries(options),
      missesSeasonTwoOfAppliedSeries
    );

    assert.deepStrictEqual(sentSeasons(put.mock.calls[0]), [
      { seasonNumber: 1, monitored: true },
    ]);
    assert.deepStrictEqual(sentUrls(post.mock.calls), ['/command']);
  });

  it('rejects after adding a new series with the seasons Sonarr has', async () => {
    const sonarr = buildSonarr();
    const { post } = stubSonarr(sonarr, () => ({
      title: 'Test Series',
      seasons: [
        { seasonNumber: 1, monitored: true },
        { seasonNumber: 3, monitored: true },
      ],
    }));

    await assert.rejects(
      () => sonarr.addSeries(options),
      missesSeasonTwoOfAppliedSeries
    );

    assert.deepStrictEqual(sentUrls(post.mock.calls), ['/series']);
    assert.deepStrictEqual(sentSeasons(post.mock.calls[0]), [
      { seasonNumber: 1, monitored: true },
      { seasonNumber: 3, monitored: false },
    ]);
  });

  it('leaves Sonarr untouched when it has none of the requested seasons', async () => {
    const sonarr = buildSonarr();
    const { put, post } = stubSonarr(sonarr, () => ({
      id: 9,
      title: 'Test Series',
      tags: [],
      seasons: [{ seasonNumber: 3, monitored: true }],
    }));

    await assert.rejects(() => sonarr.addSeries(options), /seasons 1, 2 of/);

    assert.strictEqual(put.mock.callCount(), 0);
    assert.strictEqual(post.mock.callCount(), 0);
  });

  it('monitors the season on a retry once Sonarr has it', async () => {
    const sonarr = buildSonarr();
    const seasons = [{ seasonNumber: 1, monitored: false }];
    const { put } = stubSonarr(sonarr, () => ({
      id: 9,
      title: 'Test Series',
      tags: [],
      seasons,
    }));

    await assert.rejects(() => sonarr.addSeries(options));

    seasons.push({ seasonNumber: 2, monitored: false });
    await sonarr.addSeries(options);

    assert.deepStrictEqual(sentSeasons(put.mock.calls[1]), [
      { seasonNumber: 1, monitored: true },
      { seasonNumber: 2, monitored: true },
    ]);
  });
});

describe('SonarrAPI getSeriesByTvdbId', () => {
  afterEach(() => mock.restoreAll());

  it('rethrows a 401 from the lookup with the status intact', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => {
      throw { response: { status: 401 } };
    });

    await assert.rejects(
      () => sonarr.getSeriesByTvdbId(1234),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 401
    );
  });

  it('throws "Series not found" when the lookup returns no results', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({ data: [] }));

    await assert.rejects(() => sonarr.getSeriesByTvdbId(1234), {
      message: 'Series not found',
    });
  });
});
