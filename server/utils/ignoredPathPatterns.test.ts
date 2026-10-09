import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  compileIgnoredPathPattern,
  sanitizeIgnoredPathPatterns,
} from '@server/utils/ignoredPathPatterns';

describe('ignoredPathPatterns', () => {
  it('compiles valid patterns as case-insensitive regexes', () => {
    const regex = compileIgnoredPathPattern('placeholders/');

    assert.ok(regex instanceof RegExp);
    assert.equal(regex.flags, 'i');
    assert.ok(regex.test('/media/PLACEHOLDERS/movie.mkv'));
  });

  it('returns null for invalid, unsafe, or empty patterns', () => {
    assert.equal(compileIgnoredPathPattern('('), null);
    assert.equal(compileIgnoredPathPattern('(a+)+$'), null);
    assert.equal(compileIgnoredPathPattern(''), null);
  });

  it('returns null for patterns longer than 256 characters', () => {
    assert.ok(compileIgnoredPathPattern('a'.repeat(256)));
    assert.equal(compileIgnoredPathPattern('a'.repeat(257)), null);
  });

  it('rejects invalid and unsafe patterns while keeping safe unique ones', () => {
    const { cleaned, rejected } = sanitizeIgnoredPathPatterns([
      'placeholders/',
      '(a+)+$',
      '(',
      'placeholders/',
      '  trailers/  ',
      '',
    ]);

    assert.deepEqual(cleaned, ['placeholders/', 'trailers/']);
    assert.deepEqual(rejected, ['(a+)+$', '(']);
  });

  it('deduplicates rejected patterns and surfaces non-string entries', () => {
    const { cleaned, rejected } = sanitizeIgnoredPathPatterns([
      '(',
      '(',
      42,
      null,
      'placeholders/',
    ]);

    assert.deepEqual(cleaned, ['placeholders/']);
    assert.deepEqual(rejected, ['(', '42', 'null']);
  });
});
