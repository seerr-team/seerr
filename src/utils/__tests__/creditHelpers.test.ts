import type { Crew } from '@server/models/common';
import { describe, expect, it } from 'vitest';

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
    expect(result.map((c) => c.job)).toEqual(['Director', 'Producer']);
  });

  it('returns an empty array when no crew match priority jobs', () => {
    expect(sortCrewPriority([makeCrew('Gaffer'), makeCrew('Grip')])).toEqual(
      []
    );
  });

  it('returns an empty array for empty input', () => {
    expect(sortCrewPriority([])).toEqual([]);
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
    expect(result.map((c) => c.job)).toEqual([
      'Director',
      'Writer',
      'Composer',
      'Producer',
      'Executive Producer',
    ]);
  });

  it('handles multiple crew members with the same job', () => {
    const crew = [
      makeCrew('Producer', 'Producer B'),
      makeCrew('Director', 'Director A'),
      makeCrew('Producer', 'Producer A'),
    ];
    const result = sortCrewPriority(crew);
    expect(result[0].job).toBe('Director');
    expect(result.slice(1).every((c) => c.job === 'Producer')).toBe(true);
  });

  it('correctly ranks Producer, Co-Producer, and Executive Producer independently', () => {
    const crew = [
      makeCrew('Executive Producer'),
      makeCrew('Co-Producer'),
      makeCrew('Producer'),
    ];
    const result = sortCrewPriority(crew);
    expect(result.map((c) => c.job)).toEqual([
      'Producer',
      'Co-Producer',
      'Executive Producer',
    ]);
  });
});
