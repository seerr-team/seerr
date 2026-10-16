import assert from 'node:assert/strict';
import path from 'node:path';
import { before, beforeEach, describe, it } from 'node:test';

import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import type { TmdbTvDetails } from '@server/api/themoviedb/interfaces';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import MediaServiceStatus from '@server/entity/MediaServiceStatus';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { AxiosInstance } from 'axios';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import mediaRoutes from './media';

const TVDB_ID = 81189;

interface RemoveCall {
  host: string;
  id: number;
}

const removedMovies: RemoveCall[] = [];
const removedSeries: RemoveCall[] = [];

function stubRemove(
  prototype: object,
  method: 'removeMovie' | 'removeSeries',
  calls: RemoveCall[]
) {
  Object.defineProperty(prototype, method, {
    get(this: { axios: AxiosInstance }) {
      const host = new URL(this.axios.defaults.baseURL ?? '').hostname;
      return async (id: number) => {
        calls.push({ host, id });
      };
    },
    set() {},
    configurable: true,
  });
}

stubRemove(RadarrAPI.prototype, 'removeMovie', removedMovies);
stubRemove(SonarrAPI.prototype, 'removeSeries', removedSeries);

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  get() {
    return async ({ tvId }: { tvId: number }) =>
      ({
        id: tvId,
        external_ids: { tvdb_id: TVDB_ID },
      }) as unknown as TmdbTvDetails;
  },
  set() {},
  configurable: true,
});

type ServerConfig = { hostname: string } & Partial<RadarrSettings>;

function configureRadarr(servers: ServerConfig[]): void {
  getSettings().radarr = servers.map((server, i) => ({
    id: i,
    name: server.hostname,
    port: 7878,
    apiKey: 'test-key',
    baseUrl: '',
    useSsl: false,
    activeProfileId: 1,
    activeProfileName: 'Any',
    activeDirectory: '/movies',
    is4k: false,
    minimumAvailability: 'released',
    tags: [],
    isDefault: false,
    syncEnabled: true,
    preventSearch: false,
    externalUrl: '',
    ...server,
  })) as RadarrSettings[];
}

function configureSonarr(
  servers: ({ hostname: string } & Partial<SonarrSettings>)[]
): void {
  getSettings().sonarr = servers.map((server, i) => ({
    id: i,
    name: server.hostname,
    port: 8989,
    apiKey: 'test-key',
    baseUrl: '',
    useSsl: false,
    activeProfileId: 1,
    activeProfileName: 'Any',
    activeDirectory: '/tv',
    activeLanguageProfileId: 1,
    animeTags: [],
    is4k: false,
    enableSeasonFolders: true,
    tags: [],
    isDefault: false,
    syncEnabled: true,
    preventSearch: false,
    externalUrl: '',
    ...server,
  })) as SonarrSettings[];
}

let app: Express;

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(
    OpenApiValidator.middleware({
      apiSpec: path.join(__dirname, '../../seerr-api.yml'),
      validateRequests: true,
    })
  );
  app.use(checkUser);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/media', mediaRoutes);
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

before(() => {
  app = createApp();
});

beforeEach(() => {
  removedMovies.length = 0;
  removedSeries.length = 0;
  getSettings().radarr = [];
  getSettings().sonarr = [];
});

setupTestDb();

async function loginAs(email: string) {
  const settings = getSettings();
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;

  try {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/v1/auth/local')
      .send({ email, password: 'test1234' });
    assert.strictEqual(res.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
}

async function seedMovie(fields: Partial<Media> = {}) {
  return getRepository(Media).save(
    new Media({
      mediaType: MediaType.MOVIE,
      tmdbId: 603,
      status: MediaStatus.AVAILABLE,
      status4k: MediaStatus.AVAILABLE,
      ...fields,
    })
  );
}

async function seedServiceSlot(
  media: Media,
  serviceId: number,
  serviceType: 'radarr' | 'sonarr' = 'radarr'
) {
  const requestedBy = await getRepository(User).findOneOrFail({
    where: { email: 'demo@seerr.dev' },
  });

  await getRepository(MediaServiceStatus).save(
    new MediaServiceStatus({
      mediaId: media.id,
      serviceId,
      serviceType,
      status: MediaStatus.AVAILABLE,
      externalServiceId: 100 + serviceId,
      externalServiceSlug: `slug-${serviceId}`,
    })
  );

  await getRepository(MediaRequest).save(
    new MediaRequest({
      type: media.mediaType,
      status: MediaRequestStatus.COMPLETED,
      media,
      requestedBy,
      is4k: false,
      serverId: serviceId,
      isServiceRequest: true,
    })
  );
}

async function remainingServiceSlots(mediaId: number) {
  const statuses = await getRepository(MediaServiceStatus).find({
    where: { mediaId },
  });
  const requests = await getRepository(MediaRequest).find({
    where: { media: { id: mediaId }, isServiceRequest: true },
  });

  return {
    statuses: statuses.map((s) => s.serviceId).sort(),
    requests: requests.map((r) => r.serverId).sort(),
  };
}

describe('DELETE /media/:id/file', () => {
  describe('standard + 4K setup', () => {
    beforeEach(() => {
      configureRadarr([
        { hostname: 'radarr', isDefault: true },
        { hostname: 'radarr-4k', isDefault: true, is4k: true },
      ]);
    });

    it('removes the movie from the default server and only resets the standard status', async () => {
      const media = await seedMovie({
        serviceId: 0,
        externalServiceId: 11,
        serviceId4k: 1,
        externalServiceId4k: 22,
      });

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(`/api/v1/media/${media.id}/file`);

      assert.strictEqual(res.status, 204);
      assert.deepStrictEqual(removedMovies, [{ host: 'radarr', id: 603 }]);

      const updated = await getRepository(Media).findOneOrFail({
        where: { id: media.id },
      });
      assert.strictEqual(updated.status, MediaStatus.DELETED);
      assert.strictEqual(updated.serviceId, null);
      assert.strictEqual(updated.externalServiceId, null);
      assert.strictEqual(updated.status4k, MediaStatus.AVAILABLE);
      assert.strictEqual(updated.serviceId4k, 1);
      assert.strictEqual(updated.externalServiceId4k, 22);
    });

    it('removes the movie from the 4K server and only resets the 4K status', async () => {
      const media = await seedMovie({
        serviceId: 0,
        externalServiceId: 11,
        serviceId4k: 1,
        externalServiceId4k: 22,
      });

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?is4k=true`
      );

      assert.strictEqual(res.status, 204);
      assert.deepStrictEqual(removedMovies, [{ host: 'radarr-4k', id: 603 }]);

      const updated = await getRepository(Media).findOneOrFail({
        where: { id: media.id },
      });
      assert.strictEqual(updated.status4k, MediaStatus.DELETED);
      assert.strictEqual(updated.serviceId4k, null);
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
      assert.strictEqual(updated.serviceId, 0);
    });

    it('removes a series from Sonarr and marks its seasons deleted', async () => {
      configureSonarr([
        { hostname: 'sonarr', isDefault: true },
        { hostname: 'sonarr-4k', isDefault: true, is4k: true },
      ]);
      const media = await getRepository(Media).save(
        new Media({
          mediaType: MediaType.TV,
          tmdbId: 1399,
          status: MediaStatus.AVAILABLE,
          status4k: MediaStatus.AVAILABLE,
          seasons: [
            new Season({
              seasonNumber: 1,
              status: MediaStatus.AVAILABLE,
              status4k: MediaStatus.AVAILABLE,
            }),
          ],
        })
      );

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?is4k=true`
      );

      assert.strictEqual(res.status, 204);
      assert.deepStrictEqual(removedSeries, [
        { host: 'sonarr-4k', id: TVDB_ID },
      ]);

      const updated = await getRepository(Media).findOneOrFail({
        where: { id: media.id },
      });
      assert.strictEqual(updated.status4k, MediaStatus.DELETED);
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
      assert.strictEqual(updated.seasons[0].status4k, MediaStatus.DELETED);
      assert.strictEqual(updated.seasons[0].status, MediaStatus.AVAILABLE);
    });

    it('rejects users without the manage requests permission', async () => {
      const media = await seedMovie();

      const agent = await loginAs('demo@seerr.dev');
      const res = await agent.delete(`/api/v1/media/${media.id}/file`);

      assert.strictEqual(res.status, 403);
      assert.deepStrictEqual(removedMovies, []);
    });
  });

  describe('multiple servers (Italian + English)', () => {
    beforeEach(() => {
      configureRadarr([
        { hostname: 'radarr-ita', isDefault: true, buttonLabel: 'ITA' },
        { hostname: 'radarr-eng', buttonLabel: 'ENG' },
      ]);
    });

    it('accepts the serviceId query parameter', async () => {
      const media = await seedMovie();

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?is4k=false&serviceId=1`
      );

      assert.strictEqual(res.status, 204, res.body.message);
    });

    it('rejects a non-numeric serviceId', async () => {
      const media = await seedMovie();

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?serviceId=eng`
      );

      assert.strictEqual(res.status, 400);
      assert.deepStrictEqual(removedMovies, []);
    });

    it('removes the movie only from the English server', async () => {
      const media = await seedMovie();
      await seedServiceSlot(media, 0);
      await seedServiceSlot(media, 1);

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?is4k=false&serviceId=1`
      );

      assert.strictEqual(res.status, 204);
      assert.deepStrictEqual(removedMovies, [{ host: 'radarr-eng', id: 603 }]);
      assert.deepStrictEqual(await remainingServiceSlots(media.id), {
        statuses: [0],
        requests: [0],
      });

      const updated = await getRepository(Media).findOneOrFail({
        where: { id: media.id },
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
    });

    it('removes the movie only from the Italian server', async () => {
      const media = await seedMovie();
      await seedServiceSlot(media, 0);
      await seedServiceSlot(media, 1);

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?is4k=false&serviceId=0`
      );

      assert.strictEqual(res.status, 204);
      assert.deepStrictEqual(removedMovies, [{ host: 'radarr-ita', id: 603 }]);
      assert.deepStrictEqual(await remainingServiceSlots(media.id), {
        statuses: [1],
        requests: [1],
      });
    });

    it('removes a series only from the English Sonarr server', async () => {
      configureSonarr([
        { hostname: 'sonarr-ita', isDefault: true, buttonLabel: 'ITA' },
        { hostname: 'sonarr-eng', buttonLabel: 'ENG' },
      ]);
      const media = await getRepository(Media).save(
        new Media({
          mediaType: MediaType.TV,
          tmdbId: 1399,
          status: MediaStatus.AVAILABLE,
          seasons: [
            new Season({ seasonNumber: 1, status: MediaStatus.AVAILABLE }),
          ],
        })
      );
      await seedServiceSlot(media, 0, 'sonarr');
      await seedServiceSlot(media, 1, 'sonarr');

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?is4k=false&serviceId=1`
      );

      assert.strictEqual(res.status, 204);
      assert.deepStrictEqual(removedSeries, [
        { host: 'sonarr-eng', id: TVDB_ID },
      ]);
      assert.deepStrictEqual(await remainingServiceSlots(media.id), {
        statuses: [0],
        requests: [0],
      });

      const updated = await getRepository(Media).findOneOrFail({
        where: { id: media.id },
      });
      assert.strictEqual(updated.seasons[0].status, MediaStatus.AVAILABLE);
    });

    it('without serviceId, removes from the server the media was sent to', async () => {
      const media = await seedMovie({ serviceId: 1, externalServiceId: 11 });

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(`/api/v1/media/${media.id}/file`);

      assert.strictEqual(res.status, 204);
      assert.deepStrictEqual(removedMovies, [{ host: 'radarr-eng', id: 603 }]);
    });

    it('returns 409 for a serviceId that is not configured', async () => {
      const media = await seedMovie();
      await seedServiceSlot(media, 0);

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?serviceId=7`
      );

      assert.strictEqual(res.status, 409);
      assert.deepStrictEqual(removedMovies, []);
      assert.deepStrictEqual(await remainingServiceSlots(media.id), {
        statuses: [0],
        requests: [0],
      });
    });
  });

  describe('multiple servers with a 4K server', () => {
    beforeEach(() => {
      configureRadarr([
        { hostname: 'radarr-ita', isDefault: true, buttonLabel: 'ITA' },
        { hostname: 'radarr-eng', buttonLabel: 'ENG' },
        {
          hostname: 'radarr-ita-4k',
          isDefault: true,
          is4k: true,
          buttonLabel: 'ITA 4K',
        },
      ]);
    });

    it('removes the movie only from the English server and keeps 4K untouched', async () => {
      const media = await seedMovie({
        serviceId4k: 2,
        externalServiceId4k: 33,
      });
      await seedServiceSlot(media, 0);
      await seedServiceSlot(media, 1);
      await seedServiceSlot(media, 2);

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?is4k=false&serviceId=1`
      );

      assert.strictEqual(res.status, 204);
      assert.deepStrictEqual(removedMovies, [{ host: 'radarr-eng', id: 603 }]);
      assert.deepStrictEqual(await remainingServiceSlots(media.id), {
        statuses: [0, 2],
        requests: [0, 2],
      });

      const updated = await getRepository(Media).findOneOrFail({
        where: { id: media.id },
      });
      assert.strictEqual(updated.status4k, MediaStatus.AVAILABLE);
      assert.strictEqual(updated.serviceId4k, 2);
    });

    it('removes the movie only from the 4K server by serviceId', async () => {
      const media = await seedMovie();
      await seedServiceSlot(media, 0);
      await seedServiceSlot(media, 1);
      await seedServiceSlot(media, 2);

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?is4k=false&serviceId=2`
      );

      assert.strictEqual(res.status, 204);
      assert.deepStrictEqual(removedMovies, [
        { host: 'radarr-ita-4k', id: 603 },
      ]);
      assert.deepStrictEqual(await remainingServiceSlots(media.id), {
        statuses: [0, 1],
        requests: [0, 1],
      });
    });

    it('with is4k, removes from the default 4K server and keeps service slots', async () => {
      const media = await seedMovie({
        serviceId4k: 2,
        externalServiceId4k: 33,
      });
      await seedServiceSlot(media, 0);
      await seedServiceSlot(media, 1);

      const agent = await loginAs('admin@seerr.dev');
      const res = await agent.delete(
        `/api/v1/media/${media.id}/file?is4k=true`
      );

      assert.strictEqual(res.status, 204);
      assert.deepStrictEqual(removedMovies, [
        { host: 'radarr-ita-4k', id: 603 },
      ]);
      assert.deepStrictEqual(await remainingServiceSlots(media.id), {
        statuses: [0, 1],
        requests: [0, 1],
      });

      const updated = await getRepository(Media).findOneOrFail({
        where: { id: media.id },
      });
      assert.strictEqual(updated.status4k, MediaStatus.DELETED);
      assert.strictEqual(updated.serviceId4k, null);
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
    });
  });
});
