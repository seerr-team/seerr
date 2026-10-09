import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import ExternalAPI from '@server/api/externalapi';
import Tvdb from '@server/api/tvdb';

type ApiMethod = (...args: unknown[]) => Promise<unknown>;

const gbboExtended = {
  data: {
    id: 184871,
    name: 'The Great British Bake Off',
    remoteIds: [
      { id: 'tt1877368', type: 2, sourceName: 'IMDB' },
      { id: '87012', type: 12, sourceName: 'TheMovieDB.com' },
      { id: '2950', type: 19, sourceName: 'TV Maze' },
    ],
  },
};

function seriesResult(id: number, name = 'Series') {
  return { series: { id, name } };
}

function stubApi(routes: Record<string, unknown>) {
  mock.method(
    ExternalAPI.prototype as unknown as { post: ApiMethod },
    'post',
    async () => ({ data: { token: 'test-token' } })
  );

  return mock.method(
    ExternalAPI.prototype as unknown as { get: ApiMethod },
    'get',
    async (endpoint: string) => {
      if (!(endpoint in routes)) {
        throw new Error(`Unstubbed TVDB endpoint: ${endpoint}`);
      }

      const route = routes[endpoint];

      if (route instanceof Error) {
        throw route;
      }

      return route;
    }
  ).mock;
}

describe('Tvdb resolveTvdbId', () => {
  afterEach(() => mock.restoreAll());

  it('resolves a series whose remote IDs contain the TMDB series ID', async () => {
    stubApi({
      '/search/remoteid/87012': {
        data: [
          { people: { id: 277107, name: 'Tomokazu Sugita' } },
          seriesResult(184871, 'The Great British Bake Off'),
          { movie: { id: 152027, name: 'Il va pleuvoir sur Conakry' } },
        ],
      },
      '/series/184871/extended': gbboExtended,
    });

    assert.strictEqual(await new Tvdb().resolveTvdbId(87012), 184871);
  });

  it('rejects a series that matched on another source ID space', async () => {
    stubApi({
      '/search/remoteid/2950': { data: [seriesResult(184871)] },
      '/series/184871/extended': gbboExtended,
    });

    assert.strictEqual(await new Tvdb().resolveTvdbId(2950), null);
  });

  it('rejects a match on a TMDB source type other than series', async () => {
    stubApi({
      '/search/remoteid/87012': { data: [seriesResult(184871)] },
      '/series/184871/extended': {
        data: {
          id: 184871,
          remoteIds: [
            { id: '87012', type: 10, sourceName: 'TheMovieDB.com' },
            { id: '87012', type: 15, sourceName: 'TheMovieDB.com' },
          ],
        },
      },
    });

    assert.strictEqual(await new Tvdb().resolveTvdbId(87012), null);
  });

  it('returns null when the search matches no series', async () => {
    const get = stubApi({
      '/search/remoteid/283260': {
        data: [{ movie: { id: 320312, name: 'Supremo' } }],
      },
    });

    assert.strictEqual(await new Tvdb().resolveTvdbId(283260), null);
    assert.strictEqual(get.callCount(), 1);
  });

  it('returns null when the search returns nothing', async () => {
    stubApi({ '/search/remoteid/276612': { data: [] } });

    assert.strictEqual(await new Tvdb().resolveTvdbId(276612), null);
  });

  it('returns null when more than one series matches', async () => {
    const remoteIds = [{ id: '87012', type: 12, sourceName: 'TheMovieDB.com' }];

    stubApi({
      '/search/remoteid/87012': {
        data: [seriesResult(184871), seriesResult(999999)],
      },
      '/series/184871/extended': { data: { id: 184871, remoteIds } },
      '/series/999999/extended': { data: { id: 999999, remoteIds } },
    });

    assert.strictEqual(await new Tvdb().resolveTvdbId(87012), null);
  });

  it('returns null instead of throwing when the lookup fails', async () => {
    stubApi({ '/search/remoteid/87012': new Error('connect ECONNREFUSED') });

    assert.strictEqual(await new Tvdb().resolveTvdbId(87012), null);
  });
});

describe('Tvdb getOfficialSeasons', () => {
  afterEach(() => mock.restoreAll());

  const endpoint = '/series/184871/extended?meta=episodes&short=true';

  it('derives each official season year from its earliest episode', async () => {
    stubApi({
      [endpoint]: {
        data: {
          seasons: [
            { number: 0, type: { type: 'official' } },
            { number: 1, type: { type: 'official' } },
            { number: 2, type: { type: 'official' } },
            { number: 1, type: { type: 'dvd' } },
          ],
          episodes: [
            { seasonNumber: 1, aired: '2020-11-24' },
            { seasonNumber: 1, aired: '2020-09-22' },
            { seasonNumber: 2, aired: '2021-09-21' },
            { seasonNumber: 0, aired: '2019-12-25' },
          ],
        },
      },
    });

    assert.deepStrictEqual(await new Tvdb().getOfficialSeasons(184871), [
      { seasonNumber: 1, year: 2020 },
      { seasonNumber: 2, year: 2021 },
    ]);
  });

  it('returns null when the record has no seasons', async () => {
    stubApi({ [endpoint]: { data: { episodes: [] } } });

    assert.strictEqual(await new Tvdb().getOfficialSeasons(184871), null);
  });

  it('returns null when the record has no episodes', async () => {
    stubApi({ [endpoint]: { data: { seasons: [] } } });

    assert.strictEqual(await new Tvdb().getOfficialSeasons(184871), null);
  });

  it('returns an empty list when the show has no official seasons', async () => {
    stubApi({
      [endpoint]: {
        data: {
          seasons: [{ number: 1, type: { type: 'dvd' } }],
          episodes: [{ seasonNumber: 1, aired: '2020-09-22' }],
        },
      },
    });

    assert.deepStrictEqual(await new Tvdb().getOfficialSeasons(184871), []);
  });
});
