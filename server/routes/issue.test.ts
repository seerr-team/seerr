import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Issue from '@server/entity/Issue';
import IssueComment from '@server/entity/IssueComment';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
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
  const a = express();
  a.use(express.json());
  a.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  a.use(checkUser);
  a.use('/auth', authRoutes);
  a.use('/issue', issueRoutes);
  a.use(
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
  return a;
}

before(() => {
  app = createApp();
});

setupTestDb();

async function adminAgent() {
  const settings = getSettings();
  settings.main.localLogin = true;
  const agent = request.agent(app);
  await agent
    .post('/auth/local')
    .send({ email: 'admin@seerr.dev', password: 'test1234' });
  return agent;
}

async function seedIssue(
  commentMessages: string[] = ['initial comment']
): Promise<Issue> {
  const mediaRepo = getRepository(Media);
  const userRepo = getRepository(User);
  const issueRepo = getRepository(Issue);

  const user = await userRepo.findOneOrFail({
    where: { email: 'admin@seerr.dev' },
  });

  const media = mediaRepo.create({ tmdbId: 1, mediaType: MediaType.MOVIE });
  await mediaRepo.save(media);

  const issue = issueRepo.create({
    issueType: 1,
    createdBy: user,
    media,
    comments: commentMessages.map(
      (msg) => new IssueComment({ message: msg, user })
    ),
  });
  return issueRepo.save(issue);
}

describe('GET /issue', () => {
  it('includes comments for each issue in the list response', async () => {
    const issue = await seedIssue(['description comment']);
    const agent = await adminAgent();

    const res = await agent.get('/issue');

    assert.strictEqual(res.status, 200);
    const returned = res.body.results.find(
      (i: { id: number }) => i.id === issue.id
    );
    assert.ok(returned, 'seeded issue should appear in list');
    assert.ok(Array.isArray(returned.comments), 'comments should be loaded');
    assert.strictEqual(returned.comments.length, 1);
    assert.strictEqual(returned.comments[0].message, 'description comment');
  });
});

describe('POST /issue/:issueId/comment', () => {
  it('adds a comment to an existing issue', async () => {
    const issue = await seedIssue();
    const agent = await adminAgent();

    const res = await agent
      .post(`/issue/${issue.id}/comment`)
      .send({ message: 'follow-up comment' });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.comments));
    assert.strictEqual(res.body.comments.length, 2);
    assert.strictEqual(res.body.comments[1].message, 'follow-up comment');
  });

  it('returns 500 for a non-existent issue', async () => {
    const agent = await adminAgent();

    const res = await agent
      .post('/issue/99999/comment')
      .send({ message: 'ghost comment' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.message, 'Issue not found.');
  });
});

describe('DELETE /issue/:issueId', () => {
  it('allows the creator to delete an issue with only one comment', async () => {
    const issue = await seedIssue(['only comment']);
    const agent = await adminAgent();

    const res = await agent.delete(`/issue/${issue.id}`);

    assert.strictEqual(res.status, 204);
  });

  it('blocks the creator from deleting an issue that has replies', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const issueRepo = getRepository(Issue);
    const commentRepo = getRepository(IssueComment);

    // Seed a non-admin user as the creator
    const creator = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    const media = mediaRepo.create({ tmdbId: 2, mediaType: MediaType.MOVIE });
    await mediaRepo.save(media);

    const issue = issueRepo.create({
      issueType: 1,
      createdBy: creator,
      media,
    });
    await issueRepo.save(issue);

    // Seed two comments so commentCount > 1
    const admin = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    await commentRepo.save([
      commentRepo.create({ message: 'first', user: creator, issue }),
      commentRepo.create({ message: 'reply from admin', user: admin, issue }),
    ]);

    // Give creator CREATE_ISSUES but not MANAGE_ISSUES so they can reach the route
    // handler but be blocked by the reply-count guard
    creator.permissions = Permission.CREATE_ISSUES;
    await userRepo.save(creator);

    const settings = getSettings();
    settings.main.localLogin = true;
    const friendAgent = request.agent(app);
    await friendAgent
      .post('/auth/local')
      .send({ email: 'friend@seerr.dev', password: 'test1234' });

    const res = await friendAgent.delete(`/issue/${issue.id}`);

    assert.strictEqual(res.status, 401);
  });

  it('allows an admin to delete an issue with multiple comments', async () => {
    const issue = await seedIssue(['first comment', 'reply']);
    const agent = await adminAgent();

    const res = await agent.delete(`/issue/${issue.id}`);

    assert.strictEqual(res.status, 204);
  });
});
