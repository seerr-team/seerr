import {
  shouldFilterMovie,
  shouldFilterTv,
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
