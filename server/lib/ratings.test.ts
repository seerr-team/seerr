import type {
  TmdbMovieReleaseResult,
  TmdbTvRatingResult,
} from '@server/api/themoviedb/interfaces';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import {
  applyJellyfinRatingCaps,
  extractMovieCertification,
  extractTvCertification,
  getEffectiveRatingCaps,
  isMovieCertificationAllowed,
  isTvCertificationAllowed,
  jellyfinRatingToCaps,
} from '@server/lib/ratings';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const movieReleases = (
  entries: { country: string; cert: string }[]
): TmdbMovieReleaseResult => ({
  results: entries.map((e) => ({
    iso_3166_1: e.country,
    rating: '',
    release_dates: [
      {
        certification: e.cert,
        release_date: '2020-01-01',
        type: 3,
      },
    ],
  })),
});

const tvRatings = (
  entries: { country: string; rating: string }[]
): TmdbTvRatingResult => ({
  results: entries.map((e) => ({ iso_3166_1: e.country, rating: e.rating })),
});

const cappedUser = (overrides: Partial<User> = {}): User =>
  new User({ permissions: Permission.REQUEST, ...overrides });

const adminUser = (overrides: Partial<User> = {}): User =>
  new User({ permissions: Permission.ADMIN, ...overrides });

describe('ratings - certification extraction', () => {
  it('extracts the US movie certification', () => {
    const releases = movieReleases([
      { country: 'GB', cert: '15' },
      { country: 'US', cert: 'PG-13' },
    ]);
    assert.equal(extractMovieCertification(releases), 'PG-13');
  });

  it('returns undefined when no US movie certification exists', () => {
    const releases = movieReleases([{ country: 'GB', cert: '15' }]);
    assert.equal(extractMovieCertification(releases), undefined);
  });

  it('extracts the US TV content rating', () => {
    const ratings = tvRatings([
      { country: 'GB', rating: '12' },
      { country: 'US', rating: 'TV-MA' },
    ]);
    assert.equal(extractTvCertification(ratings), 'TV-MA');
  });
});

describe('ratings - getEffectiveRatingCaps', () => {
  it('returns null for users with no cap', () => {
    assert.equal(getEffectiveRatingCaps(cappedUser()), null);
  });

  it('returns null for admins even when a cap is set', () => {
    assert.equal(
      getEffectiveRatingCaps(adminUser({ maxMovieRating: 'PG' })),
      null
    );
  });

  it('returns caps for capped non-admin users, blocking unrated by default', () => {
    const caps = getEffectiveRatingCaps(
      cappedUser({ maxMovieRating: 'PG-13' })
    );
    assert.deepEqual(caps, { movie: 'PG-13', tv: null, blockUnrated: true });
  });

  it('honors an explicit ratingBlockUnrated=false', () => {
    const caps = getEffectiveRatingCaps(
      cappedUser({ maxTvRating: 'TV-14', ratingBlockUnrated: false })
    );
    assert.deepEqual(caps, { movie: null, tv: 'TV-14', blockUnrated: false });
  });
});

describe('ratings - movie cap enforcement', () => {
  it('allows everything when no cap is set', () => {
    assert.equal(isMovieCertificationAllowed('NC-17', cappedUser()), true);
  });

  it('allows titles at or below the cap', () => {
    const user = cappedUser({ maxMovieRating: 'PG-13' });
    assert.equal(isMovieCertificationAllowed('G', user), true);
    assert.equal(isMovieCertificationAllowed('PG-13', user), true);
  });

  it('blocks titles above the cap', () => {
    const user = cappedUser({ maxMovieRating: 'PG-13' });
    assert.equal(isMovieCertificationAllowed('R', user), false);
    assert.equal(isMovieCertificationAllowed('NC-17', user), false);
  });

  it('blocks unrated titles by default, allows when opted out', () => {
    assert.equal(
      isMovieCertificationAllowed(
        undefined,
        cappedUser({ maxMovieRating: 'PG-13' })
      ),
      false
    );
    assert.equal(
      isMovieCertificationAllowed(
        undefined,
        cappedUser({ maxMovieRating: 'PG-13', ratingBlockUnrated: false })
      ),
      true
    );
  });

  it('never blocks for admins', () => {
    assert.equal(
      isMovieCertificationAllowed('NC-17', adminUser({ maxMovieRating: 'G' })),
      true
    );
  });
});

describe('ratings - tv cap enforcement', () => {
  it('allows titles at or below the cap and blocks above', () => {
    const user = cappedUser({ maxTvRating: 'TV-14' });
    assert.equal(isTvCertificationAllowed('TV-PG', user), true);
    assert.equal(isTvCertificationAllowed('TV-14', user), true);
    assert.equal(isTvCertificationAllowed('TV-MA', user), false);
  });
});

describe('ratings - jellyfin mapping', () => {
  it('returns no caps when Jellyfin has no limit', () => {
    assert.deepEqual(jellyfinRatingToCaps(null), { movie: null, tv: null });
  });

  it('maps Jellyfin age-based scores to caps', () => {
    // Jellyfin 10.10+ default US scores: G=0, PG=10, PG-13=13, R/NC-17=17;
    // TV-G=0, TV-Y7=7, TV-PG=10, TV-14=14, TV-MA=17.
    assert.deepEqual(jellyfinRatingToCaps(0), { movie: 'G', tv: 'TV-G' });
    assert.deepEqual(jellyfinRatingToCaps(7), { movie: 'G', tv: 'TV-G' });
    // PG (score 10) must map to PG / TV-PG — not R / TV-MA (regression: a PG
    // Jellyfin cap was being imported as the most permissive rating).
    assert.deepEqual(jellyfinRatingToCaps(10), { movie: 'PG', tv: 'TV-PG' });
    assert.deepEqual(jellyfinRatingToCaps(13), { movie: 'PG-13', tv: 'TV-PG' });
    assert.deepEqual(jellyfinRatingToCaps(14), { movie: 'PG-13', tv: 'TV-14' });
    assert.deepEqual(jellyfinRatingToCaps(17), { movie: 'NC-17', tv: 'TV-MA' });
  });

  it('is non-destructive when Jellyfin has no limit', () => {
    const user = cappedUser({ maxMovieRating: 'PG' });
    applyJellyfinRatingCaps(user, { MaxParentalRating: null });
    assert.equal(user.maxMovieRating, 'PG');
  });

  it('imports caps when Jellyfin has a limit', () => {
    const user = cappedUser();
    applyJellyfinRatingCaps(user, {
      MaxParentalRating: 10,
      BlockUnratedItems: ['Movie'],
    });
    assert.equal(user.maxMovieRating, 'PG');
    assert.equal(user.maxTvRating, 'TV-PG');
    assert.equal(user.ratingBlockUnrated, true);
  });
});
