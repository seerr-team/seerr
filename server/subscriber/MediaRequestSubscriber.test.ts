import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import type { SonarrSeries } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import type { TmdbTvDetails } from '@server/api/themoviedb/interfaces';
import Tvdb from '@server/api/tvdb';
import type { TvdbOfficialSeason } from '@server/api/tvdb/interfaces';
import {
  MediaRequestFailureReason,
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import SeasonRequest from '@server/entity/SeasonRequest';
import { User } from '@server/entity/User';
import { Notification } from '@server/lib/notifications';
import { getSettings } from '@server/lib/settings';
import { MediaRequestSubscriber } from '@server/subscriber/MediaRequestSubscriber';
import { setupTestDb } from '@server/test/db';

let tvShow: TmdbTvDetails;

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  get() {
    return async () => tvShow;
  },
  set() {},
  configurable: true,
});

function fakeShow(
  tmdbId: number,
  seasons: { season_number: number; air_date: string }[],
  tvdbId?: number
): TmdbTvDetails {
  return {
    id: tmdbId,
    name: 'Test Show',
    external_ids: { tvdb_id: tvdbId },
    keywords: { results: [] },
    seasons: seasons.map((season) => ({ ...season, episode_count: 10 })),
  } as unknown as TmdbTvDetails;
}

function configureSonarr(): void {
  getSettings().sonarr = [
    {
      id: 0,
      name: 'Sonarr',
      hostname: 'localhost',
      port: 8989,
      apiKey: 'test-key',
      baseUrl: '',
      useSsl: false,
      activeProfileId: 1,
      activeProfileName: 'HD',
      activeDirectory: '/tv',
      activeLanguageProfileId: 1,
      animeTags: [],
      seriesType: 'standard',
      animeSeriesType: 'anime',
      monitorNewItems: 'all',
      enableSeasonFolders: true,
      is4k: false,
      tags: [],
      isDefault: true,
      syncEnabled: true,
      preventSearch: false,
      tagRequests: false,
      overrideRule: [],
      externalUrl: '',
    },
  ];
}

function mockSendNotification() {
  return mock.method(MediaRequest, 'sendNotification', async () => undefined)
    .mock;
}

let sendNotification: ReturnType<typeof mockSendNotification>;

function stubProviders({
  resolveTvdbId = null,
  officialSeasons = [],
  sonarrSeries = null,
}: {
  resolveTvdbId?: number | null;
  officialSeasons?: TvdbOfficialSeason[] | null | Error;
  sonarrSeries?: Partial<SonarrSeries> | null;
}) {
  mock.method(
    Tvdb,
    'getInstance',
    async () =>
      ({
        resolveTvdbId: async () => resolveTvdbId,
        getOfficialSeasons: async () => {
          if (officialSeasons instanceof Error) {
            throw officialSeasons;
          }

          return officialSeasons;
        },
      }) as unknown as Tvdb
  );

  mock.method(
    SonarrAPI.prototype,
    'getSeriesByTmdbId',
    async () => sonarrSeries as SonarrSeries | null
  );

  return mock.method(
    SonarrAPI.prototype,
    'addSeries',
    async () => ({ id: 1, titleSlug: 'test-show' }) as unknown as SonarrSeries
  ).mock;
}

async function seedApprovedRequest(
  tmdbId: number,
  seasonNumbers: number[],
  tvdbId?: number
) {
  const requester = await getRepository(User).findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });

  const media = await getRepository(Media).save(
    new Media({
      mediaType: MediaType.TV,
      tmdbId,
      tvdbId,
      status: MediaStatus.PENDING,
      status4k: MediaStatus.UNKNOWN,
    })
  );

  // insert with listeners off so the subscriber under test does not run on seed
  const inserted = await getRepository(MediaRequest)
    .createQueryBuilder()
    .insert()
    .into(MediaRequest)
    .values({
      status: MediaRequestStatus.APPROVED,
      media: { id: media.id },
      requestedBy: { id: requester.id },
      type: MediaType.TV,
      is4k: false,
    })
    .callListeners(false)
    .execute();

  const requestId = inserted.identifiers[0].id as number;

  await getRepository(SeasonRequest).save(
    seasonNumbers.map(
      (seasonNumber) =>
        new SeasonRequest({
          seasonNumber,
          status: MediaRequestStatus.APPROVED,
          request: { id: requestId } as MediaRequest,
        })
    )
  );

  const entity = await getRepository(MediaRequest).findOneOrFail({
    where: { id: requestId },
    relations: { media: true, seasons: true, requestedBy: true },
  });

  return { entity, media };
}

async function run(entity: MediaRequest) {
  await new MediaRequestSubscriber().sendToSonarr(
    entity,
    getRepository(MediaRequest).manager
  );

  // let the detached addSeries chain settle
  await new Promise((resolve) => setImmediate(resolve));
}

function storedMedia(id: number) {
  return getRepository(Media).findOneOrFail({ where: { id } });
}

setupTestDb();

beforeEach(() => {
  configureSonarr();
  sendNotification = mockSendNotification();
});

afterEach(() => mock.restoreAll());

describe('MediaRequestSubscriber sendToSonarr, TVDB ID resolution', () => {
  it('persists a TVDB ID resolved from TheTVDB', async () => {
    tvShow = fakeShow(90001, [{ season_number: 1, air_date: '2020-01-05' }]);
    const addSeries = stubProviders({
      resolveTvdbId: 184871,
      officialSeasons: [{ seasonNumber: 1, year: 2020 }],
    });

    const { entity, media } = await seedApprovedRequest(90001, [1]);
    await run(entity);

    assert.strictEqual((await storedMedia(media.id)).tvdbId, 184871);
    assert.strictEqual(addSeries.callCount(), 1);
  });

  it('falls back to Sonarr when TheTVDB cannot resolve the ID', async () => {
    tvShow = fakeShow(90002, [{ season_number: 1, air_date: '2020-01-05' }]);
    const addSeries = stubProviders({
      resolveTvdbId: null,
      sonarrSeries: { tvdbId: 555555 },
      officialSeasons: [{ seasonNumber: 1, year: 2020 }],
    });

    const { entity, media } = await seedApprovedRequest(90002, [1]);
    await run(entity);

    assert.strictEqual((await storedMedia(media.id)).tvdbId, 555555);
    assert.strictEqual(addSeries.callCount(), 1);
  });

  it('skips the backfill when another media row already owns the ID', async () => {
    tvShow = fakeShow(90003, [{ season_number: 1, air_date: '2020-01-05' }]);
    const addSeries = stubProviders({
      resolveTvdbId: 184871,
      officialSeasons: [{ seasonNumber: 1, year: 2020 }],
    });

    await getRepository(Media).save(
      new Media({
        mediaType: MediaType.TV,
        tmdbId: 90099,
        tvdbId: 184871,
        status: MediaStatus.UNKNOWN,
        status4k: MediaStatus.UNKNOWN,
      })
    );

    const { entity, media } = await seedApprovedRequest(90003, [1]);
    await run(entity);

    assert.strictEqual((await storedMedia(media.id)).tvdbId, null);
    assert.strictEqual(addSeries.callCount(), 1);
  });

  it('fails the request without deleting it when nothing resolves the ID', async () => {
    tvShow = fakeShow(90004, [{ season_number: 1, air_date: '2020-01-05' }]);
    const addSeries = stubProviders({
      resolveTvdbId: null,
      sonarrSeries: null,
    });

    const { entity, media } = await seedApprovedRequest(90004, [1]);
    await run(entity);

    assert.strictEqual(entity.status, MediaRequestStatus.FAILED);
    assert.strictEqual(addSeries.callCount(), 0);
    assert.strictEqual(sendNotification.callCount(), 1);
    assert.strictEqual(
      sendNotification.calls[0].arguments[2],
      Notification.MEDIA_FAILED
    );
    assert.strictEqual(
      entity.failureReason,
      MediaRequestFailureReason.TVDB_ID_UNRESOLVED
    );
    await assert.doesNotReject(() => storedMedia(media.id));
    await assert.doesNotReject(() =>
      getRepository(MediaRequest).findOneOrFail({ where: { id: entity.id } })
    );
  });
});

describe('MediaRequestSubscriber sendToSonarr, season guard', () => {
  it('sends the requested season numbers unchanged when they match TVDB', async () => {
    tvShow = fakeShow(90010, [
      { season_number: 1, air_date: '2020-01-05' },
      { season_number: 2, air_date: '2021-01-05' },
    ]);
    const addSeries = stubProviders({
      resolveTvdbId: 184871,
      officialSeasons: [
        { seasonNumber: 1, year: 2020 },
        { seasonNumber: 2, year: 2021 },
      ],
    });

    const { entity } = await seedApprovedRequest(90010, [1, 2]);
    await run(entity);

    assert.strictEqual(addSeries.callCount(), 1);

    const options = addSeries.calls[0].arguments[0] as {
      tvdbid: number;
      seasons: number[];
    };
    assert.strictEqual(options.tvdbid, 184871);
    assert.deepStrictEqual(options.seasons.sort(), [1, 2]);
  });

  it('fails the request when a requested season does not match TVDB', async () => {
    tvShow = fakeShow(90011, [{ season_number: 8, air_date: '2024-09-24' }]);
    const addSeries = stubProviders({
      resolveTvdbId: 184871,
      officialSeasons: [{ seasonNumber: 8, year: 2017 }],
    });

    const { entity } = await seedApprovedRequest(90011, [8]);
    await run(entity);

    assert.strictEqual(entity.status, MediaRequestStatus.FAILED);
    assert.strictEqual(
      entity.failureReason,
      MediaRequestFailureReason.SEASON_NUMBERING_MISMATCH
    );
    assert.strictEqual(addSeries.callCount(), 0);
    assert.strictEqual(
      sendNotification.calls[0].arguments[2],
      Notification.MEDIA_FAILED
    );
  });

  it('fails the whole request when only one of two seasons matches', async () => {
    tvShow = fakeShow(90012, [
      { season_number: 1, air_date: '2020-01-05' },
      { season_number: 2, air_date: '2021-01-05' },
    ]);
    const addSeries = stubProviders({
      resolveTvdbId: 184871,
      officialSeasons: [
        { seasonNumber: 1, year: 2020 },
        { seasonNumber: 2, year: 2019 },
      ],
    });

    const { entity } = await seedApprovedRequest(90012, [1, 2]);
    await run(entity);

    assert.strictEqual(entity.status, MediaRequestStatus.FAILED);
    assert.strictEqual(addSeries.callCount(), 0);
    assert.strictEqual(sendNotification.callCount(), 1);
  });

  it('dispatches a request mixing specials with a matching season', async () => {
    tvShow = fakeShow(90014, [
      { season_number: 0, air_date: '2019-12-25' },
      { season_number: 1, air_date: '2020-01-05' },
    ]);
    const addSeries = stubProviders({
      resolveTvdbId: 184871,
      officialSeasons: [{ seasonNumber: 1, year: 2020 }],
    });

    const { entity } = await seedApprovedRequest(90014, [0, 1]);
    await run(entity);

    assert.strictEqual(addSeries.callCount(), 1);

    const options = addSeries.calls[0].arguments[0] as { seasons: number[] };
    assert.deepStrictEqual(options.seasons.sort(), [0, 1]);
  });

  it('fails the request when the TVDB season lookup throws', async () => {
    tvShow = fakeShow(90016, [{ season_number: 1, air_date: '2020-01-05' }]);
    const addSeries = stubProviders({
      resolveTvdbId: 184871,
      officialSeasons: new Error('connect ECONNREFUSED'),
    });

    const { entity } = await seedApprovedRequest(90016, [1]);
    await run(entity);

    assert.strictEqual(entity.status, MediaRequestStatus.FAILED);
    assert.strictEqual(
      entity.failureReason,
      MediaRequestFailureReason.SEASON_NUMBERING_UNVERIFIED
    );
    assert.strictEqual(addSeries.callCount(), 0);
    assert.strictEqual(
      sendNotification.calls[0].arguments[2],
      Notification.MEDIA_FAILED
    );
  });

  it('fails the request when TheTVDB returns an incomplete record', async () => {
    tvShow = fakeShow(90017, [{ season_number: 1, air_date: '2020-01-05' }]);
    const addSeries = stubProviders({
      resolveTvdbId: 184871,
      officialSeasons: null,
    });

    const { entity } = await seedApprovedRequest(90017, [1]);
    await run(entity);

    assert.strictEqual(entity.status, MediaRequestStatus.FAILED);
    assert.strictEqual(addSeries.callCount(), 0);
    assert.strictEqual(sendNotification.callCount(), 1);
  });

  it('dispatches when TheTVDB confirms the show has no official seasons', async () => {
    tvShow = fakeShow(90018, [{ season_number: 1, air_date: '2020-01-05' }]);
    const addSeries = stubProviders({
      resolveTvdbId: 184871,
      officialSeasons: [],
    });

    const { entity } = await seedApprovedRequest(90018, [1]);
    await run(entity);

    assert.strictEqual(addSeries.callCount(), 1);
    assert.strictEqual(entity.status, MediaRequestStatus.APPROVED);
  });

  it('dispatches a specials-only request', async () => {
    tvShow = fakeShow(90015, [{ season_number: 0, air_date: '2019-12-25' }]);
    const addSeries = stubProviders({
      resolveTvdbId: 184871,
      officialSeasons: [{ seasonNumber: 1, year: 2020 }],
    });

    const { entity } = await seedApprovedRequest(90015, [0]);
    await run(entity);

    assert.strictEqual(addSeries.callCount(), 1);
    assert.strictEqual(entity.status, MediaRequestStatus.APPROVED);
  });

  it('does not guard shows TMDB already has a TVDB ID for', async () => {
    tvShow = fakeShow(
      90013,
      [{ season_number: 8, air_date: '2024-09-24' }],
      184871
    );
    const addSeries = stubProviders({
      officialSeasons: [{ seasonNumber: 8, year: 2017 }],
    });

    const { entity } = await seedApprovedRequest(90013, [8]);
    await run(entity);

    assert.strictEqual(addSeries.callCount(), 1);
    assert.strictEqual(entity.status, MediaRequestStatus.APPROVED);
  });
});
