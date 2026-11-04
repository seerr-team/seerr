import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import ExternalAPI from '@server/api/externalapi';
import {
  findSearchProvider,
  parseTrailingYear,
  searchTitleWithYear,
} from '@server/lib/search';

describe('parseTrailingYear', () => {
  it('extracts a trailing release year in supported formats', () => {
    for (const query of [
      'The Thing 1982',
      'The Thing (1982)',
      'The Thing [1982]',
      'The Thing(1982)',
    ]) {
      assert.deepEqual(parseTrailingYear(query), {
        title: 'The Thing',
        year: 1982,
      });
    }
    assert.deepEqual(parseTrailingYear('  1917 (2019)  '), {
      title: '1917',
      year: 2019,
    });
  });

  it('leaves standalone years, unmatched brackets, invalid years, and explicit providers alone', () => {
    for (const query of [
      '1917',
      '(1982)',
      'The Thing (1982]',
      'The Thing 1080',
      'The Thing 9999',
      'The Thing year:1982',
    ]) {
      assert.equal(parseTrailingYear(query), undefined);
    }
    assert.ok(findSearchProvider('tmdb:123 2020'));
    assert.ok(findSearchProvider('the thing year:1982'));
    assert.ok(findSearchProvider('avatar y:2009'));
    assert.equal(findSearchProvider('comedy:2009'), undefined);
  });
});

type MockGet = (
  endpoint: string,
  config?: { params?: Record<string, unknown> }
) => Promise<unknown>;
const api = ExternalAPI.prototype as unknown as { get: MockGet };
const page = (results: object[]) => ({
  page: 1,
  total_pages: 1,
  total_results: results.length,
  results,
});

describe('searchTitleWithYear', () => {
  afterEach(() => mock.restoreAll());

  it('treats y: as the same explicit year filter and preserves provider priority', async () => {
    const get = mock.method(api, 'get', async () => page([]));
    const provider = findSearchProvider('avatar y:2009');
    assert.ok(provider);
    assert.equal('avatar y:2009'.match(provider.pattern)?.[0], '2009');
    await provider.search({
      id: '2009',
      query: 'Avatar Y:2009',
      language: 'en',
    });
    assert.equal(get.mock.calls.length, 2);
    for (const call of get.mock.calls) {
      assert.equal(call.arguments[1]?.params?.query, 'Avatar');
      assert.equal(call.arguments[1]?.params?.language, 'en');
    }
    assert.equal(
      get.mock.calls.find((call) => call.arguments[0] === '/search/movie')
        ?.arguments[1]?.params?.primary_release_year,
      2009
    );
    assert.equal(
      get.mock.calls.find((call) => call.arguments[0] === '/search/tv')
        ?.arguments[1]?.params?.first_air_date_year,
      2009
    );
    assert.equal(
      findSearchProvider('tmdb:123 y:2009'),
      findSearchProvider('tmdb:123')
    );
  });

  it('uses filtered movie and TV results and forwards the language', async () => {
    const get = mock.method(api, 'get', async (endpoint: string) => {
      if (endpoint === '/search/movie')
        return page([{ id: 1, title: 'The Thing' }]);
      if (endpoint === '/search/tv')
        return page([{ id: 2, name: 'The Thing' }]);
      return page([]);
    });
    const result = await searchTitleWithYear({
      query: 'The Thing (1982)',
      title: 'The Thing',
      year: 1982,
      language: 'fr',
    });
    assert.deepEqual(
      result.results.map((item) => item.media_type),
      ['movie', 'tv']
    );
    const movie = get.mock.calls.find(
      (call) => call.arguments[0] === '/search/movie'
    );
    const tv = get.mock.calls.find(
      (call) => call.arguments[0] === '/search/tv'
    );
    assert.equal(movie?.arguments[1]?.params?.language, 'fr');
    assert.equal(tv?.arguments[1]?.params?.first_air_date_year, 1982);
  });

  it('keeps an exact title containing a year', async () => {
    const original = page([
      { id: 1, title: 'Blade Runner 2049', media_type: 'movie' },
    ]);
    mock.method(api, 'get', async (endpoint: string) => {
      if (endpoint === '/search/multi') return original;
      return endpoint === '/search/movie'
        ? page([{ id: 2, title: 'Blade Runner' }])
        : page([]);
    });
    assert.equal(
      await searchTitleWithYear({
        query: 'Blade Runner 2049',
        title: 'Blade Runner',
        year: 2049,
      }),
      original
    );
  });

  it('falls back to the original search when the year search is empty', async () => {
    const original = page([{ id: 1, name: 'Show', media_type: 'tv' }]);
    mock.method(api, 'get', async (endpoint: string) =>
      endpoint === '/search/multi' ? original : page([])
    );
    assert.equal(
      await searchTitleWithYear({
        query: 'Show 2020',
        title: 'Show',
        year: 2020,
      }),
      original
    );
  });
});
