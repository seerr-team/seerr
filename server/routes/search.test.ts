import assert from 'node:assert/strict';
import { afterEach, before, describe, it, mock } from 'node:test';
import { resolve } from 'path';

// These are safe to import statically — they don't transitively import TheMovieDb.
import { setupTestDb } from '@server/test/db';
import type {
  TmdbCollectionResult,
  TmdbMovieResult,
  TmdbPersonResult,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import type { Express, Router } from 'express';
import express from 'express';
import request from 'supertest';

// NOTE: search.ts (and TheMovieDb) are NOT imported statically here.
// They are loaded in before() after mock.module() is registered,
// so that TheMovieDb is replaced before search.ts first requires it.
//
// mock.module() uses ESM resolution which cannot resolve @server/* aliases.
// We use the absolute filesystem path so the ESM resolver can find the file,
// and the CJS require cache (keyed by the same absolute path after
// tsconfig-paths resolves @server/api/themoviedb) hits the mock.
const TMDB_MODULE_PATH = resolve(__dirname, '../api/themoviedb/index.ts');

// ─── Result factories ─────────────────────────────────────────────────────────

function paginated<T>(results: T[]) {
  return { page: 1, total_pages: 1, total_results: results.length, results };
}

function makeMovie(overrides?: Partial<TmdbMovieResult>): TmdbMovieResult {
  return {
    id: 1,
    media_type: 'movie',
    title: 'Test Movie',
    original_title: 'Test Movie',
    release_date: '2020-01-01',
    adult: false,
    video: false,
    popularity: 1,
    vote_count: 100,
    vote_average: 7.5,
    genre_ids: [28],
    overview: 'A test movie.',
    original_language: 'en',
    ...overrides,
  };
}

function makeTv(overrides?: Partial<TmdbTvResult>): TmdbTvResult {
  return {
    id: 2,
    media_type: 'tv',
    name: 'Test Show',
    original_name: 'Test Show',
    origin_country: ['US'],
    first_air_date: '2021-03-01',
    popularity: 1,
    vote_count: 50,
    vote_average: 8.0,
    genre_ids: [18],
    overview: 'A test show.',
    original_language: 'en',
    ...overrides,
  };
}

function makePerson(overrides?: Partial<TmdbPersonResult>): TmdbPersonResult {
  return {
    id: 3,
    media_type: 'person',
    name: 'Test Person',
    popularity: 1,
    adult: false,
    known_for: [],
    ...overrides,
  };
}

function makeCollection(
  overrides?: Partial<TmdbCollectionResult>
): TmdbCollectionResult {
  return {
    id: 4,
    media_type: 'collection',
    title: 'Test Collection',
    original_title: 'Test Collection',
    adult: false,
    overview: 'A test collection.',
    original_language: 'en',
    ...overrides,
  };
}

// Minimal object that satisfies mapMovieDetailsToResult() and isMovieDetails().
// isMovieDetails checks `title !== undefined`; mapMovieDetailsToResult reads
// id, title, original_title, genres, overview, release_date, etc.
function makeMovieDetailsMock(id = 10) {
  return {
    id,
    title: 'Details Movie',
    original_title: 'Details Movie',
    release_date: '2019-06-01',
    adult: false,
    video: false,
    popularity: 5,
    vote_count: 200,
    vote_average: 8.0,
    genres: [{ id: 28, name: 'Action' }],
    overview: 'A movie from TMDB details.',
    original_language: 'en',
    backdrop_path: null,
    poster_path: null,
  };
}

// ─── TMDB mock ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAsync = (...args: any[]) => Promise<any>;

interface TmdbImpls {
  searchMulti: AnyAsync;
  searchMovies: AnyAsync;
  searchTvShows: AnyAsync;
  searchPerson: AnyAsync;
  searchCollections: AnyAsync;
  getMovie: AnyAsync;
  getTvShow: AnyAsync;
  getPerson: AnyAsync;
  getByExternalId: AnyAsync;
  searchKeyword: AnyAsync;
  searchCompany: AnyAsync;
}

const notMocked: AnyAsync = async () => {
  throw new Error('unexpected TMDB call — set tmdb.* in the test');
};

function defaultImpls(): TmdbImpls {
  return {
    searchMulti: async () => paginated([]),
    searchMovies: async () => paginated([]),
    searchTvShows: async () => paginated([]),
    searchPerson: async () => paginated([]),
    searchCollections: async () => paginated([]),
    getMovie: notMocked,
    getTvShow: notMocked,
    getPerson: notMocked,
    getByExternalId: async () => ({
      movie_results: [],
      tv_results: [],
      person_results: [],
    }),
    searchKeyword: async () => paginated([]),
    searchCompany: async () => paginated([]),
  };
}

// Mutable object holding the current test's implementations.
// MockTheMovieDb delegates every call here, so tests just assign new functions.
let tmdb = defaultImpls();

class MockTheMovieDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchMulti = (...a: any[]) => tmdb.searchMulti(...a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchMovies = (...a: any[]) => tmdb.searchMovies(...a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchTvShows = (...a: any[]) => tmdb.searchTvShows(...a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchPerson = (...a: any[]) => tmdb.searchPerson(...a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchCollections = (...a: any[]) => tmdb.searchCollections(...a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMovie = (...a: any[]) => tmdb.getMovie(...a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTvShow = (...a: any[]) => tmdb.getTvShow(...a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPerson = (...a: any[]) => tmdb.getPerson(...a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getByExternalId = (...a: any[]) => tmdb.getByExternalId(...a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchKeyword = (...a: any[]) => tmdb.searchKeyword(...a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchCompany = (...a: any[]) => tmdb.searchCompany(...a);
}

// ─── App setup ────────────────────────────────────────────────────────────────

let app: Express;

function createApp(searchRoutes: Router): Express {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    req.locale = 'en';
    next();
  });
  a.use('/search', searchRoutes);
  a.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // We must declare next even though it's unused to satisfy Express's
      // 4-argument error handler signature.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res
        .status(err.status ?? 500)
        .json({ status: err.status ?? 500, message: err.message });
    }
  );
  return a;
}

// mock.module must be called before search.ts (and thus TheMovieDb) is first
// required. By deferring the require to before(), we guarantee the mock is
// registered first. Each test file runs in its own process so the module
// cache is clean.
before(() => {
  mock.module(TMDB_MODULE_PATH, { defaultExport: MockTheMovieDb });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const searchRoutes = (require('./search') as { default: Router }).default;
  app = createApp(searchRoutes);
});

afterEach(() => {
  tmdb = defaultImpls();
});

setupTestDb();

// ─── GET /search ──────────────────────────────────────────────────────────────

describe('GET /search', () => {
  it('returns 400 with message when query param is missing', async () => {
    const res = await request(app).get('/search');

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message, 'query is required.');
  });

  it('calls searchMulti and returns shaped results by default', async () => {
    tmdb.searchMulti = async () =>
      paginated([makeMovie({ id: 10 }), makeTv({ id: 20 })]);

    const res = await request(app).get('/search?query=test');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.page, 1);
    assert.strictEqual(res.body.totalPages, 1);
    assert.strictEqual(res.body.totalResults, 2);
    assert.strictEqual(res.body.results.length, 2);
    assert.strictEqual(res.body.results[0].mediaType, 'movie');
    assert.strictEqual(res.body.results[1].mediaType, 'tv');
  });

  it('calls searchMulti for explicit searchType=all', async () => {
    tmdb.searchMulti = async () => paginated([makeMovie({ id: 11 })]);

    const res = await request(app).get('/search?query=test&searchType=all');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 1);
    assert.strictEqual(res.body.results[0].mediaType, 'movie');
  });

  it('calls searchMovies and tags all results as movie for searchType=movie', async () => {
    tmdb.searchMovies = async () =>
      paginated([makeMovie({ id: 5 }), makeMovie({ id: 6 })]);

    const res = await request(app).get('/search?query=test&searchType=movie');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 2);
    assert.ok(
      (res.body.results as { mediaType: string }[]).every(
        (r) => r.mediaType === 'movie'
      )
    );
  });

  it('calls searchTvShows and tags all results as tv for searchType=tv', async () => {
    tmdb.searchTvShows = async () => paginated([makeTv({ id: 7 })]);

    const res = await request(app).get('/search?query=test&searchType=tv');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 1);
    assert.strictEqual(res.body.results[0].mediaType, 'tv');
  });

  it('calls searchPerson and tags all results as person for searchType=person', async () => {
    tmdb.searchPerson = async () => paginated([makePerson({ id: 8 })]);

    const res = await request(app).get('/search?query=test&searchType=person');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 1);
    assert.strictEqual(res.body.results[0].mediaType, 'person');
  });

  it('calls searchCollections and tags all results as collection for searchType=collection', async () => {
    tmdb.searchCollections = async () => paginated([makeCollection({ id: 9 })]);

    const res = await request(app).get(
      '/search?query=test&searchType=collection'
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 1);
    assert.strictEqual(res.body.results[0].mediaType, 'collection');
  });

  it('falls back to searchMulti for an unrecognised searchType', async () => {
    // Only searchMulti is configured to return data; other methods throw.
    // If the route incorrectly routes to any other method, the test will 500.
    tmdb.searchMulti = async () => paginated([makeMovie({ id: 12 })]);

    const res = await request(app).get(
      '/search?query=test&searchType=invalid'
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 1);
    assert.strictEqual(res.body.results[0].mediaType, 'movie');
  });

  it('returns 500 with message when the TMDB API throws', async () => {
    tmdb.searchMulti = async () => {
      throw new Error('TMDB unavailable');
    };

    const res = await request(app).get('/search?query=test');

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.message, 'Unable to retrieve search results.');
  });
});

// ─── GET /search — special query providers ───────────────────────────────────

describe('GET /search — tmdb: provider', () => {
  it('fetches movie/tv/person by TMDB id and returns matching results', async () => {
    tmdb.getMovie = async () => makeMovieDetailsMock(10);
    // TV and person reject — only the movie result should come back
    tmdb.getTvShow = async () => {
      throw new Error('not found');
    };
    tmdb.getPerson = async () => {
      throw new Error('not found');
    };

    const res = await request(app).get('/search?query=tmdb:10');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 1);
    assert.strictEqual(res.body.results[0].mediaType, 'movie');
    assert.strictEqual(res.body.results[0].id, 10);
  });

  it('returns multiple results when movie, tv, and person all resolve', async () => {
    tmdb.getMovie = async () => makeMovieDetailsMock(10);
    tmdb.getTvShow = async () => ({
      id: 11,
      number_of_seasons: 2,
      name: 'Details Show',
      original_name: 'Details Show',
      first_air_date: '2020-01-01',
      origin_country: ['US'],
      original_language: 'en',
      overview: 'A show.',
      popularity: 3,
      vote_count: 100,
      vote_average: 7.0,
      genres: [],
      backdrop_path: null,
      poster_path: null,
    });
    tmdb.getPerson = async () => ({
      id: 12,
      name: 'Details Person',
      popularity: 2,
      adult: false,
      profile_path: null,
    });

    const res = await request(app).get('/search?query=tmdb:10');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 3);
    const types = (res.body.results as { mediaType: string }[]).map(
      (r) => r.mediaType
    );
    assert.ok(types.includes('movie'));
    assert.ok(types.includes('tv'));
    assert.ok(types.includes('person'));
  });
});

describe('GET /search — imdb: provider', () => {
  it('queries by IMDB id and returns correctly typed results', async () => {
    tmdb.getByExternalId = async () => ({
      movie_results: [makeMovie({ id: 20 })],
      tv_results: [],
      person_results: [],
    });

    const res = await request(app).get('/search?query=imdb:tt0000001');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 1);
    assert.strictEqual(res.body.results[0].mediaType, 'movie');
    assert.strictEqual(res.body.results[0].id, 20);
  });
});

describe('GET /search — tvdb: provider', () => {
  it('queries by TVDB id and returns correctly typed results', async () => {
    tmdb.getByExternalId = async () => ({
      movie_results: [],
      tv_results: [makeTv({ id: 30 })],
      person_results: [],
    });

    const res = await request(app).get('/search?query=tvdb:12345');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 1);
    assert.strictEqual(res.body.results[0].mediaType, 'tv');
    assert.strictEqual(res.body.results[0].id, 30);
  });
});

describe('GET /search — year: provider', () => {
  it('searches movies and TV shows filtered by year', async () => {
    tmdb.searchMovies = async () => paginated([makeMovie({ id: 40 })]);
    tmdb.searchTvShows = async () => paginated([makeTv({ id: 41 })]);

    const res = await request(app).get('/search?query=year:2020');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalResults, 2);
    const types = (res.body.results as { mediaType: string }[]).map(
      (r) => r.mediaType
    );
    assert.ok(types.includes('movie'));
    assert.ok(types.includes('tv'));
  });
});

// ─── GET /search/keyword ──────────────────────────────────────────────────────

describe('GET /search/keyword', () => {
  it('returns keyword results from TMDB', async () => {
    tmdb.searchKeyword = async () =>
      paginated([
        { id: 1, name: 'action' },
        { id: 2, name: 'adventure' },
      ]);

    const res = await request(app).get('/search/keyword?query=act');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total_results, 2);
    assert.strictEqual(res.body.results[0].name, 'action');
    assert.strictEqual(res.body.results[1].name, 'adventure');
  });

  it('returns 500 with message when the TMDB API throws', async () => {
    tmdb.searchKeyword = async () => {
      throw new Error('TMDB unavailable');
    };

    const res = await request(app).get('/search/keyword?query=act');

    assert.strictEqual(res.status, 500);
    assert.strictEqual(
      res.body.message,
      'Unable to retrieve keyword search results.'
    );
  });
});

// ─── GET /search/company ──────────────────────────────────────────────────────

describe('GET /search/company', () => {
  it('returns company results from TMDB', async () => {
    tmdb.searchCompany = async () =>
      paginated([{ id: 1, name: 'Universal Pictures' }]);

    const res = await request(app).get('/search/company?query=universal');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total_results, 1);
    assert.strictEqual(res.body.results[0].name, 'Universal Pictures');
  });

  it('returns 500 with message when the TMDB API throws', async () => {
    tmdb.searchCompany = async () => {
      throw new Error('TMDB unavailable');
    };

    const res = await request(app).get('/search/company?query=universal');

    assert.strictEqual(res.status, 500);
    assert.strictEqual(
      res.body.message,
      'Unable to retrieve company search results.'
    );
  });
});
