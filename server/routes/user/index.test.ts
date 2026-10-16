import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { Watchlist } from '@server/entity/Watchlist';
import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import { setupTestDb } from '@server/test/db';
import {
  assertNoCredentials,
  seedUserSettings,
} from '@server/test/userSettings';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import userRoutes from '.';

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
  app.use('/user', isAuthenticated(), userRoutes);
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

describe('GET /user/:id/watchlist', () => {
  it('omits notification settings from every requestedBy in the page', async () => {
    const owner = await seedUserSettings('demo@seerr.dev');

    const media = await getRepository(Media).save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 12345,
        status: MediaStatus.UNKNOWN,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    await getRepository(Watchlist).save(
      new Watchlist({
        mediaType: MediaType.MOVIE,
        tmdbId: 12345,
        title: 'Watchlisted Movie',
        ratingKey: 'rk-12345',
        requestedBy: owner,
        media,
      })
    );

    const admin = await loginAs('admin@seerr.dev', 'test1234');
    const res = await admin.get(`/user/${owner.id}/watchlist`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.results.length, 1);
    assert.ok(!('settings' in res.body.results[0].requestedBy));
    assertNoCredentials(res.body);
  });
});

describe('GET /user/:id', () => {
  it('still returns full settings to the user themselves', async () => {
    const owner = await seedUserSettings('demo@seerr.dev');

    const agent = await loginAs('demo@seerr.dev', 'test1234');
    const res = await agent.get(`/user/${owner.id}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.settings.pgpKey, 'test-pgp-key');
    assert.strictEqual(
      res.body.settings.pushoverUserKey,
      'test-pushover-user-key'
    );
  });

  it('still returns full settings to a manage-users admin', async () => {
    const owner = await seedUserSettings('demo@seerr.dev');

    const admin = await loginAs('admin@seerr.dev', 'test1234');
    const res = await admin.get(`/user/${owner.id}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.settings.pgpKey, 'test-pgp-key');
  });

  it('strips settings for an unrelated user', async () => {
    const admin = await getRepository(User).findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    await seedUserSettings('admin@seerr.dev');

    const agent = await loginAs('demo@seerr.dev', 'test1234');
    const res = await agent.get(`/user/${admin.id}`);

    assert.strictEqual(res.status, 200);
    assert.ok(!('settings' in res.body));
    assertNoCredentials(res.body);
  });
});
