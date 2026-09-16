import {
  getAllowedRatings,
  MOVIE_RATINGS,
  shouldFilterMovie,
  shouldFilterTv,
  TV_RATINGS,
} from '@server/constants/contentRatings';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('shouldFilterMovie', () => {
  it('allows a rating within the cap', () => {
    assert.equal(shouldFilterMovie('PG', 'PG-13'), false);
  });

  it('blocks a rating above the cap', () => {
    assert.equal(shouldFilterMovie('R', 'PG-13'), true);
  });

  it('allows unrated content when blockUnrated is false', () => {
    assert.equal(shouldFilterMovie('NR', 'PG-13', false), false);
  });

  it('blocks unrated content when blockUnrated is true', () => {
    assert.equal(shouldFilterMovie('NR', 'PG-13', true), true);
    assert.equal(shouldFilterMovie(undefined, 'PG-13', true), true);
  });

  it('fails closed on an invalid maxRating', () => {
    assert.equal(shouldFilterMovie('G', 'NOT-A-RATING', false), true);
  });
});

describe('shouldFilterTv', () => {
  it('allows a rating within the cap', () => {
    assert.equal(shouldFilterTv('TV-PG', 'TV-14'), false);
  });

  it('blocks a rating above the cap', () => {
    assert.equal(shouldFilterTv('TV-MA', 'TV-14'), true);
  });

  it('allows unrated content when blockUnrated is false', () => {
    assert.equal(shouldFilterTv('Unrated', 'TV-14', false), false);
  });

  it('blocks unrated content when blockUnrated is true', () => {
    assert.equal(shouldFilterTv('Unrated', 'TV-14', true), true);
    assert.equal(shouldFilterTv(null, 'TV-14', true), true);
  });

  it('fails closed on an invalid maxRating', () => {
    assert.equal(shouldFilterTv('TV-G', 'NOT-A-RATING', false), true);
  });
});

describe('getAllowedRatings', () => {
  it('returns ratings up to the cap for movies', () => {
    assert.deepEqual(getAllowedRatings('movie', { maxMovieRating: 'PG' }), [
      'G',
      'PG',
    ]);
  });

  it('returns ratings up to the cap for tv', () => {
    assert.deepEqual(getAllowedRatings('tv', { maxTvRating: 'TV-14' }), [
      'TV-Y',
      'TV-Y7',
      'TV-G',
      'TV-PG',
      'TV-14',
    ]);
  });

  it('returns the full ratings list when there is no cap but unrated is blocked', () => {
    assert.deepEqual(getAllowedRatings('movie', { blockUnrated: true }), [
      ...MOVIE_RATINGS,
    ]);
    assert.deepEqual(getAllowedRatings('tv', { blockUnrated: true }), [
      ...TV_RATINGS,
    ]);
  });

  it('returns undefined when there is no cap and unrated is allowed', () => {
    assert.equal(getAllowedRatings('movie', {}), undefined);
    assert.equal(getAllowedRatings('tv', {}), undefined);
  });

  it('fails closed to the most restrictive rating on an invalid cap', () => {
    assert.deepEqual(
      getAllowedRatings('movie', { maxMovieRating: 'NOT-A-RATING' }),
      [MOVIE_RATINGS[0]]
    );
    assert.deepEqual(getAllowedRatings('tv', { maxTvRating: 'NOT-A-RATING' }), [
      TV_RATINGS[0],
    ]);
  });
});
