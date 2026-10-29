import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

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
import SeasonRequest from '@server/entity/SeasonRequest';
import { User } from '@server/entity/User';
import { MediaRequestSubscriber } from '@server/subscriber/MediaRequestSubscriber';
import { setupTestDb } from '@server/test/db';

Object.defineProperty(TheMovieDb.prototype, 'getMovie', {
  get() {
    return async ({ movieId }: { movieId: number }) =>
      ({ id: movieId }) as unknown as TmdbMovieDetails;
  },
  set() {},
  configurable: true,
});

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  get() {
    return async ({ tvId }: { tvId: number }) =>
      ({ id: tvId }) as unknown as TmdbTvDetails;
  },
  set() {},
  configurable: true,
});

setupTestDb();

describe('MediaSubscriber', () => {
  it('completes a pending request without sending it to Radarr when the media becomes available', async (t) => {
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const requestedBy = await getRepository(User).findOneOrFail({
      where: { email: 'demo@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.MOVIE,
        tmdbId: 12345,
        status: MediaStatus.PENDING,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const pending = await requestRepo.save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.PENDING,
        media,
        requestedBy,
        is4k: false,
      })
    );

    const sentStatuses: MediaRequestStatus[] = [];
    t.mock.method(
      MediaRequestSubscriber.prototype,
      'sendToRadarr',
      async (entity: MediaRequest) => {
        sentStatuses.push(entity.status);
      }
    );
    t.mock.method(MediaRequest, 'sendNotification', async () => undefined);

    const current = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    current.status = MediaStatus.AVAILABLE;
    await mediaRepo.save(current);

    assert.ok(!sentStatuses.includes(MediaRequestStatus.APPROVED));

    const persisted = await requestRepo.findOneOrFail({
      where: { id: pending.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.COMPLETED);
  });

  it('completes the seasons of a pending tv request when the media becomes available', async (t) => {
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const requestedBy = await getRepository(User).findOneOrFail({
      where: { email: 'demo@seerr.dev' },
    });

    const media = await mediaRepo.save(
      new Media({
        mediaType: MediaType.TV,
        tmdbId: 67890,
        status: MediaStatus.PENDING,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const pending = await requestRepo.save(
      new MediaRequest({
        type: MediaType.TV,
        status: MediaRequestStatus.PENDING,
        media,
        requestedBy,
        is4k: false,
        seasons: [
          new SeasonRequest({
            seasonNumber: 1,
            status: MediaRequestStatus.PENDING,
          }),
          new SeasonRequest({
            seasonNumber: 2,
            status: MediaRequestStatus.PENDING,
          }),
        ],
      })
    );

    t.mock.method(
      MediaRequestSubscriber.prototype,
      'sendToSonarr',
      async () => undefined
    );
    t.mock.method(MediaRequest, 'sendNotification', async () => undefined);

    const current = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    current.status = MediaStatus.AVAILABLE;
    await mediaRepo.save(current);

    const persisted = await requestRepo.findOneOrFail({
      where: { id: pending.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.COMPLETED);
    assert.strictEqual(persisted.seasons.length, 2);
    for (const season of persisted.seasons) {
      assert.strictEqual(season.status, MediaRequestStatus.COMPLETED);
    }
  });
});
