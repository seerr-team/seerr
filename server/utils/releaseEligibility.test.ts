import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateReleaseRestriction,
  getMovieReleaseEligibility,
  getTvSeasonReleaseEligibility,
  type ReleaseEligibility,
} from './releaseEligibility';

const now = new Date('2026-08-07T12:00:00.000Z');

const movieReleases = (
  regions: { release_date: string; type: number }[][]
) => ({
  results: regions.map((release_dates) => ({ release_dates })),
});

describe('getMovieReleaseEligibility', () => {
  it('treats a Digital release in any region at or before now as released', () => {
    const eligibility = getMovieReleaseEligibility(
      movieReleases([
        [{ release_date: '2026-09-01T00:00:00.000Z', type: 4 }],
        [{ release_date: '2026-08-07T12:00:00.000Z', type: 4 }],
      ]),
      now
    );

    assert.deepStrictEqual(eligibility, { status: 'released' });
  });

  it('returns the earliest future Digital release across regions', () => {
    const eligibility = getMovieReleaseEligibility(
      movieReleases([
        [{ release_date: '2026-10-01T00:00:00.000Z', type: 4 }],
        [{ release_date: '2026-09-01T00:00:00.000Z', type: 4 }],
      ]),
      now
    );

    assert.deepStrictEqual(eligibility, {
      status: 'future',
      releaseDate: '2026-09-01T00:00:00.000Z',
    });
  });

  it('ignores theatrical and physical releases', () => {
    const eligibility = getMovieReleaseEligibility(
      movieReleases([
        [
          { release_date: '2026-01-01T00:00:00.000Z', type: 3 },
          { release_date: '2026-01-02T00:00:00.000Z', type: 5 },
        ],
      ]),
      now
    );

    assert.deepStrictEqual(eligibility, { status: 'unknown' });
  });

  it('treats missing and invalid Digital dates as unknown', () => {
    assert.deepStrictEqual(getMovieReleaseEligibility(undefined, now), {
      status: 'unknown',
    });
    assert.deepStrictEqual(
      getMovieReleaseEligibility(
        movieReleases([
          [
            { release_date: 'not-a-date', type: 4 },
            { release_date: '2026-02-31T00:00:00.000Z', type: 4 },
          ],
        ]),
        now
      ),
      { status: 'unknown' }
    );
  });
});

describe('getTvSeasonReleaseEligibility', () => {
  it('treats past and current air dates as released', () => {
    assert.deepStrictEqual(getTvSeasonReleaseEligibility('2026-08-06', now), {
      status: 'released',
    });
    assert.deepStrictEqual(getTvSeasonReleaseEligibility('2026-08-07', now), {
      status: 'released',
    });
  });

  it('returns future and unknown season eligibility', () => {
    assert.deepStrictEqual(getTvSeasonReleaseEligibility('2026-08-08', now), {
      status: 'future',
      releaseDate: '2026-08-08',
    });
    assert.deepStrictEqual(getTvSeasonReleaseEligibility(undefined, now), {
      status: 'unknown',
    });
    assert.deepStrictEqual(getTvSeasonReleaseEligibility('2026-02-31', now), {
      status: 'unknown',
    });
  });
});

describe('evaluateReleaseRestriction', () => {
  const future: ReleaseEligibility = {
    status: 'future',
    releaseDate: '2026-09-01',
  };
  const unknown: ReleaseEligibility = { status: 'unknown' };

  it('always allows requests when the restriction is disabled', () => {
    assert.deepStrictEqual(
      evaluateReleaseRestriction([future, unknown], {
        enabled: false,
      }),
      { allowed: true, bypassed: false }
    );
  });

  it('blocks future dates and allows unknown dates', () => {
    assert.strictEqual(
      evaluateReleaseRestriction([future], {
        enabled: true,
      }).allowed,
      false
    );
    assert.strictEqual(
      evaluateReleaseRestriction([unknown], {
        enabled: true,
      }).allowed,
      true
    );
  });

  it('allows managers to bypass the restriction and reports the bypass', () => {
    const decision = evaluateReleaseRestriction([future], {
      enabled: true,
      canBypass: true,
    });

    assert.strictEqual(decision.allowed, true);
    assert.strictEqual(decision.bypassed, true);
    assert.deepStrictEqual(decision.blockedEligibility, future);
  });

  it('reports the earliest future date when several items are blocked', () => {
    const decision = evaluateReleaseRestriction(
      [
        { status: 'future', releaseDate: '2026-10-01' },
        { status: 'future', releaseDate: '2026-09-01' },
      ],
      { enabled: true }
    );

    assert.deepStrictEqual(decision.blockedEligibility, {
      status: 'future',
      releaseDate: '2026-09-01',
    });
  });
});
