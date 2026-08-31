import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

import ExternalAPI from '@server/api/externalapi';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import {
  DuplicateMediaRequestError,
  MediaRequest,
  NoSeasonsAvailableError,
  QuotaRestrictedError,
} from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import SeasonRequest from '@server/entity/SeasonRequest';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { setupTestDb } from '@server/test/db';

// get is a prototype method unlike getMovie, and replaces the cache lookup too
const externalApiGetMock = mock.method(
  ExternalAPI.prototype as unknown as {
    get: (endpoint: string) => Promise<unknown>;
  },
  'get',
  async (endpoint: string) => {
    const tmdbId = Number(endpoint.replace(/^\/(movie|tv)\//, ''));

    if (!tmdbId) {
      throw new Error(`Unstubbed external endpoint: ${endpoint}`);
    }

    return {
      id: tmdbId,
      external_ids: {},
      seasons: [1, 2, 3].map((season_number) => ({ season_number })),
      // Skips getMovie's localized fallback call
      videos: { results: [{ type: 'Trailer', key: 'trailer' }] },
    };
  }
).mock;

mock.method(MediaRequest, 'sendNotification', async () => undefined);

setupTestDb();

beforeEach(() => {
  externalApiGetMock.resetCalls();
});

async function seedRequester(movieQuotaLimit: number): Promise<User> {
  const userRepository = getRepository(User);

  const requester = await userRepository.findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });
  requester.movieQuotaLimit = movieQuotaLimit;

  return userRepository.save(requester);
}

async function createRequester(email: string): Promise<User> {
  return getRepository(User).save(
    new User({ email, permissions: Permission.REQUEST, avatar: '' })
  );
}

function requestMovies(mediaIds: number[], requester: User) {
  return Promise.allSettled(
    mediaIds.map((mediaId) =>
      MediaRequest.request(
        { mediaId, mediaType: MediaType.MOVIE, is4k: false },
        requester
      )
    )
  );
}

function rejections(results: PromiseSettledResult<MediaRequest>[]) {
  return results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
}

describe('MediaRequest.request', () => {
  it('rejects the second of two concurrent requests at the movie quota', async () => {
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(1);

    const results = await requestMovies([11111, 22222], requester);
    const rejected = rejections(results);

    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof QuotaRestrictedError);
    assert.strictEqual(await requestRepository.count(), 1);
    assert.strictEqual(externalApiGetMock.callCount(), 1);
  });

  it('rejects a concurrent duplicate request for the same movie', async () => {
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(5);

    const results = await requestMovies([33333, 33333], requester);
    const rejected = rejections(results);

    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof DuplicateMediaRequestError);
    assert.strictEqual(await requestRepository.count(), 1);
    assert.strictEqual(externalApiGetMock.callCount(), 2);
  });

  it('rejects a duplicate request that omits is4k', async () => {
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(5);
    const body = { mediaId: 66666, mediaType: MediaType.MOVIE };

    await MediaRequest.request(body, requester);

    await assert.rejects(
      () => MediaRequest.request(body, requester),
      DuplicateMediaRequestError
    );
    assert.strictEqual(await requestRepository.count(), 1);
  });

  it('rejects a concurrent duplicate request from a different user', async () => {
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(5);
    const otherRequester = await createRequester('second@seerr.dev');

    const results = await Promise.allSettled(
      [requester, otherRequester].map((user) =>
        MediaRequest.request(
          { mediaId: 44444, mediaType: MediaType.MOVIE, is4k: false },
          user
        )
      )
    );
    const rejected = rejections(results);

    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof DuplicateMediaRequestError);
    assert.strictEqual(await requestRepository.count(), 1);
  });

  it('gives an overlapping season to only one of two concurrent users', async () => {
    const seasonRequestRepository = getRepository(SeasonRequest);
    const requester = await seedRequester(5);
    const otherRequester = await createRequester('second@seerr.dev');

    const results = await Promise.allSettled(
      [
        [requester, [1, 2]],
        [otherRequester, [2, 3]],
      ].map(([user, seasons]) =>
        MediaRequest.request(
          {
            mediaId: 55555,
            mediaType: MediaType.TV,
            seasons: seasons as number[],
            is4k: false,
          },
          user as User
        )
      )
    );

    assert.strictEqual(rejections(results).length, 0);
    assert.strictEqual(
      await seasonRequestRepository.count({ where: { seasonNumber: 2 } }),
      1
    );
    assert.strictEqual(await seasonRequestRepository.count(), 3);
  });

  it('allows a different user to request a movie once it is already available', async () => {
    const requestRepository = getRepository(MediaRequest);
    const mediaRepository = getRepository(Media);
    const requester = await seedRequester(5);
    const otherRequester = await createRequester('second@seerr.dev');

    await MediaRequest.request(
      { mediaId: 77777, mediaType: MediaType.MOVIE, is4k: false },
      requester
    );

    const media = await mediaRepository.findOneOrFail({
      where: { tmdbId: 77777, mediaType: MediaType.MOVIE },
    });
    // Use a raw update, not save(), so MediaSubscriber's auto-complete-on-
    // available cascade doesn't fire and change the first request's status
    // out from under this test.
    await mediaRepository.update(media.id, { status: MediaStatus.AVAILABLE });

    const second = await MediaRequest.request(
      { mediaId: 77777, mediaType: MediaType.MOVIE, is4k: false },
      otherRequester
    );

    assert.strictEqual(second.requestedBy.id, otherRequester.id);
    assert.strictEqual(await requestRepository.count(), 2);
  });

  it('still blocks the same user from requesting a movie again even once it is available', async () => {
    const mediaRepository = getRepository(Media);
    const requester = await seedRequester(5);

    await MediaRequest.request(
      { mediaId: 88888, mediaType: MediaType.MOVIE, is4k: false },
      requester
    );

    const media = await mediaRepository.findOneOrFail({
      where: { tmdbId: 88888, mediaType: MediaType.MOVIE },
    });
    await mediaRepository.update(media.id, { status: MediaStatus.AVAILABLE });

    await assert.rejects(
      () =>
        MediaRequest.request(
          { mediaId: 88888, mediaType: MediaType.MOVIE, is4k: false },
          requester
        ),
      DuplicateMediaRequestError
    );
  });

  it('still blocks the same user from requesting a movie again once their own request is COMPLETED and the media is still available', async () => {
    const requestRepository = getRepository(MediaRequest);
    const mediaRepository = getRepository(Media);
    const requester = await seedRequester(5);

    const first = await MediaRequest.request(
      { mediaId: 77776, mediaType: MediaType.MOVIE, is4k: false },
      requester
    );
    // Raw updates, not save(), so MediaSubscriber's afterUpdate cascade
    // doesn't fire and interfere with this test's isolated setup.
    await requestRepository.update(first.id, {
      status: MediaRequestStatus.COMPLETED,
    });
    const media = await mediaRepository.findOneOrFail({
      where: { tmdbId: 77776, mediaType: MediaType.MOVIE },
    });
    await mediaRepository.update(media.id, { status: MediaStatus.AVAILABLE });

    await assert.rejects(
      () =>
        MediaRequest.request(
          { mediaId: 77776, mediaType: MediaType.MOVIE, is4k: false },
          requester
        ),
      DuplicateMediaRequestError
    );
  });

  it('allows the same user to re-request a movie once their COMPLETED request no longer has available media (e.g. it was deleted)', async () => {
    const requestRepository = getRepository(MediaRequest);
    const mediaRepository = getRepository(Media);
    const requester = await seedRequester(5);

    const first = await MediaRequest.request(
      { mediaId: 77775, mediaType: MediaType.MOVIE, is4k: false },
      requester
    );
    await requestRepository.update(first.id, {
      status: MediaRequestStatus.COMPLETED,
    });
    const media = await mediaRepository.findOneOrFail({
      where: { tmdbId: 77775, mediaType: MediaType.MOVIE },
    });
    await mediaRepository.update(media.id, { status: MediaStatus.DELETED });

    const second = await MediaRequest.request(
      { mediaId: 77775, mediaType: MediaType.MOVIE, is4k: false },
      requester
    );

    assert.strictEqual(second.requestedBy.id, requester.id);
  });

  it('allows a different user to request a season already held by another active request once that season is available', async () => {
    const seasonRequestRepository = getRepository(SeasonRequest);
    const mediaRepository = getRepository(Media);
    const seasonRepository = getRepository(Season);
    const requester = await seedRequester(5);
    const otherRequester = await createRequester('second@seerr.dev');

    await MediaRequest.request(
      { mediaId: 99999, mediaType: MediaType.TV, seasons: [1], is4k: false },
      requester
    );

    const media = await mediaRepository.findOneOrFail({
      where: { tmdbId: 99999, mediaType: MediaType.TV },
    });
    await seasonRepository.save(
      new Season({
        seasonNumber: 1,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
        media: Promise.resolve(media),
      })
    );

    const second = await MediaRequest.request(
      { mediaId: 99999, mediaType: MediaType.TV, seasons: [1], is4k: false },
      otherRequester
    );

    assert.strictEqual(second.requestedBy.id, otherRequester.id);
    assert.strictEqual(
      await seasonRequestRepository.count({ where: { seasonNumber: 1 } }),
      2
    );
  });

  it('allows requesting an already-available season that has no existing request at all', async () => {
    const mediaRepository = getRepository(Media);
    const seasonRepository = getRepository(Season);
    const requester = await createRequester('third@seerr.dev');

    // Seed the media/season directly with no prior request, mirroring a
    // title whose availability was picked up by a library scan rather than
    // a request.
    const media = await mediaRepository.save(
      new Media({
        mediaType: MediaType.TV,
        tmdbId: 111111,
        status: MediaStatus.UNKNOWN,
        status4k: MediaStatus.UNKNOWN,
      })
    );
    await seasonRepository.save(
      new Season({
        seasonNumber: 1,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
        media: Promise.resolve(media),
      })
    );

    const request = await MediaRequest.request(
      { mediaId: 111111, mediaType: MediaType.TV, seasons: [1], is4k: false },
      requester
    );

    assert.strictEqual(request.requestedBy.id, requester.id);
    assert.strictEqual(
      request.seasons.map((s) => s.seasonNumber).includes(1),
      true
    );
  });

  it('still blocks the same user from requesting a season again once their own request is COMPLETED and the season is still available', async () => {
    const requestRepository = getRepository(MediaRequest);
    const mediaRepository = getRepository(Media);
    const seasonRepository = getRepository(Season);
    const requester = await seedRequester(5);

    const first = await MediaRequest.request(
      { mediaId: 111112, mediaType: MediaType.TV, seasons: [1], is4k: false },
      requester
    );
    await requestRepository.update(first.id, {
      status: MediaRequestStatus.COMPLETED,
    });
    const media = await mediaRepository.findOneOrFail({
      where: { tmdbId: 111112, mediaType: MediaType.TV },
    });
    await seasonRepository.save(
      new Season({
        seasonNumber: 1,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
        media: Promise.resolve(media),
      })
    );

    await assert.rejects(
      () =>
        MediaRequest.request(
          {
            mediaId: 111112,
            mediaType: MediaType.TV,
            seasons: [1],
            is4k: false,
          },
          requester
        ),
      NoSeasonsAvailableError
    );
  });

  it('allows the same user to re-request a season once their COMPLETED request season is no longer available (e.g. it was deleted)', async () => {
    const requestRepository = getRepository(MediaRequest);
    const mediaRepository = getRepository(Media);
    const seasonRepository = getRepository(Season);
    const requester = await seedRequester(5);

    const first = await MediaRequest.request(
      { mediaId: 111113, mediaType: MediaType.TV, seasons: [1], is4k: false },
      requester
    );
    await requestRepository.update(first.id, {
      status: MediaRequestStatus.COMPLETED,
    });
    const media = await mediaRepository.findOneOrFail({
      where: { tmdbId: 111113, mediaType: MediaType.TV },
    });
    await seasonRepository.save(
      new Season({
        seasonNumber: 1,
        status: MediaStatus.DELETED,
        status4k: MediaStatus.UNKNOWN,
        media: Promise.resolve(media),
      })
    );

    const second = await MediaRequest.request(
      { mediaId: 111113, mediaType: MediaType.TV, seasons: [1], is4k: false },
      requester
    );

    assert.strictEqual(second.requestedBy.id, requester.id);
  });
});
