import {
  getMovieCertification,
  getTvCertification,
} from '@server/lib/contentRating';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('getMovieCertification', () => {
  const movie = (iso_3166_1: string, ...certifications: string[]) => ({
    release_dates: {
      results: [
        {
          iso_3166_1,
          rating: '',
          release_dates: certifications.map((certification) => ({
            certification,
            release_date: '',
            type: 3,
          })),
        },
      ],
    },
  });

  it('returns a single US certification', () => {
    assert.equal(getMovieCertification(movie('US', 'PG-13')), 'PG-13');
  });

  it('picks the most restrictive of multiple US certifications', () => {
    assert.equal(getMovieCertification(movie('US', 'PG-13', 'R')), 'R');
  });

  it('ignores an unrated release when a real certification also exists', () => {
    assert.equal(getMovieCertification(movie('US', 'NR', 'PG')), 'PG');
  });

  it('returns undefined when there is no US entry', () => {
    assert.equal(getMovieCertification(movie('GB', '15')), undefined);
  });
});

describe('getTvCertification', () => {
  const show = (...entries: [string, string][]) => ({
    content_ratings: {
      results: entries.map(([iso_3166_1, rating]) => ({ iso_3166_1, rating })),
    },
  });

  it('returns the US content rating', () => {
    assert.equal(getTvCertification(show(['US', 'TV-14'])), 'TV-14');
  });

  it('picks the most restrictive of multiple US entries', () => {
    assert.equal(
      getTvCertification(show(['US', 'TV-Y7'], ['US', 'TV-14'])),
      'TV-14'
    );
  });

  it('ignores an unrated entry when a real rating also exists', () => {
    assert.equal(
      getTvCertification(show(['US', 'NR'], ['US', 'TV-PG'])),
      'TV-PG'
    );
  });

  it('returns undefined for an unrated US entry', () => {
    assert.equal(getTvCertification(show(['US', 'NR'])), undefined);
  });

  it('returns undefined when there is no US entry', () => {
    assert.equal(getTvCertification(show(['GB', '12'])), undefined);
  });
});
