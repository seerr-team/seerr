import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLoginUrl, getSafeRedirect } from './urlValidationHelper';

describe('getSafeRedirect', () => {
  it('returns same-origin paths unchanged', () => {
    for (const path of [
      '/tv/259140',
      '/discover/movies?genre=28&sortBy=popularity.desc',
      '/movie/438148#cast',
    ]) {
      assert.equal(getSafeRedirect(path), path);
    }
  });

  it('falls back to / for external or malformed targets', () => {
    for (const target of [
      undefined,
      ['/a', '/b'],
      'tv/1',
      'https://example.com',
      '//example.com',
      '/\\example.com',
      '/\t/example.com',
      'javascript:alert(1)',
      '/.//example.com',
      '/a/..//example.com',
      '/a\\..\\\\example.com',
      '/%2e//example.com',
    ]) {
      assert.equal(getSafeRedirect(target), '/', JSON.stringify(target));
    }
  });
});

describe('getLoginUrl', () => {
  it('round-trips a path with a query string through the redirect param', () => {
    const path = '/discover/tv?keywords=1%2C2&sortBy=first_air_date.desc#top';
    const redirect = new URL(
      getLoginUrl(path),
      'http://localhost'
    ).searchParams.get('redirect');

    assert.equal(getSafeRedirect(redirect), path);
  });
});
