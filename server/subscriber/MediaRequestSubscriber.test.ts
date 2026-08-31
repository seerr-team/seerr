import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

import ExternalAPI from '@server/api/externalapi';
import type { Tag } from '@server/api/servarr/base';
import type { RadarrMovie } from '@server/api/servarr/radarr';
import RadarrAPI from '@server/api/servarr/radarr';
import type { SonarrSeries } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import SeasonRequest from '@server/entity/SeasonRequest';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';

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
    if (endpoint.startsWith('/movie/')) {
      return {
        id: tmdbId,
        title: 'Test Movie',
        release_date: '2020-01-01',
        external_ids: {},
        genres: [],
        keywords: { keywords: [] },
        videos: { results: [{ type: 'Trailer', key: 'trailer' }] },
      };
    }
    return {
      id: tmdbId,
      name: 'Test Show',
      external_ids: { tvdb_id: tmdbId },
      keywords: { results: [] },
      seasons: [1, 2, 3].map((season_number) => ({ season_number })),
      videos: { results: [{ type: 'Trailer', key: 'trailer' }] },
    };
  }
).mock;

let getMovieByTmdbIdImpl: (id: number) => Promise<RadarrMovie> = async () => {
  throw new Error('Unstubbed getMovieByTmdbId');
};
Object.defineProperty(RadarrAPI.prototype, 'getMovieByTmdbId', {
  get() {
    return async (id: number) => getMovieByTmdbIdImpl(id);
  },
  set() {},
  configurable: true,
});

let addMovieImpl: RadarrAPI['addMovie'] = async () => {
  throw new Error('Unstubbed addMovie');
};
Object.defineProperty(RadarrAPI.prototype, 'addMovie', {
  get() {
    return async (options: Parameters<RadarrAPI['addMovie']>[0]) =>
      addMovieImpl(options);
  },
  set() {},
  configurable: true,
});

let radarrGetTagsImpl: () => Promise<Tag[]> = async () => [];
Object.defineProperty(RadarrAPI.prototype, 'getTags', {
  get() {
    return async () => radarrGetTagsImpl();
  },
  set() {},
  configurable: true,
});

let radarrCreateTagImpl: (args: { label: string }) => Promise<Tag> = async ({
  label,
}) => ({ id: 1, label });
Object.defineProperty(RadarrAPI.prototype, 'createTag', {
  get() {
    return async (args: { label: string }) => radarrCreateTagImpl(args);
  },
  set() {},
  configurable: true,
});

// --- Mock SonarrAPI's arrow-function instance methods, same pattern ---
let addSeriesImpl: SonarrAPI['addSeries'] = async () => {
  throw new Error('Unstubbed addSeries');
};
Object.defineProperty(SonarrAPI.prototype, 'addSeries', {
  get() {
    return async (options: Parameters<SonarrAPI['addSeries']>[0]) =>
      addSeriesImpl(options);
  },
  set() {},
  configurable: true,
});

let sonarrGetTagsImpl: () => Promise<Tag[]> = async () => [];
Object.defineProperty(SonarrAPI.prototype, 'getTags', {
  get() {
    return async () => sonarrGetTagsImpl();
  },
  set() {},
  configurable: true,
});

let sonarrCreateTagImpl: (args: { label: string }) => Promise<Tag> = async ({
  label,
}) => ({ id: 1, label });
Object.defineProperty(SonarrAPI.prototype, 'createTag', {
  get() {
    return async (args: { label: string }) => sonarrCreateTagImpl(args);
  },
  set() {},
  configurable: true,
});

mock.method(MediaRequest, 'sendNotification', async () => undefined);

setupTestDb();

beforeEach(() => {
  externalApiGetMock.resetCalls();
  getMovieByTmdbIdImpl = async () => {
    throw new Error('Unstubbed getMovieByTmdbId');
  };
  addMovieImpl = async () => {
    throw new Error('Unstubbed addMovie');
  };
  addSeriesImpl = async () => {
    throw new Error('Unstubbed addSeries');
  };
  radarrGetTagsImpl = async () => [];
  sonarrGetTagsImpl = async () => [];
  radarrCreateTagImpl = async ({ label }) => ({ id: 1, label });
  sonarrCreateTagImpl = async ({ label }) => ({ id: 1, label });

  const settings = getSettings();
  settings.radarr = [
    {
      id: 0,
      name: 'Radarr',
      hostname: 'localhost',
      port: 7878,
      apiKey: 'test-key',
      baseUrl: '',
      useSsl: false,
      activeProfileId: 1,
      activeProfileName: 'Default',
      activeDirectory: '/movies',
      minimumAvailability: 'released',
      tags: [],
      is4k: false,
      isDefault: true,
      syncEnabled: true,
      preventSearch: false,
      tagRequests: true,
      overrideRule: [],
      externalUrl: '',
    } as unknown as RadarrSettings,
  ];
  settings.sonarr = [
    {
      id: 0,
      name: 'Sonarr',
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
      isDefault: true,
      syncEnabled: true,
      preventSearch: false,
      tagRequests: true,
      seriesType: 'standard',
      animeSeriesType: 'anime',
      monitorNewItems: 'all',
      externalUrl: '',
    } as unknown as SonarrSettings,
  ];
});

async function waitFor(
  condition: () => boolean | Promise<boolean>,
  { timeoutMs = 2000, intervalMs = 10 } = {}
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
}

async function seedRequester(email: string): Promise<User> {
  return getRepository(User).save(
    new User({
      email,
      username: email.split('@')[0],
      displayName: email.split('@')[0],
      permissions: Permission.REQUEST,
      avatar: '',
    })
  );
}

async function seedMovie(tmdbId: number, status: MediaStatus): Promise<Media> {
  return getRepository(Media).save(
    new Media({
      mediaType: MediaType.MOVIE,
      tmdbId,
      status,
      status4k: MediaStatus.UNKNOWN,
    })
  );
}

async function seedShow(tmdbId: number, tvdbId: number): Promise<Media> {
  return getRepository(Media).save(
    new Media({
      mediaType: MediaType.TV,
      tmdbId,
      tvdbId,
      status: MediaStatus.AVAILABLE,
      status4k: MediaStatus.UNKNOWN,
    })
  );
}

async function insertMovieRequest(
  media: Media,
  requester: User
): Promise<MediaRequest> {
  return getRepository(MediaRequest).save(
    new MediaRequest({
      type: MediaType.MOVIE,
      media,
      requestedBy: requester,
      status: MediaRequestStatus.APPROVED,
      is4k: false,
    })
  );
}

async function insertShowRequest(
  media: Media,
  requester: User,
  seasonNumbers: number[]
): Promise<MediaRequest> {
  const requestRepository = getRepository(MediaRequest);

  const request = new MediaRequest({
    type: MediaType.TV,
    media,
    requestedBy: requester,
    status: MediaRequestStatus.APPROVED,
    is4k: false,
    seasons: seasonNumbers.map(
      (seasonNumber) =>
        new SeasonRequest({
          seasonNumber,
          status: MediaRequestStatus.APPROVED,
        })
    ),
  });
  const saved = await requestRepository.save(request);

  return requestRepository.findOneOrFail({
    where: { id: saved.id },
    relations: { seasons: true, requestedBy: true, media: true },
  });
}

function radarrMovie(overrides: Partial<RadarrMovie> = {}): RadarrMovie {
  return {
    id: 7,
    title: 'Test Movie',
    isAvailable: true,
    monitored: true,
    tmdbId: 12345,
    imdbId: 'tt1',
    titleSlug: 'test-movie',
    folderName: 'Test Movie',
    path: '/movies/Test Movie',
    profileId: 1,
    qualityProfileId: 1,
    added: '2020-01-01',
    hasFile: true,
    tags: [],
    ...overrides,
  } as RadarrMovie;
}

function sonarrSeries(overrides: Partial<SonarrSeries> = {}): SonarrSeries {
  return {
    id: 7,
    title: 'Test Show',
    titleSlug: 'test-show',
    tvdbId: 54321,
    tags: [],
    seasons: [],
    ...overrides,
  } as unknown as SonarrSeries;
}

describe('MediaRequestSubscriber.sendToRadarr', () => {
  it('completes the request and includes the requester tag when the movie is already available', async () => {
    const requester = await seedRequester('avail-movie@seerr.dev');
    const media = await seedMovie(12345, MediaStatus.AVAILABLE);

    radarrGetTagsImpl = async () => [
      { id: 9, label: `${requester.id}-${requester.displayName}` },
    ];

    let receivedTags: number[] | undefined;
    addMovieImpl = async (options) => {
      receivedTags = options.tags;
      return radarrMovie({ hasFile: true, tags: options.tags });
    };

    const request = await insertMovieRequest(media, requester);

    // Wait for the subscriber's fire-and-forget addMovie chain to settle.
    await waitFor(() => receivedTags !== undefined);

    assert.ok(receivedTags?.includes(9), 'expected requester tag to be sent');

    const requestRepository = getRepository(MediaRequest);
    await waitFor(async () => {
      const persisted = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });
      return persisted.status !== MediaRequestStatus.APPROVED;
    });

    const finalRequest = await requestRepository.findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(finalRequest.status, MediaRequestStatus.COMPLETED);

    const persistedMedia = await getRepository(Media).findOneOrFail({
      where: { id: media.id },
    });
    assert.strictEqual(persistedMedia.externalServiceId, 7);
    assert.strictEqual(persistedMedia.externalServiceSlug, 'test-movie');
    assert.strictEqual(persistedMedia.serviceId, 0);
  });

  it('marks the request FAILED, not COMPLETED, when addMovie rejects for already-available media', async () => {
    const requester = await seedRequester('fail-movie@seerr.dev');
    const media = await seedMovie(23456, MediaStatus.AVAILABLE);

    addMovieImpl = async () => {
      throw new Error('Radarr is unreachable');
    };

    const request = await insertMovieRequest(media, requester);

    const requestRepository = getRepository(MediaRequest);
    await waitFor(async () => {
      const persisted = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });
      return persisted.status !== MediaRequestStatus.APPROVED;
    });

    const finalRequest = await requestRepository.findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(finalRequest.status, MediaRequestStatus.FAILED);
  });

  it('does not mark the request COMPLETED when the movie is not yet available', async () => {
    const requester = await seedRequester('pending-movie@seerr.dev');
    const media = await seedMovie(34567, MediaStatus.PENDING);

    let called = false;
    addMovieImpl = async (options) => {
      called = true;
      return radarrMovie({ hasFile: false, tags: options.tags });
    };

    const request = await insertMovieRequest(media, requester);

    await waitFor(() => called);

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
  });
});

describe('MediaRequestSubscriber.sendToSonarr', () => {
  it('completes the request and includes the requester tag when the season is already available', async () => {
    const requester = await seedRequester('avail-show@seerr.dev');
    const media = await seedShow(99001, 5001);
    await getRepository(Season).save(
      new Season({
        seasonNumber: 1,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
        media: Promise.resolve(media),
      })
    );
    sonarrGetTagsImpl = async () => [
      { id: 11, label: `${requester.id}-${requester.displayName}` },
    ];

    let receivedTags: number[] | undefined;
    addSeriesImpl = async (options) => {
      receivedTags = options.tags;
      return sonarrSeries({ tags: options.tags });
    };

    const request = await insertShowRequest(media, requester, [1]);

    await waitFor(() => receivedTags !== undefined);

    assert.ok(receivedTags?.includes(11), 'expected requester tag to be sent');

    const requestRepository = getRepository(MediaRequest);
    await waitFor(async () => {
      const persisted = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });
      return persisted.status !== MediaRequestStatus.APPROVED;
    });

    const finalRequest = await requestRepository.findOneOrFail({
      where: { id: request.id },
      relations: { seasons: true },
    });
    assert.strictEqual(finalRequest.status, MediaRequestStatus.COMPLETED);
    assert.ok(
      finalRequest.seasons.every(
        (s) => s.status === MediaRequestStatus.COMPLETED
      )
    );

    const persistedMedia = await getRepository(Media).findOneOrFail({
      where: { id: media.id },
    });
    assert.strictEqual(persistedMedia.externalServiceId, 7);
    assert.strictEqual(persistedMedia.externalServiceSlug, 'test-show');
    assert.strictEqual(persistedMedia.serviceId, 0);
  });

  it('marks the request FAILED, not COMPLETED, when addSeries rejects for an already-available season', async () => {
    const requester = await seedRequester('fail-show@seerr.dev');
    const media = await seedShow(99002, 5002);
    await getRepository(Season).save(
      new Season({
        seasonNumber: 1,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
        media: Promise.resolve(media),
      })
    );
    addSeriesImpl = async () => {
      throw new Error('Sonarr is unreachable');
    };

    const request = await insertShowRequest(media, requester, [1]);

    const requestRepository = getRepository(MediaRequest);
    await waitFor(async () => {
      const persisted = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });
      return persisted.status !== MediaRequestStatus.APPROVED;
    });

    const finalRequest = await requestRepository.findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(finalRequest.status, MediaRequestStatus.FAILED);
  });
});
