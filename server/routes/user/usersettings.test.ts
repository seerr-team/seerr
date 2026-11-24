import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

import JellyfinAPI from '@server/api/jellyfin';
import { MediaServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
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
