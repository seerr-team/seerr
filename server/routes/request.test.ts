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
  const settings = getSettings();
  settings.main.localLogin = true;
});

setupTestDb();

async function authenticatedAgent(email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post('/auth/local').send({ email, password });
  assert.strictEqual(res.status, 200);
  return agent;
}

/** Creates a minimal movie request owned by the given user. */
async function createMovieRequest(
  requestedBy: User,
  status = MediaRequestStatus.PENDING
): Promise<MediaRequest> {
  const mediaRepo = getRepository(Media);
  const requestRepo = getRepository(MediaRequest);

  let media = await mediaRepo.findOne({ where: { tmdbId: 99999 } });
  if (!media) {
    media = new Media();
    media.tmdbId = 99999;
    media.mediaType = MediaType.MOVIE;
    media.status = MediaStatus.UNKNOWN;
    await mediaRepo.save(media);
  }

  const mediaRequest = new MediaRequest({
    media,
    requestedBy,
    status,
    type: MediaType.MOVIE,
    is4k: false,
  });
  return requestRepo.save(mediaRequest);
}

describe('DELETE /request/:requestId', () => {
  it('allows the owner to delete their own pending request', async () => {
    const userRepo = getRepository(User);
    const owner = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    const mediaRequest = await createMovieRequest(owner);

    const agent = await authenticatedAgent('friend@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 204);
  });

  it('allows an admin to delete any pending request', async () => {
    const userRepo = getRepository(User);
    const owner = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    const mediaRequest = await createMovieRequest(owner);

    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 204);
  });

  it('prevents a non-owner non-admin from deleting a pending request', async () => {
    const userRepo = getRepository(User);
    // admin creates the request; friend tries to delete it
    const owner = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const mediaRequest = await createMovieRequest(owner);

    const agent = await authenticatedAgent('friend@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 401);
  });

  it('prevents the owner from deleting an approved request', async () => {
    const userRepo = getRepository(User);
    const owner = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    const mediaRequest = await createMovieRequest(
      owner,
      MediaRequestStatus.APPROVED
    );

    const agent = await authenticatedAgent('friend@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 401);
  });

  it('returns 404 for a non-existent request', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');
    const res = await agent.delete('/request/99999999');

    assert.strictEqual(res.status, 404);
  });
});

describe('PUT /request/:requestId (movie)', () => {
  it('persists server and root folder changes to the database', async () => {
    const userRepo = getRepository(User);
    const requestRepo = getRepository(MediaRequest);
    const owner = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const mediaRequest = await createMovieRequest(owner);

    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');
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
