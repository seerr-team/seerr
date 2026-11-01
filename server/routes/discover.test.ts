import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import TheMovieDb from '@server/api/themoviedb';
import type { TmdbSearchMovieResponse } from '@server/api/themoviedb/interfaces';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import request from 'supertest';
import discoverRoutes from './discover';

let app: Express;

before(() => {
  app = express();
  app.use(async (req, _res, next) => {
    req.user = await getRepository(User).findOneOrFail({
      where: { email: 'demo@seerr.dev' },
    });
    req.locale = 'en';
    next();
  });
  app.use('/discover', discoverRoutes);
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) =>
      res
        .status(err.status ?? 500)
        .json({ status: err.status ?? 500, message: err.message })
  );
});

setupTestDb();

describe('GET /discover/recommendations', () => {
  it('uses request history and excludes titles the user already requested', async (t) => {
    const user = await getRepository(User).findOneOrFail({
      where: { email: 'demo@seerr.dev' },
    });
    const media = await getRepository(Media).save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 100,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
      })
    );
    await getRepository(MediaRequest).save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.COMPLETED,
        media,
        requestedBy: user,
        is4k: false,
      })
    );
    const getRecommendations = t.mock.method(
      TheMovieDb.prototype,
      'getMovieRecommendations',
      async () =>
        ({
          page: 1,
          total_pages: 1,
          total_results: 2,
          results: [
            {
              id: 100,
              media_type: 'movie',
              title: 'Already Requested',
              original_title: 'Already Requested',
              release_date: '2026-01-01',
              adult: false,
              video: false,
              popularity: 10,
              vote_count: 100,
              vote_average: 7,
              genre_ids: [],
              overview: '',
              original_language: 'en',
            },
            {
              id: 101,
              media_type: 'movie',
              title: 'New Recommendation',
              original_title: 'New Recommendation',
              release_date: '2026-08-01',
              adult: false,
              video: false,
              popularity: 10,
              vote_count: 100,
              vote_average: 7,
              genre_ids: [],
              overview: '',
              original_language: 'en',
            },
          ],
        }) satisfies TmdbSearchMovieResponse
    );

    const res = await request(app).get('/discover/recommendations?page=1');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(getRecommendations.mock.callCount(), 1);
    assert.deepStrictEqual(
      res.body.results.map((result: { id: number }) => result.id),
      [101]
    );
    assert.strictEqual(res.body.totalResults, 1);
  });
});
