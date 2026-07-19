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
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

// Prevent the AfterInsert/AfterUpdate hooks on MediaRequest from reaching
// out to TMDB / notification agents while seeding requests.
Object.defineProperty(MediaRequest, 'sendNotification', {
  value: async () => undefined,
  writable: true,
  configurable: true,
});

setupTestDb();

async function seedMedia(
  tmdbId: number,
  mediaType: MediaType,
  status: MediaStatus = MediaStatus.UNKNOWN
): Promise<Media> {
  const mediaRepository = getRepository(Media);
  return mediaRepository.save(
    new Media({
      tmdbId,
      mediaType,
      status,
      status4k: MediaStatus.UNKNOWN,
    })
  );
}

async function seedRequest(
  media: Media,
  status: MediaRequestStatus,
  { is4k = false, seasons = [] as number[] } = {}
): Promise<MediaRequest> {
  const userRepository = getRepository(User);
  const admin = await userRepository.findOneOrFail({ where: { id: 1 } });

  const requestRepository = getRepository(MediaRequest);
  return requestRepository.save(
    new MediaRequest({
      media,
      requestedBy: admin,
      status,
      type: media.mediaType,
      is4k,
      seasons: seasons.map(
        (seasonNumber) => new SeasonRequest({ seasonNumber, status })
      ),
    })
  );
}

async function getRelatedSingle(media: Media): Promise<Media> {
  const results = await Media.getRelatedMedia(undefined, [
    { tmdbId: media.tmdbId, mediaType: media.mediaType },
  ]);

  assert.strictEqual(results.length, 1);
  return results[0];
}

describe('Media.getRelatedMedia active request state', () => {
  afterEach(() => {
    getSettings().main.hideRequested = false;
  });

  it('does not compute hasActiveRequest when hideRequested is disabled', async () => {
    const movie = await seedMedia(100, MediaType.MOVIE);
    await seedRequest(movie, MediaRequestStatus.PENDING);

    const related = await getRelatedSingle(movie);

    assert.strictEqual(related.hasActiveRequest, undefined);
  });

  it('flags media with a PENDING request', async () => {
    getSettings().main.hideRequested = true;

    const movie = await seedMedia(100, MediaType.MOVIE);
    await seedRequest(movie, MediaRequestStatus.PENDING);

    const related = await getRelatedSingle(movie);

    assert.strictEqual(related.hasActiveRequest, true);
  });

  it('flags media with an APPROVED request', async () => {
    getSettings().main.hideRequested = true;

    const movie = await seedMedia(100, MediaType.MOVIE);
    await seedRequest(movie, MediaRequestStatus.APPROVED);

    const related = await getRelatedSingle(movie);

    assert.strictEqual(related.hasActiveRequest, true);
  });

  it('does not flag media with only DECLINED, FAILED, or COMPLETED requests', async () => {
    getSettings().main.hideRequested = true;

    const movie = await seedMedia(100, MediaType.MOVIE);
    await seedRequest(movie, MediaRequestStatus.DECLINED);
    await seedRequest(movie, MediaRequestStatus.FAILED);
    await seedRequest(movie, MediaRequestStatus.COMPLETED);

    const related = await getRelatedSingle(movie);

    assert.strictEqual(related.hasActiveRequest, false);
  });

  it('does not flag media without any requests', async () => {
    getSettings().main.hideRequested = true;

    const movie = await seedMedia(100, MediaType.MOVIE);

    const related = await getRelatedSingle(movie);

    assert.strictEqual(related.hasActiveRequest, false);
  });

  it('flags a 4K-only request', async () => {
    getSettings().main.hideRequested = true;

    const movie = await seedMedia(100, MediaType.MOVIE);
    await seedRequest(movie, MediaRequestStatus.PENDING, { is4k: true });

    const related = await getRelatedSingle(movie);

    assert.strictEqual(related.hasActiveRequest, true);
  });

  it('flags a partially available series with an active season request', async () => {
    getSettings().main.hideRequested = true;

    const tv = await seedMedia(
      200,
      MediaType.TV,
      MediaStatus.PARTIALLY_AVAILABLE
    );
    await seedRequest(tv, MediaRequestStatus.COMPLETED, { seasons: [1] });
    await seedRequest(tv, MediaRequestStatus.PENDING, { seasons: [2] });

    const related = await getRelatedSingle(tv);

    assert.strictEqual(related.status, MediaStatus.PARTIALLY_AVAILABLE);
    assert.strictEqual(related.hasActiveRequest, true);
  });

  it('does not flag a partially available series without active requests', async () => {
    getSettings().main.hideRequested = true;

    const tv = await seedMedia(
      200,
      MediaType.TV,
      MediaStatus.PARTIALLY_AVAILABLE
    );
    await seedRequest(tv, MediaRequestStatus.COMPLETED, { seasons: [1] });

    const related = await getRelatedSingle(tv);

    assert.strictEqual(related.hasActiveRequest, false);
  });

  it('handles multiple media in a single batch', async () => {
    getSettings().main.hideRequested = true;

    const requested = await seedMedia(100, MediaType.MOVIE);
    const unrequested = await seedMedia(101, MediaType.MOVIE);
    await seedRequest(requested, MediaRequestStatus.PENDING);

    const results = await Media.getRelatedMedia(undefined, [
      { tmdbId: requested.tmdbId, mediaType: MediaType.MOVIE },
      { tmdbId: unrequested.tmdbId, mediaType: MediaType.MOVIE },
    ]);

    assert.strictEqual(results.length, 2);
    const byTmdbId = new Map(results.map((m) => [m.tmdbId, m]));
    assert.strictEqual(byTmdbId.get(100)?.hasActiveRequest, true);
    assert.strictEqual(byTmdbId.get(101)?.hasActiveRequest, false);
  });

  it('does not expose request or user data in the result', async () => {
    getSettings().main.hideRequested = true;

    const movie = await seedMedia(100, MediaType.MOVIE);
    await seedRequest(movie, MediaRequestStatus.PENDING);

    const related = await getRelatedSingle(movie);

    assert.strictEqual(related.requests, undefined);

    const serialized = JSON.stringify(related);
    assert.ok(!serialized.includes('"requests"'));
    assert.ok(!serialized.includes('"requestedBy"'));
    assert.ok(!serialized.includes('"modifiedBy"'));
  });
});
