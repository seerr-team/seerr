import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  TmdbMovieResult,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import {
  recommendationKey,
  selectPersonalizedRecommendations,
} from '@server/lib/personalizedRecommendations';

const movie = (
  id: number,
  releaseDate: string,
  voteCount = 2_000
): TmdbMovieResult =>
  ({
    id,
    media_type: 'movie',
    release_date: releaseDate,
    vote_count: voteCount,
    vote_average: 7,
  }) as TmdbMovieResult;

const series = (id: number, voteCount: number): TmdbTvResult =>
  ({
    id,
    media_type: 'tv',
    first_air_date: '2020-01-01',
    vote_count: voteCount,
    vote_average: 7,
  }) as TmdbTvResult;

describe('selectPersonalizedRecommendations', () => {
  it('excludes requested titles and includes recent and lesser-known picks', () => {
    const excluded = movie(1, '2026-01-01');
    const recent = movie(2, '2026-08-01');
    const lesserKnownSeries = series(3, 100);
    const popular = movie(4, '2020-01-01');

    const results = selectPersonalizedRecommendations(
      [excluded, recent, lesserKnownSeries, popular, recent],
      new Set([recommendationKey(excluded)]),
      3,
      new Date('2026-11-01')
    );

    assert.strictEqual(results.length, 3);
    assert.ok(results.some((result) => result.id === recent.id));
    assert.ok(results.some((result) => result.id === lesserKnownSeries.id));
    assert.ok(!results.some((result) => result.id === excluded.id));
    assert.strictEqual(
      new Set(results.map((result) => recommendationKey(result))).size,
      results.length
    );
  });
});
