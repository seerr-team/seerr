import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

import JellyfinAPI from '@server/api/jellyfin';
import { MediaServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { LinkedAccount } from '@server/entity/LinkedAccount';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings, type OidcProvider } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import { setupTestDb } from '@server/test/db';
import { permissionsOf, seedManagerAndAdmin } from '@server/test/users';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import userRoutes from '.';

const defaultAuthenticateResponse = {
  User: {
    Id: 'jf-link-user-001',
    Name: 'linkeduser',
    ServerId: 'server-1',
    Policy: { IsAdministrator: false },
  },
  AccessToken: 'fake-qc-access-token',
};

const authenticateQCMock = mock.method(
  JellyfinAPI.prototype,
  'authenticateQuickConnect',
  async () => ({ ...defaultAuthenticateResponse })
);

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

function configureJellyfin() {
  const settings = getSettings();
  settings.main.mediaServerType = MediaServerType.JELLYFIN;
  settings.jellyfin.ip = 'localhost';
  settings.jellyfin.port = 8096;
  settings.jellyfin.useSsl = false;
  settings.jellyfin.urlBase = '';
}

async function loginAs(email: string, password: string) {
  const settings = getSettings();
  settings.main.localLogin = true;

  const agent = request.agent(app);
  const res = await agent.post('/auth/local').send({ email, password });

  assert.strictEqual(res.status, 200);
  return { agent, userId: res.body.id as number };
}

describe('POST /user/:id/settings/linked-accounts/jellyfin/quickconnect', () => {
  beforeEach(() => {
    authenticateQCMock.mock.resetCalls();
    authenticateQCMock.mock.mockImplementation(async () => ({
      ...defaultAuthenticateResponse,
    }));
    configureJellyfin();
  });

  it('links the account when the media server is Jellyfin', async () => {
    const { agent, userId } = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent
      .post(`/user/${userId}/settings/linked-accounts/jellyfin/quickconnect`)
      .send({ secret: 'abc123def456abc123def456' });

    assert.strictEqual(res.status, 204);
    assert.strictEqual(authenticateQCMock.mock.callCount(), 1);

    const user = await getRepository(User).findOneOrFail({
      where: { id: userId },
    });
    assert.strictEqual(user.jellyfinUserId, 'jf-link-user-001');
    assert.strictEqual(user.userType, UserType.JELLYFIN);
  });

  it('returns 403 when the media server is Emby', async () => {
    const { agent, userId } = await loginAs('demo@seerr.dev', 'test1234');
    getSettings().main.mediaServerType = MediaServerType.EMBY;

    const res = await agent
      .post(`/user/${userId}/settings/linked-accounts/jellyfin/quickconnect`)
      .send({ secret: 'abc123def456abc123def456' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(authenticateQCMock.mock.callCount(), 0);

    const user = await getRepository(User).findOneOrFail({
      where: { id: userId },
    });
    assert.strictEqual(user.jellyfinUserId, null);
  });
});

describe('POST /user/:id/settings/permissions', () => {
  it('stops a manager from removing admin from another admin', async () => {
    const { otherAdmin } = await seedManagerAndAdmin();
    const { agent } = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent
      .post(`/user/${otherAdmin.id}/settings/permissions`)
      .send({ permissions: Permission.REQUEST });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(await permissionsOf(otherAdmin.id), Permission.ADMIN);
  });
});

describe('POST /user/:id/settings/main', () => {
  it("stops a manager from changing an admin's email", async () => {
    const { otherAdmin } = await seedManagerAndAdmin();
    const { agent } = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent
      .post(`/user/${otherAdmin.id}/settings/main`)
      .send({ username: 'admin2', email: 'new@example.com' });

    assert.strictEqual(res.status, 403);
    const user = await getRepository(User).findOneOrFail({
      where: { id: otherAdmin.id },
    });
    assert.strictEqual(user.email, 'admin2@seerr.dev');
  });

  it("lets the owner change an admin's email", async () => {
    const { otherAdmin } = await seedManagerAndAdmin();
    const { agent } = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent
      .post(`/user/${otherAdmin.id}/settings/main`)
      .send({ username: 'admin2', email: 'new@example.com' });

    assert.strictEqual(res.status, 200);
    const user = await getRepository(User).findOneOrFail({
      where: { id: otherAdmin.id },
    });
    assert.strictEqual(user.email, 'new@example.com');
  });
});

describe('POST /user/:id/settings/password', () => {
  async function passwordUnchanged(userId: number) {
    const user = await getRepository(User).findOneOrFail({
      select: ['id', 'password'],
      where: { id: userId },
    });
    return user.passwordMatch('test1234');
  }

  it('rejects a wrong current password', async () => {
    const { agent, userId } = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent
      .post(`/user/${userId}/settings/password`)
      .send({ currentPassword: 'wrong-password', newPassword: 'new-password' });

    assert.strictEqual(res.status, 403);
    assert.ok(await passwordUnchanged(userId));
  });

  it('rejects a missing current password', async () => {
    const { agent, userId } = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent
      .post(`/user/${userId}/settings/password`)
      .send({ newPassword: 'new-password' });

    assert.strictEqual(res.status, 403);
    assert.ok(await passwordUnchanged(userId));
  });

  it('stops a manager from demoting an admin to reset their password', async () => {
    const { otherAdmin } = await seedManagerAndAdmin();
    const { agent } = await loginAs('demo@seerr.dev', 'test1234');

    const demote = await agent
      .post(`/user/${otherAdmin.id}/settings/permissions`)
      .send({ permissions: Permission.REQUEST });
    const reset = await agent
      .post(`/user/${otherAdmin.id}/settings/password`)
      .send({ newPassword: 'takeover1234' });

    assert.strictEqual(demote.status, 403);
    assert.strictEqual(reset.status, 403);
    const user = await getRepository(User).findOneOrFail({
      select: ['id', 'password'],
      where: { id: otherAdmin.id },
    });
    assert.ok(!user.password);
  });

  it('lets the owner demote an admin and reset their password', async () => {
    const { otherAdmin } = await seedManagerAndAdmin();
    const { agent } = await loginAs('admin@seerr.dev', 'test1234');

    const demote = await agent
      .post(`/user/${otherAdmin.id}/settings/permissions`)
      .send({ permissions: Permission.REQUEST });
    const reset = await agent
      .post(`/user/${otherAdmin.id}/settings/password`)
      .send({ newPassword: 'reset12345' });

    assert.strictEqual(demote.status, 200);
    assert.strictEqual(reset.status, 204);
    const user = await getRepository(User).findOneOrFail({
      select: ['id', 'password'],
      where: { id: otherAdmin.id },
    });
    assert.ok(await user.passwordMatch('reset12345'));
  });
});

const oidcProvider = (slug: string): OidcProvider => ({
  slug,
  name: `Provider ${slug}`,
  logo: `${slug}.png`,
  issuerUrl: 'https://example.com',
  clientId: 'client-id',
  clientSecret: 'client-secret',
});

function configureOidc(providers: OidcProvider[] = [oidcProvider('test')]) {
  const settings = getSettings();
  settings.main.oidcLogin = true;
  settings.oidc.providers = providers;
}

async function createUser(email: string, password?: string) {
  const user = new User({
    email,
    username: email.split('@')[0],
    permissions: Permission.REQUEST,
    userType: UserType.LOCAL,
    avatar: '',
  });

  if (password) {
    await user.setPassword(password);
  }

  return getRepository(User).save(user);
}

async function linkAccount(
  user: User,
  provider = 'test',
  sub = `${user.id}-${provider}`
) {
  return getRepository(LinkedAccount).save(
    new LinkedAccount({
      user,
      provider,
      sub,
      username: `${provider}-user`,
    })
  );
}

async function linkedAccountIds(userId: number) {
  const accounts = await getRepository(LinkedAccount).find({
    where: { user: { id: userId } },
  });
  return accounts.map((account) => account.id).sort((a, b) => a - b);
}

describe('GET /user/:id/settings/linked-accounts', () => {
  it('lists only accounts for active providers', async () => {
    configureOidc();
    const owner = await createUser('links1@seerr.dev');
    const active = await linkAccount(owner, 'test', 'sub-active');
    await linkAccount(owner, 'removed', 'sub-removed');
    const { agent } = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent.get(`/user/${owner.id}/settings/linked-accounts`);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, [
      {
        id: active.id,
        username: 'test-user',
        provider: {
          slug: 'test',
          name: 'Provider test',
          logo: 'test.png',
        },
      },
    ]);
  });

  it('returns an empty list when OIDC login is disabled', async () => {
    configureOidc();
    const owner = await createUser('links2@seerr.dev');
    await linkAccount(owner);
    getSettings().main.oidcLogin = false;
    const { agent } = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent.get(`/user/${owner.id}/settings/linked-accounts`);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, []);
  });

  it("forbids an unrelated user from listing another user's accounts", async () => {
    configureOidc();
    const owner = await createUser('links3@seerr.dev');
    const { agent } = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent.get(`/user/${owner.id}/settings/linked-accounts`);

    assert.strictEqual(res.status, 403);
  });
});

describe('DELETE /user/:id/settings/linked-accounts/:acctId', () => {
  it("stops a manager from unlinking an admin's account", async () => {
    configureOidc();
    getSettings().main.mediaServerType = MediaServerType.PLEX;
    const { otherAdmin } = await seedManagerAndAdmin();
    const account = await linkAccount(otherAdmin, 'test', 'admin-sub');
    const { agent } = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent.delete(
      `/user/${otherAdmin.id}/settings/linked-accounts/${account.id}`
    );

    // The manager passes isOwnProfileOrAdmin but must be stopped by
    // canModifyUser, before the fallback guard would return a 400.
    assert.strictEqual(res.status, 403);
    assert.deepStrictEqual(await linkedAccountIds(otherAdmin.id), [account.id]);
  });

  it("lets the owner unlink an admin's account", async () => {
    configureOidc();
    getSettings().main.mediaServerType = MediaServerType.PLEX;
    const { otherAdmin } = await seedManagerAndAdmin();
    const account = await linkAccount(otherAdmin, 'test', 'admin-sub-1');
    const remaining = await linkAccount(otherAdmin, 'test', 'admin-sub-2');
    const { agent } = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent.delete(
      `/user/${otherAdmin.id}/settings/linked-accounts/${account.id}`
    );

    assert.strictEqual(res.status, 204);
    assert.deepStrictEqual(await linkedAccountIds(otherAdmin.id), [
      remaining.id,
    ]);
  });

  it('lets a user unlink their own account', async () => {
    configureOidc();
    getSettings().main.mediaServerType = MediaServerType.PLEX;
    const owner = await createUser('self@seerr.dev', 'test1234');
    const account = await linkAccount(owner, 'test', 'self-sub-1');
    const remaining = await linkAccount(owner, 'test', 'self-sub-2');
    const { agent } = await loginAs('self@seerr.dev', 'test1234');

    const res = await agent.delete(
      `/user/${owner.id}/settings/linked-accounts/${account.id}`
    );

    assert.strictEqual(res.status, 204);
    assert.deepStrictEqual(await linkedAccountIds(owner.id), [remaining.id]);
  });

  it('refuses to unlink the last active account without a fallback', async () => {
    configureOidc();
    getSettings().main.mediaServerType = MediaServerType.PLEX;
    const owner = await createUser('last@seerr.dev');
    const account = await linkAccount(owner);
    const { agent } = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent.delete(
      `/user/${owner.id}/settings/linked-accounts/${account.id}`
    );

    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(await linkedAccountIds(owner.id), [account.id]);
  });

  it('does not count accounts for inactive providers as a fallback', async () => {
    configureOidc();
    getSettings().main.mediaServerType = MediaServerType.PLEX;
    const owner = await createUser('inactive@seerr.dev');
    const active = await linkAccount(owner, 'test', 'inactive-sub-1');
    const inactive = await linkAccount(owner, 'removed', 'inactive-sub-2');
    const { agent } = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent.delete(
      `/user/${owner.id}/settings/linked-accounts/${active.id}`
    );

    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(await linkedAccountIds(owner.id), [
      active.id,
      inactive.id,
    ]);
  });

  it("does not unlink another user's account", async () => {
    configureOidc();
    getSettings().main.mediaServerType = MediaServerType.PLEX;
    const target = await createUser('target@seerr.dev', 'test1234');
    const other = await createUser('other@seerr.dev', 'test1234');
    const account = await linkAccount(other, 'test', 'other-sub');
    const { agent } = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent.delete(
      `/user/${target.id}/settings/linked-accounts/${account.id}`
    );

    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(await linkedAccountIds(other.id), [account.id]);
  });
});
