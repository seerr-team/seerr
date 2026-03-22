import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Crew } from '@server/models/common';

import { sortCrewPriority } from '@app/utils/creditHelpers';

const makeCrew = (job: string, name = job): Crew => ({
  id: 0,
  creditId: '',
  department: '',
  job,
  name,
});

describe('sortCrewPriority', () => {
  it('filters out jobs not in the priority list', () => {
    const crew = [
      makeCrew('Director'),
      makeCrew('Gaffer'),
      makeCrew('Producer'),
    ];
    const result = sortCrewPriority(crew);
    assert.deepEqual(
      result.map((c) => c.job),
      ['Director', 'Producer']
    );
  });

  it('returns an empty array when no crew match priority jobs', () => {
    assert.deepEqual(
      sortCrewPriority([makeCrew('Gaffer'), makeCrew('Grip')]),
      []
    );
  });

  it('returns an empty array for empty input', () => {
    assert.deepEqual(sortCrewPriority([]), []);
  });

  it('sorts crew by priority order', () => {
    const crew = [
      makeCrew('Executive Producer'),
      makeCrew('Writer'),
      makeCrew('Director'),
      makeCrew('Producer'),
      makeCrew('Composer'),
    ];
    const result = sortCrewPriority(crew);
    assert.deepEqual(
      result.map((c) => c.job),
      ['Director', 'Writer', 'Composer', 'Producer', 'Executive Producer']
    );
  });

  it('handles multiple crew members sharing the same job', () => {
    const crew = [
      makeCrew('Producer', 'Producer B'),
      makeCrew('Director', 'Director A'),
      makeCrew('Producer', 'Producer A'),
    ];
    const result = sortCrewPriority(crew);
    assert.equal(result[0].job, 'Director');
    assert.ok(result.slice(1).every((c) => c.job === 'Producer'));
  });

  it('correctly ranks Producer, Co-Producer, and Executive Producer independently', () => {
    const crew = [
      makeCrew('Executive Producer'),
      makeCrew('Co-Producer'),
      makeCrew('Producer'),
    ];
    const result = sortCrewPriority(crew);
    assert.deepEqual(
      result.map((c) => c.job),
      ['Producer', 'Co-Producer', 'Executive Producer']
    );
  });
});
