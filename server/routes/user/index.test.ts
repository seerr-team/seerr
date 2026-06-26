import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import PlexTvAPI from '@server/api/plextv';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import userRoutes from '@server/routes/user/index';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

let app: Express;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: 'auto' },
    })
  );
  app.use(checkUser);
  app.use('/auth', authRoutes);
  app.use('/api/v1/user', userRoutes);
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

async function adminAgent() {
  const agent = request.agent(app);
  const settings = getSettings();
  settings.main.localLogin = true;
  const res = await agent
    .post('/auth/local')
    .send({ email: 'admin@seerr.dev', password: 'test1234' });
  assert.strictEqual(res.status, 200);
  return agent;
}

describe('POST /api/v1/user/import-from-plex (default watchlist sync propagation)', () => {
  // Plex.tv ID of the user to import. The seeded admin's plexId is 1, so
  // pick something that does not collide.
  const TARGET_PLEX_ID = 99001;
  const TARGET_USERNAME = 'plex-import-target';
  const TARGET_EMAIL = 'plex-import-target@seerr.dev';

  beforeEach(() => {
    // Plex.tv shared-users response shape - one user available to import.
    mock.method(PlexTvAPI.prototype, 'getUsers', async () => ({
      MediaContainer: {
        User: [
          {
            $: {
              id: String(TARGET_PLEX_ID),
              title: TARGET_USERNAME,
              username: TARGET_USERNAME,
              email: TARGET_EMAIL,
              thumb: 'https://plex.tv/users/avatar.png',
            },
            Server: [],
          },
        ],
      },
    }));
    // Always grant access; the access check is not what we are testing.
    mock.method(PlexTvAPI.prototype, 'checkUserAccess', async () => true);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('propagates defaultWatchlistSync flags = false to imported user', async () => {
    const settings = getSettings();
    settings.main.defaultWatchlistSyncMovies = false;
    settings.main.defaultWatchlistSyncTv = false;

    const agent = await adminAgent();
    const res = await agent
      .post('/api/v1/user/import-from-plex')
      .send({ plexIds: [String(TARGET_PLEX_ID)] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.length, 1, 'expected one imported user');

    const created = await getRepository(User).findOneOrFail({
      where: { email: TARGET_EMAIL },
      relations: { settings: true },
    });
    assert.ok(created.settings, 'expected user.settings to be persisted');
    assert.strictEqual(created.settings.watchlistSyncMovies, false);
    assert.strictEqual(created.settings.watchlistSyncTv, false);
  });

  it('propagates defaultWatchlistSync flags = true to imported user', async () => {
    const settings = getSettings();
    settings.main.defaultWatchlistSyncMovies = true;
    settings.main.defaultWatchlistSyncTv = true;

    const agent = await adminAgent();
    const res = await agent
      .post('/api/v1/user/import-from-plex')
      .send({ plexIds: [String(TARGET_PLEX_ID)] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.length, 1);

    const created = await getRepository(User).findOneOrFail({
      where: { email: TARGET_EMAIL },
      relations: { settings: true },
    });
    assert.ok(created.settings);
    assert.strictEqual(created.settings.watchlistSyncMovies, true);
    assert.strictEqual(created.settings.watchlistSyncTv, true);
  });

  it('propagates mixed defaultWatchlistSync flags (movies=false, tv=true)', async () => {
    const settings = getSettings();
    settings.main.defaultWatchlistSyncMovies = false;
    settings.main.defaultWatchlistSyncTv = true;

    const agent = await adminAgent();
    const res = await agent
      .post('/api/v1/user/import-from-plex')
      .send({ plexIds: [String(TARGET_PLEX_ID)] });

    assert.strictEqual(res.status, 201);

    const created = await getRepository(User).findOneOrFail({
      where: { email: TARGET_EMAIL },
      relations: { settings: true },
    });
    assert.ok(created.settings);
    assert.strictEqual(created.settings.watchlistSyncMovies, false);
    assert.strictEqual(created.settings.watchlistSyncTv, true);
  });
});
