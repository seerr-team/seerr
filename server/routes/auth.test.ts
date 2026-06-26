import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import PlexTvAPI from '@server/api/plextv';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { UserSettings } from '@server/entity/UserSettings';
import PreparedEmail from '@server/lib/email';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';

const emailMock = mock.method(PreparedEmail.prototype, 'send', async () => {
  return undefined;
}).mock;

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
  // Error handler matching how next({ status, message }) calls are handled
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // We must provide a next function for the function signature here even though its not used
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

/** Create a supertest agent that is logged in as the given user. */
async function authenticatedAgent(email: string, password: string) {
  const agent = request.agent(app);
  const settings = getSettings();
  settings.main.localLogin = true;

  const res = await agent.post('/auth/local').send({ email, password });

  assert.strictEqual(res.status, 200);
  return agent;
}

describe('GET /auth/me', () => {
  it('returns 403 when not authenticated', async () => {
    const res = await request(app).get('/auth/me');
    assert.strictEqual(res.status, 403);
  });

  it('returns the authenticated user', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const res = await agent.get('/auth/me');

    assert.strictEqual(res.status, 200);
    assert.ok('id' in res.body);
    assert.strictEqual(res.body.displayName, 'admin');
  });

  it('includes userEmailRequired warning when email is required but invalid', async () => {
    const settings = getSettings();
    settings.notifications.agents.email.options.userEmailRequired = true;

    // Change the user's email to something invalid
    const userRepo = getRepository(User);
    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    user.email = 'not-an-email';
    await userRepo.save(user);

    // Log in with the changed email
    const agent = request.agent(app);
    settings.main.localLogin = true;
    const loginRes = await agent
      .post('/auth/local')
      .send({ email: 'not-an-email', password: 'test1234' });
    assert.strictEqual(loginRes.status, 200);

    const res = await agent.get('/auth/me');

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.warnings.includes('userEmailRequired'));

    settings.notifications.agents.email.options.userEmailRequired = false;
  });
});

describe('POST /auth/local', () => {
  beforeEach(() => {
    const settings = getSettings();
    settings.main.localLogin = true;
  });

  it('returns 200 and user data on valid credentials', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'test1234' });

    assert.strictEqual(res.status, 200);
    assert.ok('id' in res.body);
    // filter() strips sensitive fields like password
    assert.ok(!('password' in res.body));
  });

  it('returns 403 on wrong password', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'wrongpassword' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.message, 'Access denied.');
  });

  it('returns 403 for nonexistent user', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'nobody@seerr.dev', password: 'test1234' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.message, 'Access denied.');
  });

  it('returns 500 when local login is disabled', async () => {
    const settings = getSettings();
    settings.main.localLogin = false;

    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'test1234' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.error, 'Password sign-in is disabled.');
  });

  it('returns 500 when email is missing', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ password: 'test1234' });

    assert.strictEqual(res.status, 500);
    assert.match(res.body.error, /email address and a password/);
  });

  it('returns 500 when password is missing', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev' });

    assert.strictEqual(res.status, 500);
    assert.match(res.body.error, /email address and a password/);
  });

  it('is case-insensitive for email', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'Admin@Seerr.Dev', password: 'test1234' });

    assert.strictEqual(res.status, 200);
    assert.ok('id' in res.body);
  });

  it('allows the non-admin user to log in', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'friend@seerr.dev', password: 'test1234' });

    assert.strictEqual(res.status, 200);
    assert.ok('id' in res.body);
  });

  it('sets a session on successful login', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'test1234' });

    // Session should persist — /me should succeed
    const meRes = await agent.get('/auth/me');
    assert.strictEqual(meRes.status, 200);
  });
});

describe('POST /auth/logout', () => {
  it('returns 200 when not logged in', async () => {
    const res = await request(app).post('/auth/logout');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  it('destroys session and returns 200 when logged in', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    // Verify session is active
    const meBeforeRes = await agent.get('/auth/me');
    assert.strictEqual(meBeforeRes.status, 200);

    const logoutRes = await agent.post('/auth/logout');
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutRes.body.status, 'ok');

    // Session should be invalidated — /me should fail
    const meAfterRes = await agent.get('/auth/me');
    assert.strictEqual(meAfterRes.status, 403);
  });
});

describe('POST /auth/reset-password', () => {
  beforeEach(() => {
    emailMock.resetCalls();
  });

  it('returns 200 for a valid email', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: 'admin@seerr.dev' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(emailMock.callCount(), 1);
  });

  it('returns 200 for nonexistent email (does not reveal user existence)', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: 'nonexistent@seerr.dev' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(emailMock.callCount(), 0);
  });

  it('returns 500 when email is missing', async () => {
    const res = await request(app).post('/auth/reset-password').send({});

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.message, 'Email address required.');
    assert.strictEqual(emailMock.callCount(), 0);
  });

  it('sets a resetPasswordGuid on the user', async () => {
    await request(app)
      .post('/auth/reset-password')
      .send({ email: 'admin@seerr.dev' });

    const userRepo = getRepository(User);
    const user = await userRepo
      .createQueryBuilder('user')
      .addSelect(['user.resetPasswordGuid', 'user.recoveryLinkExpirationDate'])
      .where('user.email = :email', { email: 'admin@seerr.dev' })
      .getOneOrFail();

    assert.notStrictEqual(user.resetPasswordGuid, undefined);
    assert.notStrictEqual(user.resetPasswordGuid, null);
    assert.notStrictEqual(user.recoveryLinkExpirationDate, undefined);
    assert.strictEqual(emailMock.callCount(), 1);
  });
});

describe('POST /auth/reset-password/:guid', () => {
  /** Trigger a password reset and return the guid. */
  async function getResetGuid(email: string): Promise<string> {
    await request(app).post('/auth/reset-password').send({ email });

    const userRepo = getRepository(User);
    const user = await userRepo
      .createQueryBuilder('user')
      .addSelect('user.resetPasswordGuid')
      .where('user.email = :email', { email })
      .getOneOrFail();

    return user.resetPasswordGuid!;
  }

  it('resets password with a valid guid and password', async () => {
    const guid = await getResetGuid('admin@seerr.dev');

    const res = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({ password: 'newpassword123' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');

    // Old password no longer works
    const oldLogin = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'test1234' });
    assert.strictEqual(oldLogin.status, 403);

    // New password works
    const newLogin = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'newpassword123' });
    assert.strictEqual(newLogin.status, 200);
  });

  it('returns 500 for an invalid guid', async () => {
    const res = await request(app)
      .post('/auth/reset-password/invalid-guid-here')
      .send({ password: 'newpassword123' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.message, 'Invalid password reset link.');
  });

  it('returns 500 when password is too short', async () => {
    const guid = await getResetGuid('admin@seerr.dev');

    const res = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({ password: 'short' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(
      res.body.message,
      'Password must be at least 8 characters long.'
    );
  });

  it('returns 500 when password is missing', async () => {
    const guid = await getResetGuid('admin@seerr.dev');

    const res = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({});

    assert.strictEqual(res.status, 500);
    assert.strictEqual(
      res.body.message,
      'Password must be at least 8 characters long.'
    );
  });

  it('returns 500 for an expired recovery link', async () => {
    const guid = await getResetGuid('admin@seerr.dev');

    // Expire the link
    const userRepo = getRepository(User);
    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    user.recoveryLinkExpirationDate = new Date('2020-01-01');
    await userRepo.save(user);

    const res = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({ password: 'newpassword123' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.message, 'Invalid password reset link.');
  });

  it('cannot reuse a guid after successful reset', async () => {
    const guid = await getResetGuid('admin@seerr.dev');

    // First reset succeeds
    const first = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({ password: 'newpassword123' });
    assert.strictEqual(first.status, 200);

    // Second reset with same guid fails (recoveryLinkExpirationDate was cleared)
    const second = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({ password: 'anotherpassword' });
    assert.strictEqual(second.status, 500);
  });
});

describe('POST /auth/plex (new user creation)', () => {
  // The PlexTvAPI is constructed inside the route handler, so we mock its
  // prototype methods. checkUserAccess returning true makes the route create
  // a new Seerr user; getUser returns the Plex.tv account that the auth
  // token belongs to.
  const PLEX_ACCOUNT_ID = 99999;
  const PLEX_USERNAME = 'newplexuser';
  const PLEX_EMAIL = 'newplexuser@seerr.dev';

  beforeEach(() => {
    const settings = getSettings();
    settings.main.newPlexLogin = true;
    settings.main.mediaServerType = 1; // PLEX
    settings.main.mediaServerLogin = true;

    mock.method(PlexTvAPI.prototype, 'getUser', async () => ({
      id: PLEX_ACCOUNT_ID,
      uuid: 'test-uuid',
      email: PLEX_EMAIL,
      joined_at: '2024-01-01',
      username: PLEX_USERNAME,
      title: PLEX_USERNAME,
      thumb: 'https://plex.tv/users/avatar.png',
      hasPassword: true,
      authToken: 'plex-auth-token',
      subscription: { active: false, status: '', plan: '', features: [] },
      roles: { roles: [] },
      entitlements: [],
    }));
    mock.method(PlexTvAPI.prototype, 'checkUserAccess', async () => true);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('propagates defaultWatchlistSync flags = false to a newly created user', async () => {
    const settings = getSettings();
    settings.main.defaultWatchlistSyncMovies = false;
    settings.main.defaultWatchlistSyncTv = false;

    const res = await request(app)
      .post('/auth/plex')
      .send({ authToken: 'plex-auth-token' });

    assert.strictEqual(
      res.status,
      200,
      `unexpected status ${res.status}: ${JSON.stringify(res.body)}`
    );

    const userRepo = getRepository(User);
    const created = await userRepo.findOneOrFail({
      where: { email: PLEX_EMAIL },
      relations: { settings: true },
    });

    assert.ok(created.settings, 'expected user.settings to be persisted');
    assert.strictEqual(created.settings.watchlistSyncMovies, false);
    assert.strictEqual(created.settings.watchlistSyncTv, false);
  });

  it('propagates defaultWatchlistSync flags = true to a newly created user', async () => {
    const settings = getSettings();
    settings.main.defaultWatchlistSyncMovies = true;
    settings.main.defaultWatchlistSyncTv = true;

    const res = await request(app)
      .post('/auth/plex')
      .send({ authToken: 'plex-auth-token' });

    assert.strictEqual(res.status, 200);

    const userRepo = getRepository(User);
    const created = await userRepo.findOneOrFail({
      where: { email: PLEX_EMAIL },
      relations: { settings: true },
    });

    assert.ok(created.settings, 'expected user.settings to be persisted');
    assert.strictEqual(created.settings.watchlistSyncMovies, true);
    assert.strictEqual(created.settings.watchlistSyncTv, true);
  });

  it('propagates mixed defaultWatchlistSync flags (movies=true, tv=false)', async () => {
    const settings = getSettings();
    settings.main.defaultWatchlistSyncMovies = true;
    settings.main.defaultWatchlistSyncTv = false;

    const res = await request(app)
      .post('/auth/plex')
      .send({ authToken: 'plex-auth-token' });

    assert.strictEqual(res.status, 200);

    const userRepo = getRepository(User);
    const created = await userRepo.findOneOrFail({
      where: { email: PLEX_EMAIL },
      relations: { settings: true },
    });

    assert.ok(created.settings);
    assert.strictEqual(created.settings.watchlistSyncMovies, true);
    assert.strictEqual(created.settings.watchlistSyncTv, false);
  });

  it('does not overwrite settings when an existing user signs in via Plex', async () => {
    // Pre-create a user with explicit non-default sync settings, then sign
    // them in via Plex - their existing settings should be preserved (the
    // defaults are only applied on user CREATION).
    const userRepo = getRepository(User);
    const existing = new User({
      email: PLEX_EMAIL,
      plexUsername: PLEX_USERNAME,
      plexId: PLEX_ACCOUNT_ID,
      plexToken: 'old-token',
      permissions: 32,
      avatar: '',
      userType: 1,
    });
    await userRepo.save(existing);
    existing.settings = new UserSettings({
      watchlistSyncMovies: true,
      watchlistSyncTv: true,
    });
    await userRepo.save(existing);

    // Set MainSettings defaults to false; existing user's true should win
    const settings = getSettings();
    settings.main.defaultWatchlistSyncMovies = false;
    settings.main.defaultWatchlistSyncTv = false;

    const res = await request(app)
      .post('/auth/plex')
      .send({ authToken: 'plex-auth-token' });

    assert.strictEqual(res.status, 200);

    const refreshed = await userRepo.findOneOrFail({
      where: { email: PLEX_EMAIL },
      relations: { settings: true },
    });
    assert.strictEqual(refreshed.settings?.watchlistSyncMovies, true);
    assert.strictEqual(refreshed.settings?.watchlistSyncTv, true);
  });
});
