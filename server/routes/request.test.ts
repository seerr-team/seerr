import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import OverrideRule from '@server/entity/OverrideRule';
import Season from '@server/entity/Season';
import SeasonRequest from '@server/entity/SeasonRequest';
import { User } from '@server/entity/User';
import { Notification } from '@server/lib/notifications';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
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

const getMovieImpl: (args: {
  movieId: number;
  language?: string;
}) => Promise<TmdbMovieDetails> = async ({ movieId }) => fakeTmdbMovie(movieId);

Object.defineProperty(TheMovieDb.prototype, 'getMovie', {
  get() {
    return async (args: { movieId: number; language?: string }) =>
      getMovieImpl(args);
  },
  set() {},
  configurable: true,
});

const getTvShowImpl: (args: {
  tvId: number;
  language?: string;
}) => Promise<TmdbTvDetails> = async ({ tvId }) => fakeTmdbShow(tvId);

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  get() {
    return async (args: { tvId: number; language?: string }) =>
      getTvShowImpl(args);
  },
  set() {},
  configurable: true,
});

function fakeTmdbMovie(tmdbId: number): TmdbMovieDetails {
  return {
    id: tmdbId,
    genres: [],
    original_language: 'en',
    keywords: { keywords: [] },
    external_ids: {},
  } as unknown as TmdbMovieDetails;
}

function fakeTmdbShow(tmdbId: number): TmdbTvDetails {
  return {
    id: tmdbId,
    genres: [],
    original_language: 'en',
    keywords: { results: [] },
    external_ids: {},
  } as unknown as TmdbTvDetails;
}

function configureRadarr(overrides: Partial<RadarrSettings>[]): void {
  const settings = getSettings();
  settings.radarr = overrides.map((o, i) => ({
    id: i,
    name: `Radarr ${i}`,
    hostname: 'localhost',
    port: 7878,
    apiKey: 'test-key',
    baseUrl: '',
    useSsl: false,
    activeProfileId: 1,
    activeDirectory: '/movies',
    is4k: false,
    minimumAvailability: 'released',
    tags: [],
    isDefault: i === 0,
    syncEnabled: true,
    preventSearch: false,
    externalUrl: '',
    ...o,
  })) as RadarrSettings[];
}

function configureSonarr(overrides: Partial<SonarrSettings>[]): void {
  const settings = getSettings();
  settings.sonarr = overrides.map((o, i) => ({
    id: i,
    name: `Sonarr ${i}`,
    hostname: 'localhost',
    port: 8989,
    apiKey: 'test-key',
    baseUrl: '',
    useSsl: false,
    activeProfileId: 1,
    activeDirectory: '/tv',
    activeLanguageProfileId: 1,
    animeTags: [],
    is4k: false,
    enableSeasonFolders: true,
    tags: [],
    isDefault: i === 0,
    syncEnabled: true,
    preventSearch: false,
    externalUrl: '',
    ...o,
  })) as SonarrSettings[];
}

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

async function seedRequest(
  status = MediaRequestStatus.PENDING,
  overrides: Partial<MediaRequest> = {}
) {
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
      ...overrides,
    })
  );

  return requestRepo.findOneOrFail({
    where: { id: created.id },
    relations: { requestedBy: true, modifiedBy: true, media: true },
  });
}

async function seedTvRequest(
  status = MediaRequestStatus.PENDING,
  overrides: Partial<MediaRequest> = {}
) {
  const userRepo = getRepository(User);
  const mediaRepo = getRepository(Media);
  const requestRepo = getRepository(MediaRequest);

  const requestedBy = await userRepo.findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });

  const media = await mediaRepo.save(
    new Media({
      mediaType: MediaType.TV,
      tmdbId: 67890,
      status: MediaStatus.UNKNOWN,
      status4k: MediaStatus.UNKNOWN,
    })
  );

  const created = await requestRepo.save(
    new MediaRequest({
      type: MediaType.TV,
      status,
      media,
      requestedBy,
      is4k: false,
      seasons: [new SeasonRequest({ seasonNumber: 1, status })],
      updatedAt: new Date('2025-03-01T00:00:00.000Z'),
      ...overrides,
    })
  );

  return requestRepo.findOneOrFail({
    where: { id: created.id },
    relations: {
      requestedBy: true,
      modifiedBy: true,
      media: true,
      seasons: true,
    },
  });
}

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

  it('refuses to modify a request that is neither pending nor failed', async () => {
    const requestRepo = getRepository(MediaRequest);
    const mediaRequest = await seedRequest(MediaRequestStatus.APPROVED);

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.put(`/request/${mediaRequest.id}`).send({
      mediaType: MediaType.MOVIE,
      serverId: 3,
      rootFolder: '/updated/movies',
    });

    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /pending or failed/i);

    const saved = await requestRepo.findOneOrFail({
      where: { id: mediaRequest.id },
    });
    assert.strictEqual(saved.serverId, null);
    assert.strictEqual(saved.rootFolder, null);
  });
});

describe('PUT /request/:requestId, failed request', () => {
  afterEach(() => {
    const settings = getSettings();
    settings.radarr = [];
    settings.sonarr = [];
  });

  it('lets a manager repoint a failed request and resubmits it', async () => {
    configureRadarr([{ id: 2, isDefault: true, is4k: false }]);
    const failed = await seedRequest(MediaRequestStatus.FAILED, {
      serverId: 999,
    });
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.put(`/request/${failed.id}`).send({
      mediaType: MediaType.MOVIE,
      serverId: 2,
      profileId: 7,
      rootFolder: '/movies',
      tags: [],
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.serverId, 2);
    assert.strictEqual(res.body.modifiedBy.email, 'admin@seerr.dev');
  });

  it('rejects a failed-request edit that still points at a missing server', async () => {
    configureRadarr([{ id: 2, isDefault: true, is4k: false }]);
    const requestRepo = getRepository(MediaRequest);
    const failed = await seedRequest(MediaRequestStatus.FAILED, {
      serverId: 999,
    });
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.put(`/request/${failed.id}`).send({
      mediaType: MediaType.MOVIE,
      serverId: 998,
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /not configured/i);

    const saved = await requestRepo.findOneOrFail({ where: { id: failed.id } });
    assert.strictEqual(saved.status, MediaRequestStatus.FAILED);
    assert.strictEqual(saved.serverId, 999);
  });

  it('forbids a non-manager from modifying a failed request', async () => {
    const requestRepo = getRepository(MediaRequest);
    const failed = await seedTvRequest(MediaRequestStatus.FAILED, {
      serverId: 999,
    });
    const friend = await loginAs('friend@seerr.dev', 'test1234');

    const res = await friend.put(`/request/${failed.id}`).send({
      mediaType: MediaType.TV,
      serverId: 2,
      seasons: [1],
    });

    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /manager/i);

    const saved = await requestRepo.findOneOrFail({ where: { id: failed.id } });
    assert.strictEqual(saved.status, MediaRequestStatus.FAILED);
describe('PUT /request/:requestId (tv)', () => {
  it('does not add a season held by another request', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const owner = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const otherUser = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.TV,
        tmdbId: 67890,
        status: MediaStatus.PENDING,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const seedTvRequest = (requestedBy: User, seasons: number[]) =>
      requestRepo.save(
        new MediaRequest({
          type: MediaType.TV,
          status: MediaRequestStatus.PENDING,
          media,
          requestedBy,
          is4k: false,
          seasons: seasons.map(
            (seasonNumber) =>
              new SeasonRequest({
                seasonNumber,
                status: MediaRequestStatus.PENDING,
              })
          ),
        })
      );

    const mediaRequest = await seedTvRequest(owner, [1, 2]);
    const otherRequest = await seedTvRequest(otherUser, [3]);

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.put(`/request/${mediaRequest.id}`).send({
      mediaType: MediaType.TV,
      seasons: [1, 2, 3],
    });

    assert.strictEqual(res.status, 200);

    const saved = await requestRepo.findOneOrFail({
      where: { id: mediaRequest.id },
    });
    assert.deepStrictEqual(
      saved.seasons.map((s) => s.seasonNumber).sort((a, b) => a - b),
      [1, 2]
    );

    const otherSaved = await requestRepo.findOneOrFail({
      where: { id: otherRequest.id },
    });
    assert.deepStrictEqual(
      otherSaved.seasons.map((s) => s.seasonNumber),
      [3]
    );
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

  it('rejects a status the route does not define', async () => {
    const repo = getRepository(MediaRequest);
    const pending = await seedRequest();
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${pending.id}/frobnicate`);

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /approve/i);

    const persisted = await repo.findOneOrFail({
      where: { id: pending.id },
      relations: { modifiedBy: true },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.PENDING);
    assert.ok(!persisted.modifiedBy);
  });

  it('refuses to act on a request that is no longer pending', async () => {
    const repo = getRepository(MediaRequest);
    const approved = await seedRequest(MediaRequestStatus.APPROVED);
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${approved.id}/decline`);

    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /pending/i);

    const persisted = await repo.findOneOrFail({ where: { id: approved.id } });
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
  });

  it('rejects the removed pending verb even on a non-pending request', async () => {
    const repo = getRepository(MediaRequest);
    const declined = await seedRequest(MediaRequestStatus.DECLINED);
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${declined.id}/pending`);

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /approve/i);

    const persisted = await repo.findOneOrFail({ where: { id: declined.id } });
    assert.strictEqual(persisted.status, MediaRequestStatus.DECLINED);
  });
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

  it('refuses to retry a request that has not failed', async () => {
    const repo = getRepository(MediaRequest);
    const pending = await seedRequest();
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${pending.id}/retry`);

    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /failed/i);

    const persisted = await repo.findOneOrFail({ where: { id: pending.id } });
    assert.strictEqual(persisted.status, MediaRequestStatus.PENDING);
  });
});

describe('POST /request/:requestId/retry, stale server', () => {
  afterEach(() => {
    const settings = getSettings();
    settings.radarr = [];
    settings.sonarr = [];
  });

  it('refuses to retry when the request server no longer exists', async () => {
    configureRadarr([{ id: 0, isDefault: true, is4k: false }]);
    const repo = getRepository(MediaRequest);
    const failed = await seedRequest(MediaRequestStatus.FAILED, {
      serverId: 999,
    });
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${failed.id}/retry`);

    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /no longer exists/i);

    const persisted = await repo.findOneOrFail({ where: { id: failed.id } });
    assert.strictEqual(persisted.status, MediaRequestStatus.FAILED);
  });

  it('retries when the request server still exists', async () => {
    configureRadarr([{ id: 5, isDefault: true, is4k: false }]);
    const failed = await seedRequest(MediaRequestStatus.FAILED, {
      serverId: 5,
    });
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${failed.id}/retry`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.modifiedBy.email, 'admin@seerr.dev');
  });
});

describe('POST /request/:requestId/:status, unresolved *arr server', () => {
  afterEach(() => {
    // configureRadarr/configureSonarr mutate the shared settings singleton and
    // nothing else resets it; clear it so later suites start clean.
    const settings = getSettings();
    settings.radarr = [];
    settings.sonarr = [];
  });

  function failedNotificationSent(): boolean {
    return sendNotificationMock.calls.some(
      (call) => call.arguments[2] === Notification.MEDIA_FAILED
    );
  }

  it('fails a movie request whose serverId no longer exists instead of silently abandoning it', async () => {
    configureRadarr([{ id: 0, isDefault: true, is4k: false }]);
    getSettings().sonarr = [];

    const pending = await seedRequest(MediaRequestStatus.PENDING, {
      serverId: 999,
    });
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${pending.id}/approve`);
    assert.strictEqual(res.status, 200);

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: pending.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.FAILED);

    const media = await getRepository(Media).findOneOrFail({
      where: { id: pending.media.id },
    });
    assert.strictEqual(media.status, MediaStatus.UNKNOWN);

    assert.ok(failedNotificationSent());
  });

  it('does not fail a movie request when no default Radarr server is configured (silent skip preserved)', async () => {
    configureRadarr([{ isDefault: false, is4k: false }]);
    getSettings().sonarr = [];

    const pending = await seedRequest();
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${pending.id}/approve`);
    assert.strictEqual(res.status, 200);

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: pending.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
    assert.strictEqual(failedNotificationSent(), false);
  });

  it('fails a series request whose serverId no longer exists', async () => {
    configureSonarr([{ id: 0, isDefault: true, is4k: false }]);
    getSettings().radarr = [];

    const pending = await seedTvRequest(MediaRequestStatus.PENDING, {
      serverId: 999,
    });
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${pending.id}/approve`);
    assert.strictEqual(res.status, 200);

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: pending.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.FAILED);

    assert.ok(failedNotificationSent());
  });

  it('does not fail a series request when no default Sonarr server is configured (silent skip preserved)', async () => {
    configureSonarr([{ isDefault: false, is4k: false }]);
    getSettings().radarr = [];

    const pending = await seedTvRequest();
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${pending.id}/approve`);
    assert.strictEqual(res.status, 200);

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: pending.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
    assert.strictEqual(failedNotificationSent(), false);
  });
});

describe('DELETE /request/:requestId, deleted media status restoration', () => {
  async function seedDeletedMediaScenario() {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const admin = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 99001,
        status: MediaStatus.DELETED,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const staleRequest = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.COMPLETED,
        media,
        requestedBy: admin,
        is4k: false,
        isAutoRequest: true,
      })
    );

    media.status = MediaStatus.PENDING;
    await mediaRepo.save(media);

    const newRequest = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.APPROVED,
        media,
        requestedBy: admin,
        is4k: false,
      })
    );

    return { media, staleRequest, newRequest, admin };
  }

  it('restores media status to DELETED when the re-request is deleted and a stale completed request remains', async () => {
    const mediaRepo = getRepository(Media);
    const { media, newRequest } = await seedDeletedMediaScenario();

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${newRequest.id}`);

    assert.strictEqual(res.status, 204);

    const updated = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    assert.strictEqual(updated.status, MediaStatus.DELETED);
  });

  it('restores media status4k to DELETED when the re-request is deleted and a stale completed request remains', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const admin = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 99003,
        status: MediaStatus.UNKNOWN,
        status4k: MediaStatus.DELETED,
      })
    );

    await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.COMPLETED,
        media,
        requestedBy: admin,
        is4k: true,
        isAutoRequest: true,
      })
    );

    media.status4k = MediaStatus.PENDING;
    await mediaRepo.save(media);

    const newRequest = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.APPROVED,
        media,
        requestedBy: admin,
        is4k: true,
      })
    );

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${newRequest.id}`);

    assert.strictEqual(res.status, 204);

    const updated = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    assert.strictEqual(updated.status4k, MediaStatus.DELETED);
  });

  it('resets media status to UNKNOWN when the stale completed request is also deleted', async () => {
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);
    const { media, newRequest, staleRequest } =
      await seedDeletedMediaScenario();

    const agent = await loginAs('admin@seerr.dev', 'test1234');

    await agent.delete(`/request/${newRequest.id}`);

    const res = await agent.delete(`/request/${staleRequest.id}`);
    assert.strictEqual(res.status, 204);

    const updated = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    assert.strictEqual(updated.status, MediaStatus.UNKNOWN);

    const remaining = await requestRepo.find({
      where: { media: { id: media.id } },
    });
    assert.strictEqual(remaining.length, 0);
  });

  it('resets media status4k to UNKNOWN when the stale completed 4K request is also deleted', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const admin = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 99004,
        status: MediaStatus.UNKNOWN,
        status4k: MediaStatus.DELETED,
      })
    );

    const staleRequest = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.COMPLETED,
        media,
        requestedBy: admin,
        is4k: true,
        isAutoRequest: true,
      })
    );

    media.status4k = MediaStatus.PENDING;
    await mediaRepo.save(media);

    const newRequest = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.APPROVED,
        media,
        requestedBy: admin,
        is4k: true,
      })
    );

    const agent = await loginAs('admin@seerr.dev', 'test1234');

    await agent.delete(`/request/${newRequest.id}`);

    const res = await agent.delete(`/request/${staleRequest.id}`);
    assert.strictEqual(res.status, 204);

    const updated = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    assert.strictEqual(updated.status4k, MediaStatus.UNKNOWN);
  });

  it('does not reset media status when other active requests still exist', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const admin = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 99002,
        status: MediaStatus.PENDING,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const req1 = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.PENDING,
        media,
        requestedBy: admin,
        is4k: false,
      })
    );

    await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.PENDING,
        media,
        requestedBy: admin,
        is4k: false,
      })
    );

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${req1.id}`);

    assert.strictEqual(res.status, 204);

    const updated = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    assert.strictEqual(updated.status, MediaStatus.PENDING);
  });

  it('does not reset media status when status is PARTIALLY_AVAILABLE and only completed requests remain', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const admin = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 99005,
        status: MediaStatus.PARTIALLY_AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const completedRequest = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.COMPLETED,
        media,
        requestedBy: admin,
        is4k: false,
      })
    );

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${completedRequest.id}`);

    assert.strictEqual(res.status, 204);

    const updated = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    assert.strictEqual(updated.status, MediaStatus.PARTIALLY_AVAILABLE);
  });
});

describe('POST /request (movie), override rules', () => {
  it('applies an override rule when the default Radarr server id differs from its array index', async () => {
    configureRadarr([{ id: 5, isDefault: true, is4k: false }]);
    getSettings().sonarr = [];

    const userRepo = getRepository(User);
    const friend = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });

    const overrideRuleRepo = getRepository(OverrideRule);
    await overrideRuleRepo.save(
      new OverrideRule({
        radarrServiceId: 5,
        users: String(friend.id),
        rootFolder: '/overridden/movies',
      })
    );

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.post('/request').send({
      mediaType: MediaType.MOVIE,
      mediaId: 88001,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.rootFolder, '/overridden/movies');
  });

  it('applies an override rule when the default Radarr server id matches its array index (sanity check)', async () => {
    configureRadarr([{ id: 0, isDefault: true, is4k: false }]);
    getSettings().sonarr = [];

    const userRepo = getRepository(User);
    const friend = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });

    const overrideRuleRepo = getRepository(OverrideRule);
    await overrideRuleRepo.save(
      new OverrideRule({
        radarrServiceId: 0,
        users: String(friend.id),
        rootFolder: '/overridden/movies',
      })
    );

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.post('/request').send({
      mediaType: MediaType.MOVIE,
      mediaId: 88002,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.rootFolder, '/overridden/movies');
  });

  it('does not apply an unrelated override rule when there is no default Radarr server configured', async () => {
    getSettings().radarr = [];
    getSettings().sonarr = [];

    const userRepo = getRepository(User);
    const friend = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });

    const overrideRuleRepo = getRepository(OverrideRule);
    await overrideRuleRepo.save(
      new OverrideRule({
        radarrServiceId: 999,
        users: String(friend.id),
        rootFolder: '/overridden/movies',
      })
    );

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.post('/request').send({
      mediaType: MediaType.MOVIE,
      mediaId: 88005,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.rootFolder, null);
  });
});

describe('POST /request (tv), override rules', () => {
  it('applies an override rule when the default Sonarr server id differs from its array index', async () => {
    configureSonarr([{ id: 5, isDefault: true, is4k: false }]);
    getSettings().radarr = [];

    const userRepo = getRepository(User);
    const friend = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });

    const overrideRuleRepo = getRepository(OverrideRule);
    await overrideRuleRepo.save(
      new OverrideRule({
        sonarrServiceId: 5,
        users: String(friend.id),
        rootFolder: '/overridden/tv',
      })
    );

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.post('/request').send({
      mediaType: MediaType.TV,
      mediaId: 88003,
      seasons: [1],
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.rootFolder, '/overridden/tv');
  });

  it('applies an override rule when the default Sonarr server id matches its array index (sanity check)', async () => {
    configureSonarr([{ id: 0, isDefault: true, is4k: false }]);
    getSettings().radarr = [];

    const userRepo = getRepository(User);
    const friend = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });

    const overrideRuleRepo = getRepository(OverrideRule);
    await overrideRuleRepo.save(
      new OverrideRule({
        sonarrServiceId: 0,
        users: String(friend.id),
        rootFolder: '/overridden/tv',
      })
    );

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.post('/request').send({
      mediaType: MediaType.TV,
      mediaId: 88004,
      seasons: [1],
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.rootFolder, '/overridden/tv');
  });

  it('does not apply an unrelated override rule when there is no default Sonarr server configured', async () => {
    getSettings().radarr = [];
    getSettings().sonarr = [];

    const userRepo = getRepository(User);
    const friend = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });

    const overrideRuleRepo = getRepository(OverrideRule);
    await overrideRuleRepo.save(
      new OverrideRule({
        sonarrServiceId: 999,
        users: String(friend.id),
        rootFolder: '/overridden/tv',
      })
    );

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.post('/request').send({
      mediaType: MediaType.TV,
      mediaId: 88006,
      seasons: [1],
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.rootFolder, null);
  });
});

describe('DELETE /request/:requestId, orphaned season status reset', () => {
  async function seedTvShow(
    tmdbId: number,
    seasons: Partial<Season>[]
  ): Promise<Media> {
    const mediaRepo = getRepository(Media);

    return mediaRepo.save(
      new Media({
        mediaType: MediaType.TV,
        tmdbId,
        status: MediaStatus.PROCESSING,
        status4k: MediaStatus.UNKNOWN,
        seasons: seasons.map((season) => new Season(season)),
      })
    );
  }

  async function seedTvRequest(
    media: Media,
    seasonNumbers: number[]
  ): Promise<MediaRequest> {
    const userRepo = getRepository(User);
    const requestRepo = getRepository(MediaRequest);

    const admin = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    return requestRepo.save(
      new MediaRequest({
        type: MediaType.TV,
        status: MediaRequestStatus.APPROVED,
        media,
        requestedBy: admin,
        is4k: false,
        seasons: seasonNumbers.map(
          (seasonNumber) =>
            new SeasonRequest({
              seasonNumber,
              status: MediaRequestStatus.APPROVED,
            })
        ),
      })
    );
  }

  it('resets a request-covered PROCESSING season to UNKNOWN so it can be re-requested', async () => {
    const mediaRepo = getRepository(Media);
    const media = await seedTvShow(99101, [
      { seasonNumber: 1, status: MediaStatus.PROCESSING },
    ]);
    const tvRequest = await seedTvRequest(media, [1]);

    const admin = await loginAs('admin@seerr.dev', 'test1234');
    const res = await admin.delete(`/request/${tvRequest.id}`);
    assert.strictEqual(res.status, 204);

    const updated = await mediaRepo.findOneOrFail({
      where: { id: media.id },
    });
    assert.strictEqual(updated.seasons[0].status, MediaStatus.UNKNOWN);

    const friend = await loginAs('friend@seerr.dev', 'test1234');
    const reRequest = await friend.post('/request').send({
      mediaType: MediaType.TV,
      mediaId: 99101,
      seasons: [1],
    });
    assert.strictEqual(reRequest.status, 201);
  });

  it('does not touch PROCESSING seasons the deleted request did not cover', async () => {
    const mediaRepo = getRepository(Media);
    const media = await seedTvShow(99102, [
      { seasonNumber: 1, status: MediaStatus.PROCESSING },
      { seasonNumber: 2, status: MediaStatus.PROCESSING },
    ]);
    const tvRequest = await seedTvRequest(media, [1]);

    const admin = await loginAs('admin@seerr.dev', 'test1234');
    const res = await admin.delete(`/request/${tvRequest.id}`);
    assert.strictEqual(res.status, 204);

    const updated = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    const seasonOne = updated.seasons.find((s) => s.seasonNumber === 1);
    const seasonTwo = updated.seasons.find((s) => s.seasonNumber === 2);
    assert.strictEqual(seasonOne?.status, MediaStatus.UNKNOWN);
    assert.strictEqual(seasonTwo?.status, MediaStatus.PROCESSING);
  });

  it('keeps a season PROCESSING while another active request still covers it', async () => {
    const mediaRepo = getRepository(Media);
    const media = await seedTvShow(99103, [
      { seasonNumber: 1, status: MediaStatus.PROCESSING },
    ]);
    const firstRequest = await seedTvRequest(media, [1]);
    await seedTvRequest(media, [1]);

    const admin = await loginAs('admin@seerr.dev', 'test1234');
    const res = await admin.delete(`/request/${firstRequest.id}`);
    assert.strictEqual(res.status, 204);

    const updated = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    assert.strictEqual(updated.seasons[0].status, MediaStatus.PROCESSING);
  });

  it('leaves season status4k untouched when deleting a non-4K request', async () => {
    const mediaRepo = getRepository(Media);
    const media = await seedTvShow(99104, [
      {
        seasonNumber: 1,
        status: MediaStatus.PROCESSING,
        status4k: MediaStatus.PROCESSING,
      },
    ]);
    const tvRequest = await seedTvRequest(media, [1]);

    const admin = await loginAs('admin@seerr.dev', 'test1234');
    const res = await admin.delete(`/request/${tvRequest.id}`);
    assert.strictEqual(res.status, 204);

    const updated = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    assert.strictEqual(updated.seasons[0].status, MediaStatus.UNKNOWN);
    assert.strictEqual(updated.seasons[0].status4k, MediaStatus.PROCESSING);
  });
});
