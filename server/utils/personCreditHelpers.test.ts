import type { PersonCreditCast } from '@server/models/Person';
import {
  DEFAULT_PERSON_CREDIT_SORT,
  sortPersonCredits,
} from '@server/utils/personCreditHelpers';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const makeCredit = (
  overrides: Partial<PersonCreditCast> & Pick<PersonCreditCast, 'id'>
): PersonCreditCast => ({
  originalLanguage: 'en',
  episodeCount: 0,
  overview: '',
  originCountry: [],
  originalName: '',
  voteCount: 0,
  name: '',
  popularity: 0,
  creditId: `credit-${overrides.id}`,
  firstAirDate: '',
  voteAverage: 0,
  originalTitle: '',
  title: '',
  adult: false,
  releaseDate: '',
  character: '',
  ...overrides,
});

describe('personCreditHelpers', () => {
  it('defaults to vote count descending', () => {
    assert.equal(DEFAULT_PERSON_CREDIT_SORT, 'voteCount.desc');
  });

  it('sorts by vote count descending', () => {
    const credits = [
      makeCredit({ id: 1, title: 'Low', voteCount: 10 }),
      makeCredit({ id: 2, title: 'High', voteCount: 100 }),
    ];

    const sorted = sortPersonCredits(
      credits,
      'voteCount.desc',
      (credit) => credit.id,
      (objs) => objs[0]
    );

    assert.deepEqual(
      sorted.map((credit) => credit.id),
      [2, 1]
    );
  });

  it('sorts movies by release date and series by first air date', () => {
    const credits = [
      makeCredit({
        id: 1,
        mediaType: 'movie',
        title: 'Older Movie',
        releaseDate: '2000-01-01',
      }),
      makeCredit({
        id: 2,
        mediaType: 'tv',
        name: 'Newer Series',
        firstAirDate: '2020-01-01',
      }),
      makeCredit({
        id: 3,
        mediaType: 'movie',
        title: 'Newer Movie',
        releaseDate: '2010-01-01',
      }),
    ];

    const sorted = sortPersonCredits(
      credits,
      'releaseDate.desc',
      (credit) => credit.id,
      (objs) => objs[0]
    );

    assert.deepEqual(
      sorted.map((credit) => credit.id),
      [2, 3, 1]
    );
  });

  it('places credits without release dates last when sorting by release date', () => {
    const credits = [
      makeCredit({
        id: 1,
        mediaType: 'movie',
        title: 'Undated',
        releaseDate: '',
      }),
      makeCredit({
        id: 2,
        mediaType: 'movie',
        title: 'Dated',
        releaseDate: '2015-01-01',
      }),
    ];

    const sorted = sortPersonCredits(
      credits,
      'releaseDate.desc',
      (credit) => credit.id,
      (objs) => objs[0]
    );

    assert.deepEqual(
      sorted.map((credit) => credit.id),
      [2, 1]
    );
  });

  it('sorts by title ascending using localized title fields', () => {
    const credits = [
      makeCredit({ id: 1, mediaType: 'movie', title: 'Zulu' }),
      makeCredit({ id: 2, mediaType: 'tv', name: 'Alpha' }),
    ];

    const sorted = sortPersonCredits(
      credits,
      'title.asc',
      (credit) => credit.id,
      (objs) => objs[0]
    );

    assert.deepEqual(
      sorted.map((credit) => credit.id),
      [2, 1]
    );
  });

  it('groups duplicate credits before sorting', () => {
    const credits = [
      makeCredit({ id: 1, title: 'Popular', voteCount: 50, character: 'A' }),
      makeCredit({ id: 1, title: 'Popular', voteCount: 50, character: 'B' }),
      makeCredit({ id: 2, title: 'Less Popular', voteCount: 100 }),
    ];

    const sorted = sortPersonCredits(
      credits,
      'voteCount.desc',
      (credit) => credit.id,
      (objs) => ({
        ...objs[0],
        character: objs.map((obj) => obj.character).join(', '),
      })
    );

    assert.equal(sorted.length, 2);
    assert.equal(sorted[0].id, 2);
    assert.equal(sorted[1].character, 'A, B');
  });
});
