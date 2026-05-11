import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

import { IssueType } from '@server/constants/issue';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Issue from '@server/entity/Issue';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { IssueSubscriber } from '@server/subscriber/IssueSubscriber';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import issueRoutes from './issue';

const sendIssueNotificationMock = mock.method(
  IssueSubscriber.prototype as unknown as {
    sendIssueNotification: (...args: unknown[]) => Promise<void>;
  },
  'sendIssueNotification',
  async () => undefined
).mock;

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
  app.use('/issue', issueRoutes);
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

beforeEach(() => {
  sendIssueNotificationMock.resetCalls();
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

async function seedMedia() {
  return getRepository(Media).save(
    new Media({
      mediaType: MediaType.MOVIE,
      tmdbId: 12345,
      status: MediaStatus.AVAILABLE,
      status4k: MediaStatus.UNKNOWN,
    })
  );
}

describe('POST /issue', () => {
  it('creates an issue on behalf of the supplied userId', async () => {
    const issueRepo = getRepository(Issue);
    const userRepo = getRepository(User);
    const media = await seedMedia();
    const friend = await userRepo.findOneOrFail({
      where: { email: 'demo@seerr.dev' },
    });

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.post('/issue').send({
      issueType: IssueType.VIDEO,
      message: 'Playback stutters near the end.',
      mediaId: media.id,
      problemSeason: 0,
      problemEpisode: 0,
      userId: friend.id,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdBy.email, 'demo@seerr.dev');
    assert.strictEqual(res.body.comments[0].user.email, 'demo@seerr.dev');

    const persisted = await issueRepo.findOneOrFail({
      where: { id: res.body.id },
    });

    assert.strictEqual(persisted.createdBy.id, friend.id);
    assert.strictEqual(persisted.comments[0].user.id, friend.id);
  });

  it('defaults to the authenticated user when userId is omitted', async () => {
    const media = await seedMedia();

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.post('/issue').send({
      issueType: IssueType.AUDIO,
      message: 'Audio is out of sync.',
      mediaId: media.id,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdBy.email, 'admin@seerr.dev');
    assert.strictEqual(res.body.comments[0].user.email, 'admin@seerr.dev');
  });

  it('allows creators to supply their own userId', async () => {
    const userRepo = getRepository(User);
    const media = await seedMedia();
    const friend = await userRepo.findOneOrFail({
      where: { email: 'demo@seerr.dev' },
    });

    friend.permissions = Permission.CREATE_ISSUES;
    await userRepo.save(friend);

    const agent = await loginAs('demo@seerr.dev', 'test1234');
    const res = await agent.post('/issue').send({
      issueType: IssueType.SUBTITLES,
      message: 'Subtitles are missing.',
      mediaId: media.id,
      userId: friend.id,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.createdBy.email, 'demo@seerr.dev');
    assert.strictEqual(res.body.comments[0].user.email, 'demo@seerr.dev');
  });

  it('prevents non-managers from supplying another userId', async () => {
    const userRepo = getRepository(User);
    const media = await seedMedia();
    const friend = await userRepo.findOneOrFail({
      where: { email: 'demo@seerr.dev' },
    });
    const admin = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    friend.permissions = Permission.CREATE_ISSUES;
    await userRepo.save(friend);

    const agent = await loginAs('demo@seerr.dev', 'test1234');
    const res = await agent.post('/issue').send({
      issueType: IssueType.OTHER,
      message: 'Something else is wrong.',
      mediaId: media.id,
      userId: admin.id,
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(
      res.body.message,
      'You do not have permission to create an issue on behalf of another user.'
    );
  });

  it('returns 404 when the supplied userId does not exist', async () => {
    const media = await seedMedia();

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.post('/issue').send({
      issueType: IssueType.OTHER,
      message: 'Something else is wrong.',
      mediaId: media.id,
      userId: 999999,
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.message, 'Issue user not found');
  });
});
