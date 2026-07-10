import type { TmdbTvSeasonResult } from '@server/api/themoviedb/interfaces';
import { getRequestableSeasonNumbers } from '@server/entity/MediaRequest';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function season(
  seasonNumber: number,
  episodeCount: number
): TmdbTvSeasonResult {
  return {
    id: 1000 + seasonNumber,
    air_date: '2020-01-01',
    episode_count: episodeCount,
    name: `Season ${seasonNumber}`,
    overview: '',
    season_number: seasonNumber,
  };
}

describe('getRequestableSeasonNumbers', () => {
  it('excludes specials (season 0)', () => {
    const result = getRequestableSeasonNumbers([season(0, 5), season(1, 10)]);

    assert.deepStrictEqual(result, [1]);
  });

  it('excludes announced seasons that have no episodes yet', () => {
    // TMDB commonly lists a placeholder future season with episode_count 0
    // (e.g. an announced-but-unproduced season). It must not be requested,
    // otherwise watchlist sync re-creates a phantom request on every run.
    const result = getRequestableSeasonNumbers([
      season(1, 10),
      season(2, 8),
      season(3, 0),
    ]);

    assert.deepStrictEqual(result, [1, 2]);
  });

  it('returns every real season when all of them have episodes', () => {
    const result = getRequestableSeasonNumbers([season(1, 10), season(2, 8)]);

    assert.deepStrictEqual(result, [1, 2]);
  });
});
