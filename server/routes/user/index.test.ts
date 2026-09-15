import type { JellyfinUserResponse } from '@server/api/jellyfin';
import JellyfinAPI from '@server/api/jellyfin';
import PlexTvAPI from '@server/api/plextv';
import { MediaServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import request from 'supertest';
import userRoutes from '.';

function jellyfinUser(
  overrides: Partial<JellyfinUserResponse>
): JellyfinUserResponse {
  return {
    Name: 'user',
    ServerId: 'server-1',
    ServerName: 'Test Server',
    Id: 'jf-user-id',
    Configuration: { GroupedFolders: [] },
    Policy: { IsAdministrator: false },
    ...overrides,
  };
}

interface PlexUserFixture {
  id: string;
  title: string;
  username: string;
  email: string;
  thumb: string;
}

function plexUser(overrides: Partial<PlexUserFixture>): {
  $: PlexUserFixture;
  Server: unknown[];
} {
  return {
    $: {
      id: '1',
      title: 'user',
      username: 'user',
      email: 'user@example.com',
      thumb: '/plex-thumb',
      ...overrides,
    },
    Server: [],
  };
}

const getUsersMock = mock.method(
  JellyfinAPI.prototype,
  'getUsers',
  async () => ({
    users: [] as JellyfinUserResponse[],
  })
);

const getPlexUsersMock = mock.method(
  PlexTvAPI.prototype,
  'getUsers',
  async () => ({
    MediaContainer: { User: [] as ReturnType<typeof plexUser>[] },
  })
);

const checkUserAccessMock = mock.method(
  PlexTvAPI.prototype,
  'checkUserAccess',
  async () => true
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

async function adminAgent() {
  const settings = getSettings();
  settings.main.localLogin = true;

  const agent = request.agent(app);
  const res = await agent
    .post('/auth/local')
    .send({ email: 'admin@seerr.dev', password: 'test1234' });

  assert.strictEqual(res.status, 200);
  return agent;
}

describe('POST /user/import-from-jellyfin', () => {
  beforeEach(() => {
    getUsersMock.mock.resetCalls();
    getUsersMock.mock.mockImplementation(async () => ({ users: [] }));
    configureJellyfin();
  });

  const NEW_USER_ID = 'aaaa1111aaaa1111aaaa1111aaaa1111';
  const UNCHECKED_USER_ID = 'bbbb2222bbbb2222bbbb2222bbbb2222';
  const EXISTING_USER_ID = 'cccc3333cccc3333cccc3333cccc3333';
  const EMBY_USER_ID = 'dddd4444dddd4444dddd4444dddd4444';

  it('creates a new user when checked and not already present locally', async () => {
    getUsersMock.mock.mockImplementation(async () => ({
      users: [jellyfinUser({ Id: NEW_USER_ID, Name: 'newuser' })],
    }));

    const agent = await adminAgent();
    const res = await agent
      .post('/user/import-from-jellyfin')
      .send({ jellyfinUserIds: [NEW_USER_ID] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdUsers.length, 1);
    assert.strictEqual(res.body.refreshedUsers, 0);

    const newUser = await getRepository(User).findOneOrFail({
      where: { jellyfinUserId: NEW_USER_ID },
    });
    assert.strictEqual(newUser.jellyfinUsername, 'newuser');
    assert.strictEqual(newUser.userType, UserType.JELLYFIN);
  });

  it('creates a new user when the checked id is provided with dashes (#2338)', async () => {
    getUsersMock.mock.mockImplementation(async () => ({
      users: [jellyfinUser({ Id: NEW_USER_ID, Name: 'dasheduser' })],
    }));

    const dashedNewUserId = `${NEW_USER_ID.slice(0, 8)}-${NEW_USER_ID.slice(8, 12)}-${NEW_USER_ID.slice(12, 16)}-${NEW_USER_ID.slice(16, 20)}-${NEW_USER_ID.slice(20)}`;

    const agent = await adminAgent();
    const res = await agent
      .post('/user/import-from-jellyfin')
      .send({ jellyfinUserIds: [dashedNewUserId] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdUsers.length, 1);

    const newUser = await getRepository(User).findOneOrFail({
      where: { jellyfinUserId: NEW_USER_ID },
    });
    assert.strictEqual(newUser.jellyfinUsername, 'dasheduser');
  });

  it('does not create a user present on the server but not checked', async () => {
    getUsersMock.mock.mockImplementation(async () => ({
      users: [jellyfinUser({ Id: UNCHECKED_USER_ID, Name: 'unchecked' })],
    }));

    const agent = await adminAgent();
    const res = await agent
      .post('/user/import-from-jellyfin')
      .send({ jellyfinUserIds: [] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdUsers.length, 0);

    const user = await getRepository(User).findOne({
      where: { jellyfinUserId: UNCHECKED_USER_ID },
    });
    assert.strictEqual(user, null);
  });

  it('refreshes an existing local user regardless of checkbox selection, without touching unrelated columns', async () => {
    const userRepo = getRepository(User);
    const existingUser = new User({
      email: 'existing@seerr.dev',
      jellyfinUsername: 'oldname',
      jellyfinUserId: EXISTING_USER_ID,
      permissions: Permission.ADMIN,
      avatar: `/avatarproxy/${EXISTING_USER_ID}?v=0`,
      avatarVersion: 'v3',
      userType: UserType.JELLYFIN,
    });
    await userRepo.save(existingUser);

    getUsersMock.mock.mockImplementation(async () => ({
      users: [jellyfinUser({ Id: EXISTING_USER_ID, Name: 'newname' })],
    }));

    const agent = await adminAgent();
    // Not checked in the UI - refresh should still happen, matching Plex's
    // "refresh everything matched, only create what's checked" behavior.
    const res = await agent
      .post('/user/import-from-jellyfin')
      .send({ jellyfinUserIds: [] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdUsers.length, 0);
    assert.strictEqual(res.body.refreshedUsers, 1);

    const updatedUser = await userRepo.findOneOrFail({
      where: { jellyfinUserId: EXISTING_USER_ID },
    });
    assert.strictEqual(updatedUser.jellyfinUsername, 'newname');
    assert.strictEqual(
      updatedUser.avatar,
      `/avatarproxy/${EXISTING_USER_ID}?v=v3`
    );
    assert.strictEqual(updatedUser.permissions, Permission.ADMIN);
  });

  it('skips live users with a malformed (non-GUID) id without error', async () => {
    getUsersMock.mock.mockImplementation(async () => ({
      users: [jellyfinUser({ Id: 'not-a-guid', Name: 'malformed' })],
    }));

    const agent = await adminAgent();
    const res = await agent
      .post('/user/import-from-jellyfin')
      .send({ jellyfinUserIds: ['not-a-guid'] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdUsers.length, 0);
    assert.strictEqual(res.body.refreshedUsers, 0);
  });

  it('creates Emby-typed users when the media server is Emby', async () => {
    getSettings().main.mediaServerType = MediaServerType.EMBY;
    getUsersMock.mock.mockImplementation(async () => ({
      users: [jellyfinUser({ Id: EMBY_USER_ID, Name: 'embyuser' })],
    }));

    const agent = await adminAgent();
    const res = await agent
      .post('/user/import-from-jellyfin')
      .send({ jellyfinUserIds: [EMBY_USER_ID] });

    assert.strictEqual(res.status, 201);

    const newUser = await getRepository(User).findOneOrFail({
      where: { jellyfinUserId: EMBY_USER_ID },
    });
    assert.strictEqual(newUser.userType, UserType.EMBY);
  });

  it('creates users when the request body is omitted entirely', async () => {
    getUsersMock.mock.mockImplementation(async () => ({
      users: [jellyfinUser({ Id: NEW_USER_ID, Name: 'nobodyuser' })],
    }));

    const agent = await adminAgent();
    const res = await agent.post('/user/import-from-jellyfin');

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdUsers.length, 1);

    const newUser = await getRepository(User).findOneOrFail({
      where: { jellyfinUserId: NEW_USER_ID },
    });
    assert.strictEqual(newUser.jellyfinUsername, 'nobodyuser');
  });

  it('returns the createdUsers/refreshedUsers response shape', async () => {
    getUsersMock.mock.mockImplementation(async () => ({ users: [] }));

    const agent = await adminAgent();
    const res = await agent
      .post('/user/import-from-jellyfin')
      .send({ jellyfinUserIds: [] });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(Object.keys(res.body).sort(), [
      'createdUsers',
      'refreshedUsers',
    ]);
  });
});

describe('POST /user/import-from-plex', () => {
  beforeEach(() => {
    getPlexUsersMock.mock.resetCalls();
    getPlexUsersMock.mock.mockImplementation(async () => ({
      MediaContainer: { User: [] },
    }));
    checkUserAccessMock.mock.resetCalls();
    checkUserAccessMock.mock.mockImplementation(async () => true);
  });

  it('creates a new user with a lowercased email regardless of source casing', async () => {
    getPlexUsersMock.mock.mockImplementation(async () => ({
      MediaContainer: {
        User: [
          plexUser({
            id: '9001',
            email: 'NewUser@Example.com',
            username: 'newuser',
          }),
        ],
      },
    }));

    const agent = await adminAgent();
    const res = await agent
      .post('/user/import-from-plex')
      .send({ plexIds: ['9001'] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdUsers.length, 1);

    const newUser = await getRepository(User).findOneOrFail({
      where: { plexId: 9001 },
    });
    assert.strictEqual(newUser.email, 'newuser@example.com');
  });

  it('matches an existing user by plexId even though the live id is a numeric string', async () => {
    const userRepo = getRepository(User);
    const existingUser = new User({
      email: 'old@example.com',
      plexUsername: 'oldname',
      plexId: 9002,
      plexToken: '',
      permissions: 0,
      avatar: '/old-thumb',
      userType: UserType.PLEX,
    });
    await userRepo.save(existingUser);

    getPlexUsersMock.mock.mockImplementation(async () => ({
      MediaContainer: {
        User: [
          plexUser({
            id: '9002',
            email: 'renamed@example.com',
            username: 'renamedname',
          }),
        ],
      },
    }));

    const agent = await adminAgent();
    const res = await agent
      .post('/user/import-from-plex')
      .send({ plexIds: [] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.refreshedUsers, 1);

    const updatedUser = await userRepo.findOneOrFail({
      where: { id: existingUser.id },
    });
    assert.strictEqual(updatedUser.email, 'renamed@example.com');
    assert.strictEqual(updatedUser.plexUsername, 'renamedname');
  });

  it('upgrades a LOCAL account to PLEX and keeps email casing normalized when matched by email', async () => {
    const userRepo = getRepository(User);
    const existingUser = new User({
      email: 'localuser@example.com',
      permissions: 0,
      avatar: '/local-avatar',
      userType: UserType.LOCAL,
    });
    await userRepo.save(existingUser);

    getPlexUsersMock.mock.mockImplementation(async () => ({
      MediaContainer: {
        User: [
          plexUser({
            id: '9003',
            email: 'LocalUser@Example.com',
            username: 'plexname',
          }),
        ],
      },
    }));

    const agent = await adminAgent();
    const res = await agent
      .post('/user/import-from-plex')
      .send({ plexIds: [] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.refreshedUsers, 1);

    const updatedUser = await userRepo.findOneOrFail({
      where: { id: existingUser.id },
    });
    assert.strictEqual(updatedUser.userType, UserType.PLEX);
    assert.strictEqual(updatedUser.plexId, 9003);
    assert.strictEqual(updatedUser.email, 'localuser@example.com');
  });

  it('does not create a user present on the server but not checked', async () => {
    getPlexUsersMock.mock.mockImplementation(async () => ({
      MediaContainer: {
        User: [plexUser({ id: '9004', email: 'unchecked@example.com' })],
      },
    }));

    const agent = await adminAgent();
    const res = await agent
      .post('/user/import-from-plex')
      .send({ plexIds: [] });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdUsers.length, 0);

    const user = await getRepository(User).findOne({
      where: { plexId: 9004 },
    });
    assert.strictEqual(user, null);
  });
});
