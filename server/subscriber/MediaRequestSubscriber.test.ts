import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

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
import { setupTestDb } from '@server/test/db';

import { MediaRequestSubscriber } from './MediaRequestSubscriber';

setupTestDb();

/** Creates a TV request with the given season numbers, owned by the given user. */
async function createTvRequest(
  requestedBy: User,
  seasonNumbers: number[],
  status = MediaRequestStatus.PENDING
): Promise<MediaRequest> {
  const mediaRepo = getRepository(Media);
  const requestRepo = getRepository(MediaRequest);

  let media = await mediaRepo.findOne({ where: { tmdbId: 77777 } });
  if (!media) {
    media = new Media();
    media.tmdbId = 77777;
    media.mediaType = MediaType.TV;
    media.status = MediaStatus.PENDING;
    await mediaRepo.save(media);
  }

  const mediaRequest = new MediaRequest({
    media,
    requestedBy,
    status,
    type: MediaType.TV,
    is4k: false,
    seasons: seasonNumbers.map(
      (sn) => new SeasonRequest({ seasonNumber: sn, status })
    ),
  });

  const saved = await requestRepo.save(mediaRequest);
  // Reload so eager relations (seasons) include their DB-assigned IDs.
  return requestRepo.findOneOrFail({ where: { id: saved.id } });
}

describe('MediaRequestSubscriber.updateParentStatus', () => {
  it('persists APPROVED status to all child SeasonRequests in the database', async () => {
    const userRepo = getRepository(User);
    const requestRepo = getRepository(MediaRequest);

    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const mediaRequest = await createTvRequest(user, [1, 2, 3]);

    mediaRequest.status = MediaRequestStatus.APPROVED;

    const subscriber = new MediaRequestSubscriber();
    await subscriber.updateParentStatus(mediaRequest);

    // Re-fetch from DB to confirm the saves were awaited
    const reloaded = await requestRepo.findOneOrFail({
      where: { id: mediaRequest.id },
    });

    assert.strictEqual(reloaded.seasons.length, 3);
    for (const season of reloaded.seasons) {
      assert.strictEqual(
        season.status,
        MediaRequestStatus.APPROVED,
        `Season ${season.seasonNumber} should be APPROVED`
      );
    }
  });

  it('persists DECLINED status to all child SeasonRequests in the database', async () => {
    const userRepo = getRepository(User);
    const requestRepo = getRepository(MediaRequest);

    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const mediaRequest = await createTvRequest(user, [1, 2]);

    mediaRequest.status = MediaRequestStatus.DECLINED;

    const subscriber = new MediaRequestSubscriber();
    await subscriber.updateParentStatus(mediaRequest);

    const reloaded = await requestRepo.findOneOrFail({
      where: { id: mediaRequest.id },
    });

    assert.strictEqual(reloaded.seasons.length, 2);
    for (const season of reloaded.seasons) {
      assert.strictEqual(
        season.status,
        MediaRequestStatus.DECLINED,
        `Season ${season.seasonNumber} should be DECLINED`
      );
    }
  });
});
