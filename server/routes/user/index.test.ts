import { validateBulkParentalControlFields } from '@server/routes/user';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('validateBulkParentalControlFields', () => {
  it('accepts an empty body', () => {
    assert.equal(validateBulkParentalControlFields({}), null);
  });

  it('accepts valid movie and TV ratings with blockUnrated', () => {
    assert.equal(
      validateBulkParentalControlFields({
        maxMovieRating: 'PG-13',
        maxTvRating: 'TV-14',
        blockUnrated: true,
      }),
      null
    );
  });

  it('rejects an invalid movie rating', () => {
    assert.match(
      validateBulkParentalControlFields({ maxMovieRating: 'XX' }) ?? '',
      /Invalid movie rating: XX/
    );
  });

  it('rejects an invalid TV rating', () => {
    assert.match(
      validateBulkParentalControlFields({ maxTvRating: 'XX' }) ?? '',
      /Invalid TV rating: XX/
    );
  });

  it('rejects a non-boolean blockUnrated', () => {
    assert.match(
      validateBulkParentalControlFields({
        blockUnrated: 'yes' as unknown as boolean,
      }) ?? '',
      /blockUnrated must be a boolean/
    );
  });

  it('allows an empty-string rating to clear the restriction', () => {
    assert.equal(
      validateBulkParentalControlFields({ maxMovieRating: '', maxTvRating: '' }),
      null
    );
  });
});
