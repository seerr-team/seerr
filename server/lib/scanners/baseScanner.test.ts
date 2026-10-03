import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaRequest from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import SeasonRequest from '@server/entity/SeasonRequest';
import { User } from '@server/entity/User';
import type { ProcessableSeason } from '@server/lib/scanners/baseScanner';
import BaseScanner from '@server/lib/scanners/baseScanner';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

mock.method(MediaRequest, 'sendNotification', async () => undefined);

setupTestDb();

class HarnessScanner extends BaseScanner<unknown> {
  public constructor(declineRequestsOnStatusReset?: boolean) {
    super('Harness Scan');

    if (declineRequestsOnStatusReset !== undefined) {
      this.declineRequestsOnStatusReset = declineRequestsOnStatusReset;
    }
  }

  public async scanShow(
    tmdbId: number,
    seasons: ProcessableSeason[]
  ): Promise<void> {
    await this.processShow(tmdbId, undefined, seasons, {
      title: 'Test Show',
    });
    await this.resolve();
  }

  public scanAbandonedMovie(tmdbId: number): Promise<void> {
    return this.processMovie(tmdbId, {
      title: 'Test Movie',
      processing: false,
      hasFile: false,
    });
  }

  // Most permissive resolver possible, so a survivor means nothing was recorded.
  public resolve(): Promise<void> {
    return this.resolveStatusResets(() => true);
  }
}

// Identical to what plex/index.ts and jellyfin/index.ts push for a season the library lacks.
const LIBRARY_HAS_NO_EPISODES: ProcessableSeason[] = [
  {
    seasonNumber: 1,
    episodes: 0,
    episodes4k: 0,
    totalEpisodes: 10,
  },
];

async function seedInFlightShow(tmdbId: number): Promise<MediaRequest> {
  const mediaRepository = getRepository(Media);
  const requestRepository = getRepository(MediaRequest);
  const userRepository = getRepository(User);

  const requestedBy = await userRepository.findOneOrFail({ where: { id: 1 } });

  const media = await mediaRepository.save(
    new Media({
      tmdbId,
      mediaType: MediaType.TV,
      status: MediaStatus.PROCESSING,
      status4k: MediaStatus.UNKNOWN,
      seasons: [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.PROCESSING,
          status4k: MediaStatus.UNKNOWN,
        }),
      ],
    })
  );

  // sendToSonarr runs on insert and only bails when no server is configured,
  // so leftover settings from another test would reach TMDB and fail the request.
  const settings = getSettings();
  settings.radarr = [];
  settings.sonarr = [];

  return requestRepository.save(
    new MediaRequest({
      type: MediaType.TV,
      status: MediaRequestStatus.APPROVED,
      media,
      requestedBy,
      is4k: false,
      seasons: [
        new SeasonRequest({
          seasonNumber: 1,
          status: MediaRequestStatus.APPROVED,
        }),
      ],
    })
  );
}

async function seedInFlightMovie(tmdbId: number): Promise<MediaRequest> {
  const mediaRepository = getRepository(Media);
  const requestRepository = getRepository(MediaRequest);
  const userRepository = getRepository(User);

  const requestedBy = await userRepository.findOneOrFail({ where: { id: 1 } });

  const media = await mediaRepository.save(
    new Media({
      tmdbId,
      mediaType: MediaType.MOVIE,
      status: MediaStatus.PROCESSING,
      status4k: MediaStatus.UNKNOWN,
    })
  );

  // sendToRadarr runs on insert and only bails when no server is configured,
  // so leftover settings from another test would reach TMDB and fail the request.
  const settings = getSettings();
  settings.radarr = [];
  settings.sonarr = [];

  return requestRepository.save(
    new MediaRequest({
      type: MediaType.MOVIE,
      status: MediaRequestStatus.APPROVED,
      media,
      requestedBy,
      is4k: false,
    })
  );
}

describe('BaseScanner', () => {
  describe('declineRequestsOnStatusReset gate', () => {
    it('leaves the request alone for a scanner that has not opted in', async () => {
      const requestRepository = getRepository(MediaRequest);
      const request = await seedInFlightShow(7001);

      await new HarnessScanner().scanShow(7001, LIBRARY_HAS_NO_EPISODES);

      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(updated.status, MediaRequestStatus.APPROVED);
    });

    it('declines the request for a scanner that has opted in', async () => {
      const requestRepository = getRepository(MediaRequest);
      const request = await seedInFlightShow(7002);

      await new HarnessScanner(true).scanShow(7002, LIBRARY_HAS_NO_EPISODES);

      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(updated.status, MediaRequestStatus.DECLINED);
    });

    it('resets a movie in the loop for a scanner that has not opted in', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const request = await seedInFlightMovie(7003);

      await new HarnessScanner().scanAbandonedMovie(7003);

      const media = await mediaRepository.findOneOrFail({
        where: { tmdbId: 7003 },
      });
      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(media.status, MediaStatus.UNKNOWN);
      assert.strictEqual(updated.status, MediaRequestStatus.APPROVED);
    });

    it('defers a movie reset to the resolve pass for a scanner that has opted in', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const request = await seedInFlightMovie(7004);
      const scanner = new HarnessScanner(true);

      await scanner.scanAbandonedMovie(7004);

      const duringScan = await mediaRepository.findOneOrFail({
        where: { tmdbId: 7004 },
      });
      assert.strictEqual(duringScan.status, MediaStatus.PROCESSING);

      await scanner.resolve();

      const afterResolve = await mediaRepository.findOneOrFail({
        where: { tmdbId: 7004 },
      });
      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(afterResolve.status, MediaStatus.UNKNOWN);
      assert.strictEqual(updated.status, MediaRequestStatus.DECLINED);
    });
  });
});
