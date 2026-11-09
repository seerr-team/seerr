import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { beforeEach, describe, it, mock } from 'node:test';

import ExternalAPI from '@server/api/externalapi';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import Tvdb from '@server/api/tvdb';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import {
  DuplicateMediaRequestError,
  MediaRequest,
  NoSeasonsAvailableError,
  QuotaRestrictedError,
} from '@server/entity/MediaRequest';
import SeasonRequest from '@server/entity/SeasonRequest';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { MetadataProviderType, getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';

const EMPTY_SEASON = 4;
const TVDB_ONLY_SEASON = 5;
const ANIME_SHOW_ID = 66001;

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
      keywords: {
        results: tmdbId === ANIME_SHOW_ID ? [{ id: ANIME_KEYWORD_ID }] : [],
      },
      seasons: [
        { season_number: 1, episode_count: 10 },
        { season_number: 2, episode_count: 10 },
        { season_number: 3, episode_count: 10 },
        { season_number: EMPTY_SEASON, episode_count: 0 },
      ],
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
    where: { email: 'demo@seerr.dev' },
  });
  requester.movieQuotaLimit = movieQuotaLimit;

  return userRepository.save(requester);
}

async function createRequester(
  email: string,
  permissions = Permission.REQUEST
): Promise<User> {
  return getRepository(User).save(new User({ email, permissions, avatar: '' }));
}

function useTvdbFor(t: TestContext, mediaType: 'tv' | 'anime') {
  const { metadataSettings } = getSettings();
  const prior = metadataSettings[mediaType];
  metadataSettings[mediaType] = MetadataProviderType.TVDB;
  t.after(() => {
    metadataSettings[mediaType] = prior;
  });

  t.mock.method(Tvdb, 'getInstance', async () => ({
    getTvShow: async () => ({
      seasons: [
        { season_number: 1, episode_count: 10 },
        { season_number: TVDB_ONLY_SEASON, episode_count: 10 },
      ],
    }),
  }));
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

  it('does not save requested seasons with no episodes on TMDB', async () => {
    const seasonRequestRepository = getRepository(SeasonRequest);
    const requester = await seedRequester(5);

    await MediaRequest.request(
      {
        mediaId: 77777,
        mediaType: MediaType.TV,
        seasons: [1, EMPTY_SEASON, 99],
        is4k: false,
      },
      requester
    );

    const saved = await seasonRequestRepository.find();
    assert.deepStrictEqual(
      saved.map((season) => season.seasonNumber),
      [1]
    );
  });

  it('rejects a request for only a season with no episodes', async () => {
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(5);

    await assert.rejects(
      () =>
        MediaRequest.request(
          {
            mediaId: 77778,
            mediaType: MediaType.TV,
            seasons: [EMPTY_SEASON],
            is4k: false,
          },
          requester
        ),
      NoSeasonsAvailableError
    );
    assert.strictEqual(await requestRepository.count(), 0);
  });

  it('requests a season only the TVDB provider has', async (t) => {
    const seasonRequestRepository = getRepository(SeasonRequest);
    const requester = await seedRequester(5);
    useTvdbFor(t, 'tv');

    await MediaRequest.request(
      {
        mediaId: 77779,
        mediaType: MediaType.TV,
        seasons: [TVDB_ONLY_SEASON],
        is4k: false,
      },
      requester
    );

    const saved = await seasonRequestRepository.find();
    assert.deepStrictEqual(
      saved.map((season) => season.seasonNumber),
      [TVDB_ONLY_SEASON]
    );
  });

  it("uses the anime provider's seasons for an 'all' request", async (t) => {
    const seasonRequestRepository = getRepository(SeasonRequest);
    const requester = await seedRequester(5);
    useTvdbFor(t, 'anime');

    await MediaRequest.request(
      {
        mediaId: ANIME_SHOW_ID,
        mediaType: MediaType.TV,
        seasons: 'all',
        is4k: false,
      },
      requester
    );

    const saved = await seasonRequestRepository.find();
    assert.deepStrictEqual(
      saved.map((season) => season.seasonNumber).sort((a, b) => a - b),
      [1, TVDB_ONLY_SEASON]
    );
  });

  it('creates one media row for concurrent 4k and non-4k requests', async () => {
    const mediaRepository = getRepository(Media);
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(5);
    const otherRequester = await createRequester(
      'second@seerr.dev',
      Permission.REQUEST_4K
    );

    const results = await Promise.allSettled(
      [
        [requester, false],
        [otherRequester, true],
      ].map(([user, is4k]) =>
        MediaRequest.request(
          { mediaId: 88888, mediaType: MediaType.MOVIE, is4k: is4k as boolean },
          user as User
        )
      )
    );

    assert.strictEqual(rejections(results).length, 0);
    assert.strictEqual(await requestRepository.count(), 2);
    assert.strictEqual(
      await mediaRepository.count({
        where: { tmdbId: 88888, mediaType: MediaType.MOVIE },
      }),
      1
    );
  });
});
