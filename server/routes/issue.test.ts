import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { IssueStatus, IssueType } from '@server/constants/issue';
import { getRepository } from '@server/datasource';
import Issue from '@server/entity/Issue';
import IssueComment from '@server/entity/IssueComment';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import issueRoutes from './issue';

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

setupTestDb();

async function authenticatedAgent(email: string, password: string) {
  const agent = request.agent(app);
  const settings = getSettings();
  settings.main.localLogin = true;

  const res = await agent.post('/auth/local').send({ email, password });
  assert.strictEqual(res.status, 200);
  return agent;
}

async function createTestMedia(): Promise<Media> {
  const mediaRepository = getRepository(Media);
  const { MediaType, MediaStatus } = await import('@server/constants/media');
  const media = new Media();
  media.tmdbId = 999999;
  media.mediaType = MediaType.MOVIE;
  media.status = MediaStatus.UNKNOWN;
  media.status4k = MediaStatus.UNKNOWN;
  return mediaRepository.save(media);
}

async function createIssue(
  user: User,
  media: Media,
  issueType: IssueType,
  status: IssueStatus = IssueStatus.OPEN
): Promise<Issue> {
  const issueRepository = getRepository(Issue);
  const issue = new Issue({
    createdBy: user,
    issueType,
    problemSeason: 0,
    problemEpisode: 0,
    media,
    status,
    comments: [
      new IssueComment({
        user,
        message: 'Test issue comment',
      }),
    ],
  });
  return issueRepository.save(issue);
}

describe('GET /issue/count', () => {
  it('returns zero counts when no issues exist', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const res = await agent.get('/issue/count');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 0);
    assert.strictEqual(res.body.video, 0);
    assert.strictEqual(res.body.audio, 0);
    assert.strictEqual(res.body.subtitles, 0);
    assert.strictEqual(res.body.others, 0);
    assert.strictEqual(res.body.open, 0);
    assert.strictEqual(res.body.closed, 0);
  });

  it('counts issues by type', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const userRepository = getRepository(User);
    const user = await userRepository.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const media = await createTestMedia();

    await createIssue(user, media, IssueType.VIDEO);
    await createIssue(user, media, IssueType.VIDEO);
    await createIssue(user, media, IssueType.AUDIO);
    await createIssue(user, media, IssueType.SUBTITLES);
    await createIssue(user, media, IssueType.OTHER);

    const res = await agent.get('/issue/count');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 5);
    assert.strictEqual(res.body.video, 2);
    assert.strictEqual(res.body.audio, 1);
    assert.strictEqual(res.body.subtitles, 1);
    assert.strictEqual(res.body.others, 1);
  });

  it('counts issues by status', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const userRepository = getRepository(User);
    const user = await userRepository.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const media = await createTestMedia();

    await createIssue(user, media, IssueType.VIDEO, IssueStatus.OPEN);
    await createIssue(user, media, IssueType.AUDIO, IssueStatus.OPEN);
    await createIssue(user, media, IssueType.OTHER, IssueStatus.RESOLVED);

    const res = await agent.get('/issue/count');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 3);
    assert.strictEqual(res.body.open, 2);
    assert.strictEqual(res.body.closed, 1);
  });
});
