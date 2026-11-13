import { MAX_DISCOVER_STUDIOS } from '@server/constants/discover';
import { ApiErrorCode } from '@server/constants/error';
import {
  InvalidDiscoverStudiosError,
  sanitizeDiscoverStudios,
  TooManyDiscoverStudiosError,
} from '@server/lib/discoverStudios';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const studioList = (length: number) =>
  Array.from({ length }, (_, index) => ({
    id: index + 1,
    name: `Studio ${index + 1}`,
    logoPath: '/logo.png',
  }));

describe('sanitizeDiscoverStudios', () => {
  it('stores an empty value as the built-in default', () => {
    assert.equal(sanitizeDiscoverStudios(null), null);
    assert.equal(sanitizeDiscoverStudios(''), null);
  });

  it('keeps a valid studio list and drops duplicates', () => {
    const stored = sanitizeDiscoverStudios(
      JSON.stringify([
        { id: 2, name: ' Disney ', logoPath: '/disney.png' },
        { id: 2, name: 'Disney again', logoPath: '/other.png' },
        { id: 3, name: 'Pixar', logoPath: '/pixar.png' },
      ])
    );

    assert.equal(
      stored,
      JSON.stringify([
        { id: 2, name: 'Disney', logoPath: '/disney.png' },
        { id: 3, name: 'Pixar', logoPath: '/pixar.png' },
      ])
    );
  });

  it('keeps an empty list as an empty list, not the default', () => {
    assert.equal(sanitizeDiscoverStudios('[]'), '[]');
  });

  it('rejects a list of more than 50 studios', () => {
    assert.throws(
      () =>
        sanitizeDiscoverStudios(
          JSON.stringify(studioList(MAX_DISCOVER_STUDIOS + 1))
        ),
      (error: unknown) => {
        assert.ok(error instanceof TooManyDiscoverStudiosError);
        assert.equal(error.message, ApiErrorCode.TooManyStudios);
        return true;
      }
    );
  });

  it('counts the limit after deduplicating duplicate studio ids', () => {
    const studios = [
      ...studioList(MAX_DISCOVER_STUDIOS),
      { id: 1, name: 'Duplicate Studio', logoPath: '/duplicate.png' },
    ];

    assert.equal(
      sanitizeDiscoverStudios(JSON.stringify(studios)),
      JSON.stringify(studioList(MAX_DISCOVER_STUDIOS))
    );
  });

  it('rejects studios with an invalid id, name or logo path', () => {
    const invalidStudios = [
      { id: 0, name: 'Disney', logoPath: '/logo.png' },
      { id: 1.5, name: 'Disney', logoPath: '/logo.png' },
      { id: 1, name: '   ', logoPath: '/logo.png' },
      { id: 1, name: 'a'.repeat(201), logoPath: '/logo.png' },
      { id: 1, name: 'Disney', logoPath: 'https://evil' },
      { id: 1, name: 'Disney', logoPath: '/folder/logo.png' },
    ];

    for (const studio of invalidStudios) {
      assert.throws(
        () => sanitizeDiscoverStudios(JSON.stringify([studio])),
        InvalidDiscoverStudiosError
      );
    }
  });

  it('uses the invalid studio list code for other errors', () => {
    assert.throws(
      () => sanitizeDiscoverStudios('not-json'),
      (error: unknown) => {
        assert.ok(error instanceof InvalidDiscoverStudiosError);
        assert.ok(!(error instanceof TooManyDiscoverStudiosError));
        assert.equal(error.message, ApiErrorCode.InvalidStudioList);
        return true;
      }
    );
  });
});
