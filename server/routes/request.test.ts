import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import requestRoutes from './request';

const sendNotificationMock = mock.method(
  MediaRequest,
  'sendNotification',
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
  app.use('/request', requestRoutes);
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
  sendNotificationMock.resetCalls();
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

async function createPendingRequest() {
  const mediaRepository = getRepository(Media);
  const requestRepository = getRepository(MediaRequest);
  const userRepository = getRepository(User);
  const requestedBy = await userRepository.findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });

  const media = await mediaRepository.save(
    new Media({
      mediaType: MediaType.MOVIE,
      tmdbId: 12345,
      status: MediaStatus.UNKNOWN,
      status4k: MediaStatus.UNKNOWN,
    })
  );

  const seededRequest = await requestRepository.save(
    new MediaRequest({
      type: MediaType.MOVIE,
      status: MediaRequestStatus.PENDING,
      media,
      requestedBy,
      is4k: false,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    })
  );

  return requestRepository.findOneOrFail({
    where: { id: seededRequest.id },
    relations: { requestedBy: true, modifiedBy: true },
  });
}

describe('POST /request/:requestId/:status', () => {
  it('refreshes updatedAt when a request is approved', async () => {
    const requestRepository = getRepository(MediaRequest);
    const pendingRequest = await createPendingRequest();
    const previousUpdatedAt = pendingRequest.updatedAt.toISOString();
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const res = await agent.post(`/request/${pendingRequest.id}/approve`);

    assert.strictEqual(res.status, 200);
    assert.notStrictEqual(res.body.updatedAt, previousUpdatedAt);
    assert.ok(
      new Date(res.body.updatedAt).getTime() >
        new Date(previousUpdatedAt).getTime()
    );
    assert.strictEqual(res.body.modifiedBy.email, 'admin@seerr.dev');

    const savedRequest = await requestRepository.findOneOrFail({
      where: { id: pendingRequest.id },
      relations: { modifiedBy: true },
    });

    assert.strictEqual(savedRequest.status, MediaRequestStatus.APPROVED);
    assert.strictEqual(savedRequest.modifiedBy?.email, 'admin@seerr.dev');
    assert.ok(
      savedRequest.updatedAt.getTime() > pendingRequest.updatedAt.getTime()
    );
  });

  it('refreshes updatedAt when a request is declined', async () => {
    const requestRepository = getRepository(MediaRequest);
    const pendingRequest = await createPendingRequest();
    const previousUpdatedAt = pendingRequest.updatedAt.toISOString();
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const res = await agent.post(`/request/${pendingRequest.id}/decline`);

    assert.strictEqual(res.status, 200);
    assert.notStrictEqual(res.body.updatedAt, previousUpdatedAt);
    assert.ok(
      new Date(res.body.updatedAt).getTime() >
        new Date(previousUpdatedAt).getTime()
    );
    assert.strictEqual(res.body.modifiedBy.email, 'admin@seerr.dev');

    const savedRequest = await requestRepository.findOneOrFail({
      where: { id: pendingRequest.id },
      relations: { modifiedBy: true },
    });

    assert.strictEqual(savedRequest.status, MediaRequestStatus.DECLINED);
    assert.strictEqual(savedRequest.modifiedBy?.email, 'admin@seerr.dev');
    assert.ok(
      savedRequest.updatedAt.getTime() > pendingRequest.updatedAt.getTime()
    );
  });
});
