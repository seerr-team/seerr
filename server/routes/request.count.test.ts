import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

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

setupTestDb();

async function authenticatedAgent(email: string, password: string) {
  const agent = request.agent(app);
  const settings = getSettings();
  settings.main.localLogin = true;

  const res = await agent.post('/auth/local').send({ email, password });
  assert.strictEqual(res.status, 200);
  return agent;
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
  status: MediaRequestStatus = MediaRequestStatus.PENDING
): Promise<MediaRequest> {
  const requestRepository = getRepository(MediaRequest);
  const req = new MediaRequest({
    type,
    media,
    requestedBy: user,
    status,
    is4k: false,
    seasons: [],
  });
  return requestRepository.save(req);
}

describe('GET /request/count', () => {
  it('returns zero counts when no requests exist', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

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
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

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
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

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
});
