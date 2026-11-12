import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import TheMovieDb from '@server/api/themoviedb';
import type { TmdbMovieDetails } from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import OverrideRule from '@server/entity/OverrideRule';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import type { RadarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import overrideRuleRoutes from './overrideRule';

Object.defineProperty(TheMovieDb.prototype, 'getMovie', {
  get() {
    return async ({ movieId }: { movieId: number }) =>
      ({
        id: movieId,
        genres: [],
        original_language: 'en',
        keywords: { keywords: [] },
        external_ids: {},
      }) as unknown as TmdbMovieDetails;
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
  app.use('/overrideRule', overrideRuleRoutes);
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

describe('POST /overrideRule/advancedRequest', () => {
  it('returns the server default tags plus the rule tags', async () => {
    getSettings().radarr = [
      {
        id: 1,
        name: 'Radarr',
        hostname: 'localhost',
        port: 7878,
        apiKey: 'test-key',
        useSsl: false,
        activeProfileId: 1,
        activeDirectory: '/movies',
        is4k: false,
        isDefault: true,
        tags: [1],
      } as RadarrSettings,
    ];
    await getRepository(OverrideRule).save(
      new OverrideRule({ radarrServiceId: 1, tags: '2' })
    );

    const userRepo = getRepository(User);
    const requester = await userRepo.findOneOrFail({
      where: { email: 'demo@seerr.dev' },
    });
    requester.permissions = Permission.REQUEST | Permission.REQUEST_ADVANCED;
    await userRepo.save(requester);

    const agent = await loginAs('demo@seerr.dev', 'test1234');
    const res = await agent.post('/overrideRule/advancedRequest').send({
      mediaType: MediaType.MOVIE,
      is4k: false,
      tmdbId: 88030,
      requestUser: requester.id,
      serviceId: 1,
    });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.tags, [1, 2]);
  });
});
