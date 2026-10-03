import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import { IssueType } from '@server/constants/issue';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Issue from '@server/entity/Issue';
import IssueComment from '@server/entity/IssueComment';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import movieRoutes from './movie';
import tvRoutes from './tv';

const OWNER_EMAIL = 'owner@seerr.dev';
const OWNER_PLEX_ID = 918273;
const COMMENT_BODY = 'Only visible to issue viewers';

Object.defineProperty(TheMovieDb.prototype, 'getMovie', {
  get() {
    return async ({ movieId }: { movieId: number }) =>
      ({
        id: movieId,
        genres: [],
        original_language: 'en',
        overview: 'overview',
        keywords: { keywords: [] },
        external_ids: {},
        release_dates: { results: [] },
        credits: { cast: [], crew: [] },
        production_companies: [],
        production_countries: [],
        spoken_languages: [],
        videos: { results: [] },
      }) as unknown as TmdbMovieDetails;
  },
  set() {},
  configurable: true,
});

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  get() {
    return async ({ tvId }: { tvId: number }) =>
      ({
        id: tvId,
        genres: [],
        original_language: 'en',
        overview: 'overview',
        keywords: { results: [] },
        external_ids: {},
        content_ratings: { results: [] },
        credits: { cast: [], crew: [] },
        aggregate_credits: { cast: [], crew: [] },
        seasons: [],
        networks: [],
        production_companies: [],
        production_countries: [],
        spoken_languages: [],
        origin_country: [],
        episode_run_time: [],
        created_by: [],
        videos: { results: [] },
      }) as unknown as TmdbTvDetails;
  },
  set() {},
  configurable: true,
});

let app: Express;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(checkUser);
  app.use('/auth', authRoutes);
  app.use('/movie', isAuthenticated(), movieRoutes);
  app.use('/tv', isAuthenticated(), tvRoutes);
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res
        .status(err.status ?? 500)
        .json({ status: err.status ?? 500, message: err.message });
    }
  );
  return app;
}

before(async () => {
  app = createApp();
});

setupTestDb();

async function loginAs(email: string, password: string) {
  const settings = getSettings();
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;

  try {
    const agent = request.agent(app);
    const res = await agent.post('/auth/local').send({ email, password });
    assert.strictEqual(res.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
}

async function setViewerPermissions(permissions: number) {
  const userRepository = getRepository(User);
  const viewer = await userRepository.findOneOrFail({
    where: { email: 'demo@seerr.dev' },
  });
  viewer.permissions = permissions;
  await userRepository.save(viewer);
  return viewer;
}

async function seedMedia(mediaType: MediaType, tmdbId: number) {
  const userRepository = getRepository(User);
  const owner = await userRepository.findOneOrFail({ where: { id: 1 } });
  owner.email = OWNER_EMAIL;
  owner.plexId = OWNER_PLEX_ID;
  await userRepository.save(owner);

  const media = await getRepository(Media).save(
    new Media({
      mediaType,
      tmdbId,
      status: MediaStatus.AVAILABLE,
      status4k: MediaStatus.UNKNOWN,
    })
  );

  await getRepository(MediaRequest).save(
    new MediaRequest({
      type: mediaType,
      media,
      requestedBy: owner,
      modifiedBy: owner,
      status: MediaRequestStatus.APPROVED,
      is4k: false,
    })
  );

  const issue = await getRepository(Issue).save(
    new Issue({
      issueType: IssueType.VIDEO,
      media,
      createdBy: owner,
      problemSeason: 2,
      problemEpisode: 5,
    })
  );

  await getRepository(IssueComment).save(
    new IssueComment({ user: owner, issue, message: COMMENT_BODY })
  );

  return { media, owner };
}

const routes = [
  { path: '/movie', tmdbId: 12345, mediaType: MediaType.MOVIE },
  { path: '/tv', tmdbId: 67890, mediaType: MediaType.TV },
];

for (const { path, tmdbId, mediaType } of routes) {
  describe(`GET ${path}/:id mediaInfo`, () => {
    it('omits the requesting user’s email and plexId', async () => {
      await seedMedia(mediaType, tmdbId);
      await setViewerPermissions(Permission.REQUEST);

      const agent = await loginAs('demo@seerr.dev', 'test1234');
      const res = await agent.get(`${path}/${tmdbId}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.mediaInfo.requests.length, 1);

      const serialized = JSON.stringify(res.body);
      assert.ok(!serialized.includes(OWNER_EMAIL), 'email was serialized');
      assert.ok(
        !serialized.includes(String(OWNER_PLEX_ID)),
        'plexId was serialized'
      );
    });

    it('keeps the request fields the UI renders', async () => {
      await seedMedia(mediaType, tmdbId);
      await setViewerPermissions(Permission.REQUEST);

      const agent = await loginAs('demo@seerr.dev', 'test1234');
      const res = await agent.get(`${path}/${tmdbId}`);

      const { requestedBy } = res.body.mediaInfo.requests[0];
      assert.strictEqual(requestedBy.id, 1);
      assert.strictEqual(typeof requestedBy.displayName, 'string');
      assert.ok('avatar' in requestedBy);
    });

    it('hides issues from a viewer without an issue permission', async () => {
      await seedMedia(mediaType, tmdbId);
      await setViewerPermissions(Permission.REQUEST);

      const agent = await loginAs('demo@seerr.dev', 'test1234');
      const res = await agent.get(`${path}/${tmdbId}`);

      assert.deepStrictEqual(res.body.mediaInfo.issues, []);
      assert.ok(!JSON.stringify(res.body).includes(COMMENT_BODY));
    });

    for (const permission of [
      Permission.MANAGE_ISSUES,
      Permission.VIEW_ISSUES,
      Permission.CREATE_ISSUES,
    ]) {
      it(`returns issues without contents to a viewer with ${Permission[permission]}`, async () => {
        await seedMedia(mediaType, tmdbId);
        await setViewerPermissions(Permission.REQUEST | permission);

        const agent = await loginAs('demo@seerr.dev', 'test1234');
        const res = await agent.get(`${path}/${tmdbId}`);

        assert.strictEqual(res.body.mediaInfo.issues.length, 1);

        const [issue] = res.body.mediaInfo.issues;
        assert.strictEqual(issue.issueType, IssueType.VIDEO);
        assert.ok(!('comments' in issue), 'comments were serialized');
        assert.ok(!('problemSeason' in issue), 'problemSeason was serialized');
        assert.ok(
          !('problemEpisode' in issue),
          'problemEpisode was serialized'
        );

        const serialized = JSON.stringify(res.body);
        assert.ok(!serialized.includes(COMMENT_BODY));
        assert.ok(!serialized.includes(OWNER_EMAIL));
        assert.ok(!serialized.includes(String(OWNER_PLEX_ID)));
      });
    }
  });
}
