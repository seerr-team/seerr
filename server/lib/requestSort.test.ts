import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import {
  getRequestSortColumn,
  isTmdbRequestSort,
  parseRequestSort,
  sortRequestsByTmdbField,
} from '@server/lib/requestSort';

function createRequest(
  id: number,
  tmdbId: number,
  type: MediaType = MediaType.MOVIE
): MediaRequest {
  return {
    id,
    type,
    media: { tmdbId },
  } as MediaRequest;
}

function createTmdbMock(
  movies: Record<
    number,
    {
      original_title: string;
      popularity: number;
      vote_average: number;
      release_date: string;
    }
  > = {},
  tv: Record<
    number,
    {
      original_name: string;
      popularity: number;
      vote_average: number;
      first_air_date: string;
    }
  > = {},
  failingIds: Set<number> = new Set()
) {
  let movieFetchCount = 0;
  let tvFetchCount = 0;

  const tmdb = {
    getMovie: async ({ movieId }: { movieId: number }) => {
      movieFetchCount++;

      if (failingIds.has(movieId) || !movies[movieId]) {
        throw new Error('Movie not found');
      }

      return movies[movieId];
    },
    getTvShow: async ({ tvId }: { tvId: number }) => {
      tvFetchCount++;

      if (failingIds.has(tvId) || !tv[tvId]) {
        throw new Error('TV show not found');
      }

      return tv[tvId];
    },
  };

  return {
    tmdb: tmdb as Pick<TheMovieDb, 'getMovie' | 'getTvShow'>,
    getFetchCounts: () => ({ movieFetchCount, tvFetchCount }),
  };
}

describe('parseRequestSort', () => {
  it('parses all documented sort fields with sortDirection', () => {
    const cases = [
      {
        sort: 'added',
        sortDirection: 'desc',
        field: 'added',
        direction: 'desc',
      },
      { sort: 'added', sortDirection: 'asc', field: 'added', direction: 'asc' },
      {
        sort: 'modified',
        sortDirection: 'desc',
        field: 'modified',
        direction: 'desc',
      },
      {
        sort: 'modified',
        sortDirection: 'asc',
        field: 'modified',
        direction: 'asc',
      },
      {
        sort: 'popularity',
        sortDirection: 'desc',
        field: 'popularity',
        direction: 'desc',
      },
      {
        sort: 'releaseDate',
        sortDirection: 'asc',
        field: 'releaseDate',
        direction: 'asc',
      },
      {
        sort: 'voteAverage',
        sortDirection: 'desc',
        field: 'voteAverage',
        direction: 'desc',
      },
      { sort: 'title', sortDirection: 'asc', field: 'title', direction: 'asc' },
    ] as const;

    for (const { sort, sortDirection, field, direction } of cases) {
      assert.deepEqual(parseRequestSort(sort, sortDirection), {
        field,
        direction,
      });
    }
  });

  it('defaults to added desc when sort or sortDirection are omitted', () => {
    assert.deepEqual(parseRequestSort('added'), {
      field: 'added',
      direction: 'desc',
    });
    assert.deepEqual(parseRequestSort(undefined, undefined), {
      field: 'added',
      direction: 'desc',
    });
  });

  it('defaults unknown sort values to added', () => {
    assert.deepEqual(parseRequestSort('popularity.desc', 'asc'), {
      field: 'added',
      direction: 'asc',
    });
  });
});

describe('isTmdbRequestSort', () => {
  it('identifies TMDB-backed sort fields', () => {
    assert.equal(isTmdbRequestSort('popularity'), true);
    assert.equal(isTmdbRequestSort('releaseDate'), true);
    assert.equal(isTmdbRequestSort('voteAverage'), true);
    assert.equal(isTmdbRequestSort('title'), true);
    assert.equal(isTmdbRequestSort('added'), false);
    assert.equal(isTmdbRequestSort('modified'), false);
  });
});

describe('getRequestSortColumn', () => {
  it('maps request date and modified date to database columns', () => {
    assert.equal(getRequestSortColumn('added'), 'request.createdAt');
    assert.equal(getRequestSortColumn('modified'), 'request.updatedAt');
  });
});

describe('sortRequestsByTmdbField', () => {
  it('fetches TMDB data only once per unique type-tmdbId key', async () => {
    const { tmdb, getFetchCounts } = createTmdbMock({
      100: {
        original_title: 'Shared Movie',
        popularity: 10,
        vote_average: 7,
        release_date: '2020-01-01',
      },
    });

    const requests = [
      createRequest(1, 100),
      createRequest(2, 100),
      createRequest(3, 101, MediaType.TV),
    ];

    await sortRequestsByTmdbField(requests, 'title', 'asc', tmdb);

    assert.equal(getFetchCounts().movieFetchCount, 1);
    assert.equal(getFetchCounts().tvFetchCount, 1);
  });

  it('places requests without TMDB data at the end', async () => {
    const { tmdb } = createTmdbMock({
      100: {
        original_title: 'Alpha',
        popularity: 10,
        vote_average: 7,
        release_date: '2020-01-01',
      },
    });

    const requests = [
      createRequest(1, 999),
      createRequest(2, 100),
      createRequest(3, 998),
    ];

    const sorted = await sortRequestsByTmdbField(
      requests,
      'title',
      'asc',
      tmdb
    );

    assert.deepEqual(
      sorted.map((request) => request.id),
      [2, 1, 3]
    );
  });

  it('sorts by each TMDB field in ascending and descending order', async () => {
    const { tmdb } = createTmdbMock({
      1: {
        original_title: 'Alpha',
        popularity: 10,
        vote_average: 5,
        release_date: '2020-01-01',
      },
      2: {
        original_title: 'Zulu',
        popularity: 20,
        vote_average: 9,
        release_date: '2022-01-01',
      },
    });

    const requests = [createRequest(2, 2), createRequest(1, 1)];

    const titleAsc = await sortRequestsByTmdbField(
      requests,
      'title',
      'asc',
      tmdb
    );
    const titleDesc = await sortRequestsByTmdbField(
      requests,
      'title',
      'desc',
      tmdb
    );
    const popularityAsc = await sortRequestsByTmdbField(
      requests,
      'popularity',
      'asc',
      tmdb
    );
    const popularityDesc = await sortRequestsByTmdbField(
      requests,
      'popularity',
      'desc',
      tmdb
    );
    const voteAverageAsc = await sortRequestsByTmdbField(
      requests,
      'voteAverage',
      'asc',
      tmdb
    );
    const voteAverageDesc = await sortRequestsByTmdbField(
      requests,
      'voteAverage',
      'desc',
      tmdb
    );
    const releaseDateAsc = await sortRequestsByTmdbField(
      requests,
      'releaseDate',
      'asc',
      tmdb
    );
    const releaseDateDesc = await sortRequestsByTmdbField(
      requests,
      'releaseDate',
      'desc',
      tmdb
    );

    assert.deepEqual(
      titleAsc.map((request) => request.id),
      [1, 2]
    );
    assert.deepEqual(
      titleDesc.map((request) => request.id),
      [2, 1]
    );
    assert.deepEqual(
      popularityAsc.map((request) => request.id),
      [1, 2]
    );
    assert.deepEqual(
      popularityDesc.map((request) => request.id),
      [2, 1]
    );
    assert.deepEqual(
      voteAverageAsc.map((request) => request.id),
      [1, 2]
    );
    assert.deepEqual(
      voteAverageDesc.map((request) => request.id),
      [2, 1]
    );
    assert.deepEqual(
      releaseDateAsc.map((request) => request.id),
      [1, 2]
    );
    assert.deepEqual(
      releaseDateDesc.map((request) => request.id),
      [2, 1]
    );
  });

  it('uses request id as a directional tie-breaker', async () => {
    const { tmdb } = createTmdbMock({
      100: {
        original_title: 'Same Title',
        popularity: 10,
        vote_average: 7,
        release_date: '2020-01-01',
      },
      101: {
        original_title: 'Same Title',
        popularity: 10,
        vote_average: 7,
        release_date: '2020-01-01',
      },
    });

    const requests = [createRequest(5, 101), createRequest(2, 100)];

    const asc = await sortRequestsByTmdbField(requests, 'title', 'asc', tmdb);
    const desc = await sortRequestsByTmdbField(requests, 'title', 'desc', tmdb);

    assert.deepEqual(
      asc.map((request) => request.id),
      [2, 5]
    );
    assert.deepEqual(
      desc.map((request) => request.id),
      [5, 2]
    );
  });

  it('handles TMDB fetch failures gracefully', async () => {
    const { tmdb } = createTmdbMock(
      {
        100: {
          original_title: 'Available',
          popularity: 10,
          vote_average: 7,
          release_date: '2020-01-01',
        },
      },
      {},
      new Set([200])
    );

    const requests = [
      createRequest(1, 200),
      createRequest(2, 100),
      createRequest(3, 200),
    ];

    const sorted = await sortRequestsByTmdbField(
      requests,
      'popularity',
      'desc',
      tmdb
    );

    assert.deepEqual(
      sorted.map((request) => request.id),
      [2, 3, 1]
    );
  });
});
