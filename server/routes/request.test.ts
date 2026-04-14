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

async function seedRequest(status = MediaRequestStatus.PENDING) {
  const userRepo = getRepository(User);
  const mediaRepo = getRepository(Media);
  const requestRepo = getRepository(MediaRequest);

  const requestedBy = await userRepo.findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });

  const media = await mediaRepo.save(
    new Media({
      mediaType: MediaType.MOVIE,
      tmdbId: 12345,
      status: MediaStatus.UNKNOWN,
      status4k: MediaStatus.UNKNOWN,
    })
  );

  const created = await requestRepo.save(
    new MediaRequest({
      type: MediaType.MOVIE,
      status,
      media,
      requestedBy,
      is4k: false,
      updatedAt: new Date('2025-03-01T00:00:00.000Z'),
    })
  );

  return requestRepo.findOneOrFail({
    where: { id: created.id },
    relations: { requestedBy: true, modifiedBy: true },
  });
}

async function createTestMedia(
  tmdbId: number,
  mediaType: MediaType = MediaType.MOVIE
): Promise<Media> {
  const mediaRepository = getRepository(Media);
  const media = new Media();
  media.tmdbId = tmdbId;
  media.mediaType = mediaType;
  media.status = MediaStatus.UNKNOWN;
  media.status4k = MediaStatus.UNKNOWN;
  return mediaRepository.save(media);
}

async function createMediaRequest(
  user: User,
  media: Media,
  type: MediaType,
  status: MediaRequestStatus = MediaRequestStatus.PENDING,
  is4k = false
): Promise<MediaRequest> {
  const requestRepository = getRepository(MediaRequest);
  const req = new MediaRequest({
    type,
    media,
    requestedBy: user,
    status,
    is4k,
    seasons: [],
  });
  return requestRepository.save(req);
}

describe('GET /request/count', () => {
  it('returns zero counts when no requests exist', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent.get('/request/count');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 0);
    assert.strictEqual(res.body.movie, 0);
    assert.strictEqual(res.body.tv, 0);
    assert.strictEqual(res.body.pending, 0);
    assert.strictEqual(res.body.approved, 0);
    assert.strictEqual(res.body.declined, 0);
    assert.strictEqual(res.body.processing, 0);
    assert.strictEqual(res.body.available, 0);
    assert.strictEqual(res.body.completed, 0);
  });

  it('counts requests by type', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const userRepository = getRepository(User);
    const user = await userRepository.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const movieMedia = await createTestMedia(100001, MediaType.MOVIE);
    const tvMedia = await createTestMedia(100002, MediaType.TV);

    await createMediaRequest(user, movieMedia, MediaType.MOVIE);
    await createMediaRequest(user, movieMedia, MediaType.MOVIE);
    await createMediaRequest(user, tvMedia, MediaType.TV);

    const res = await agent.get('/request/count');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 3);
    assert.strictEqual(res.body.movie, 2);
    assert.strictEqual(res.body.tv, 1);
  });

  it('counts requests by status', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const userRepository = getRepository(User);
    const user = await userRepository.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media1 = await createTestMedia(200001, MediaType.MOVIE);
    const media2 = await createTestMedia(200002, MediaType.MOVIE);
    const media3 = await createTestMedia(200003, MediaType.MOVIE);

    await createMediaRequest(
      user,
      media1,
      MediaType.MOVIE,
      MediaRequestStatus.PENDING
    );
    await createMediaRequest(
      user,
      media2,
      MediaType.MOVIE,
      MediaRequestStatus.APPROVED
    );
    await createMediaRequest(
      user,
      media3,
      MediaType.MOVIE,
      MediaRequestStatus.DECLINED
    );

    const res = await agent.get('/request/count');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 3);
    assert.strictEqual(res.body.pending, 1);
    assert.strictEqual(res.body.approved, 1);
    assert.strictEqual(res.body.declined, 1);
    assert.strictEqual(res.body.completed, 0);
  });

  it('counts processing and available correctly for HD and 4K requests', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const user = await getRepository(User).findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const mediaRepo = getRepository(Media);

    // HD approved, media not yet available (processing)
    const hdProcessing = await createTestMedia(300001, MediaType.MOVIE);
    hdProcessing.status = MediaStatus.PROCESSING;
    await mediaRepo.save(hdProcessing);
    await createMediaRequest(
      user,
      hdProcessing,
      MediaType.MOVIE,
      MediaRequestStatus.APPROVED,
      false
    );

    // HD approved, media available
    const hdAvailable = await createTestMedia(300002, MediaType.MOVIE);
    hdAvailable.status = MediaStatus.AVAILABLE;
    await mediaRepo.save(hdAvailable);
    await createMediaRequest(
      user,
      hdAvailable,
      MediaType.MOVIE,
      MediaRequestStatus.APPROVED,
      false
    );

    // 4K approved, 4K media not yet available (processing)
    const fourKProcessing = await createTestMedia(300003, MediaType.MOVIE);
    fourKProcessing.status4k = MediaStatus.PROCESSING;
    await mediaRepo.save(fourKProcessing);
    await createMediaRequest(
      user,
      fourKProcessing,
      MediaType.MOVIE,
      MediaRequestStatus.APPROVED,
      true
    );

    // 4K approved, 4K media available
    const fourKAvailable = await createTestMedia(300004, MediaType.MOVIE);
    fourKAvailable.status4k = MediaStatus.AVAILABLE;
    await mediaRepo.save(fourKAvailable);
    await createMediaRequest(
      user,
      fourKAvailable,
      MediaType.MOVIE,
      MediaRequestStatus.APPROVED,
      true
    );

    const res = await agent.get('/request/count');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.processing, 2);
    assert.strictEqual(res.body.available, 2);
  });
});

describe('DELETE /request/:requestId', () => {
  it('allows the owner to delete their own pending request', async () => {
    const mediaRequest = await seedRequest();

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 204);
  });

  it('allows an admin to delete any pending request', async () => {
    const mediaRequest = await seedRequest();

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 204);
  });

  it('prevents a non-owner non-admin from deleting a pending request', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    // Create a request owned by admin, then try to delete as friend
    const owner = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 54321,
        status: MediaStatus.UNKNOWN,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const mediaRequest = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.PENDING,
        media,
        requestedBy: owner,
        is4k: false,
      })
    );

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 401);
  });

  it('prevents the owner from deleting an approved request', async () => {
    const mediaRequest = await seedRequest(MediaRequestStatus.APPROVED);

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 401);
  });

  it('returns 404 for a non-existent request', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete('/request/99999999');

    assert.strictEqual(res.status, 404);
  });
});

describe('PUT /request/:requestId (movie)', () => {
  it('persists server and root folder changes to the database', async () => {
    const requestRepo = getRepository(MediaRequest);
    const mediaRequest = await seedRequest();

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.put(`/request/${mediaRequest.id}`).send({
      mediaType: MediaType.MOVIE,
      serverId: 3,
      profileId: 7,
      rootFolder: '/updated/movies',
      tags: [1, 2],
    });

    assert.strictEqual(res.status, 200);

    const saved = await requestRepo.findOneOrFail({
      where: { id: mediaRequest.id },
    });
    assert.strictEqual(saved.serverId, 3);
    assert.strictEqual(saved.profileId, 7);
    assert.strictEqual(saved.rootFolder, '/updated/movies');
  });
});

describe('POST /request/:requestId/:status', () => {
  const cases = [
    { action: 'approve', expected: MediaRequestStatus.APPROVED },
    { action: 'decline', expected: MediaRequestStatus.DECLINED },
  ] as const;

  for (const { action, expected } of cases) {
    it(`transitions to ${action}d and records the acting user`, async () => {
      const repo = getRepository(MediaRequest);
      const pending = await seedRequest();
      const admin = await loginAs('admin@seerr.dev', 'test1234');

      const res = await admin.post(`/request/${pending.id}/${action}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, expected);
      assert.strictEqual(res.body.modifiedBy.email, 'admin@seerr.dev');

      const persisted = await repo.findOneOrFail({
        where: { id: pending.id },
        relations: { modifiedBy: true },
      });

      assert.strictEqual(persisted.status, expected);
      assert.strictEqual(persisted.modifiedBy?.email, 'admin@seerr.dev');
      assert.ok(persisted.updatedAt > pending.updatedAt);
    });
  }
});

describe('POST /request/:requestId/retry', () => {
  it('re-approves a failed request and records the acting user', async () => {
    const repo = getRepository(MediaRequest);
    const failed = await seedRequest(MediaRequestStatus.FAILED);
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${failed.id}/retry`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, MediaRequestStatus.APPROVED);
    assert.strictEqual(res.body.modifiedBy.email, 'admin@seerr.dev');

    const persisted = await repo.findOneOrFail({
      where: { id: failed.id },
      relations: { modifiedBy: true },
    });

    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
    assert.strictEqual(persisted.modifiedBy?.email, 'admin@seerr.dev');
    assert.ok(persisted.updatedAt > failed.updatedAt);
  });
});
