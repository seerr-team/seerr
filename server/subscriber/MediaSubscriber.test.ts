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
import { User } from '@server/entity/User';
import { setupTestDb } from '@server/test/db';

setupTestDb();

async function createMedia(
  status: MediaStatus,
  mediaType = MediaType.MOVIE,
  status4k = MediaStatus.UNKNOWN
): Promise<Media> {
  const mediaRepo = getRepository(Media);
  const media = new Media();
  media.tmdbId = Math.floor(Math.random() * 900000) + 100000;
  media.mediaType = mediaType;
  media.status = status;
  media.status4k = status4k;
  return mediaRepo.save(media);
}

async function createMovieRequest(
  requestedBy: User,
  media: Media,
  status: MediaRequestStatus,
  is4k = false
): Promise<MediaRequest> {
  const requestRepo = getRepository(MediaRequest);
  const req = new MediaRequest({
    media,
    requestedBy,
    status,
    type: MediaType.MOVIE,
    is4k,
  });
  return requestRepo.save(req);
}

describe('MediaSubscriber', () => {
  /**
   * Tests the beforeUpdate path: when media transitions PENDING → AVAILABLE,
   * updateChildRequestStatus must be awaited so that PENDING requests are
   * promoted to APPROVED before the save completes. afterUpdate then sees
   * those APPROVED requests and marks them COMPLETED.
   *
   * Without await on updateChildRequestStatus, afterUpdate may read the
   * request before the status change is committed and leave it PENDING.
   */
  it('processes a PENDING request to COMPLETED when media transitions PENDING -> AVAILABLE', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await createMedia(MediaStatus.PENDING);
    const mediaRequest = await createMovieRequest(
      user,
      media,
      MediaRequestStatus.PENDING
    );

    // beforeUpdate auto-approves PENDING request; afterUpdate marks it COMPLETED
    media.status = MediaStatus.AVAILABLE;
    await mediaRepo.save(media);

    const reloaded = await requestRepo.findOneOrFail({
      where: { id: mediaRequest.id },
    });
    assert.strictEqual(reloaded.status, MediaRequestStatus.COMPLETED);
  });

  it('processes a PENDING 4K request to COMPLETED when media 4K status transitions PENDING -> AVAILABLE', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    // status stays UNKNOWN; only status4k goes PENDING → AVAILABLE
    const media = await createMedia(
      MediaStatus.UNKNOWN,
      MediaType.MOVIE,
      MediaStatus.PENDING
    );
    const mediaRequest = await createMovieRequest(
      user,
      media,
      MediaRequestStatus.PENDING,
      true
    );

    media.status4k = MediaStatus.AVAILABLE;
    await mediaRepo.save(media);

    const reloaded = await requestRepo.findOneOrFail({
      where: { id: mediaRequest.id },
    });
    assert.strictEqual(reloaded.status, MediaRequestStatus.COMPLETED);
  });

  /**
   * Tests the afterUpdate path: when media transitions PROCESSING → AVAILABLE,
   * updateRelatedMediaRequest must be awaited so that APPROVED requests are
   * marked COMPLETED before the save returns.
   */
  it('marks an APPROVED request COMPLETED when media transitions PROCESSING -> AVAILABLE', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    // PROCESSING means beforeUpdate does not fire (was not PENDING)
    const media = await createMedia(MediaStatus.PROCESSING);
    const mediaRequest = await createMovieRequest(
      user,
      media,
      MediaRequestStatus.APPROVED
    );

    media.status = MediaStatus.AVAILABLE;
    await mediaRepo.save(media);

    const reloaded = await requestRepo.findOneOrFail({
      where: { id: mediaRequest.id },
    });
    assert.strictEqual(reloaded.status, MediaRequestStatus.COMPLETED);
  });

  it('marks an APPROVED 4K request COMPLETED when media 4K status transitions PROCESSING -> AVAILABLE', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await createMedia(
      MediaStatus.UNKNOWN,
      MediaType.MOVIE,
      MediaStatus.PROCESSING
    );
    const mediaRequest = await createMovieRequest(
      user,
      media,
      MediaRequestStatus.APPROVED,
      true
    );

    media.status4k = MediaStatus.AVAILABLE;
    await mediaRepo.save(media);

    const reloaded = await requestRepo.findOneOrFail({
      where: { id: mediaRequest.id },
    });
    assert.strictEqual(reloaded.status, MediaRequestStatus.COMPLETED);
  });

  it('marks a FAILED request COMPLETED when media transitions PROCESSING -> AVAILABLE', async () => {
    const userRepo = getRepository(User);
    const mediaRepo = getRepository(Media);
    const requestRepo = getRepository(MediaRequest);

    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const media = await createMedia(MediaStatus.PROCESSING);
    const mediaRequest = await createMovieRequest(
      user,
      media,
      MediaRequestStatus.FAILED
    );

    media.status = MediaStatus.AVAILABLE;
    await mediaRepo.save(media);

    const reloaded = await requestRepo.findOneOrFail({
      where: { id: mediaRequest.id },
    });
    assert.strictEqual(reloaded.status, MediaRequestStatus.COMPLETED);
  });
});
