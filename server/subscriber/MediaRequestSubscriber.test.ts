import type { AddSeriesOptions } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type { TmdbTvDetails } from '@server/api/themoviedb/interfaces';
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
import type { SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { MediaRequestSubscriber } from '@server/subscriber/MediaRequestSubscriber';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

function fakeTmdbShow(
  tmdbId: number,
  keywordIds: number[] = []
): TmdbTvDetails {
  return {
    id: tmdbId,
    content_ratings: { results: [] },
    created_by: [],
    episode_run_time: [],
    first_air_date: '2024-01-01',
    genres: [],
    homepage: '',
    in_production: false,
    languages: ['en'],
    last_air_date: '2024-01-01',
    name: 'Test Show',
    networks: [],
    number_of_episodes: 10,
    number_of_seasons: 1,
    origin_country: ['US'],
    original_language: 'en',
    original_name: 'Test Show',
    overview: '',
    popularity: 0,
    production_companies: [],
    production_countries: [],
    spoken_languages: [],
    seasons: [
      {
        id: 1,
        air_date: '2024-01-01',
        episode_count: 10,
        name: 'Season 1',
        overview: '',
        season_number: 1,
      },
    ],
    status: 'Ended',
    type: 'Scripted',
    vote_average: 0,
    vote_count: 0,
    aggregate_credits: { cast: [] },
    credits: { crew: [] },
    external_ids: { tvdb_id: 550 },
    keywords: {
      results: keywordIds.map((id) => ({ id, name: `keyword-${id}` })),
    },
    videos: { results: [] },
  } as unknown as TmdbTvDetails;
}

let getTvShowImpl: () => Promise<TmdbTvDetails> = async () => fakeTmdbShow(1);

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  set() {},
  get() {
    return async () => getTvShowImpl();
  },
  configurable: true,
});

let addSeriesOptions: AddSeriesOptions | null = null;

Object.defineProperty(SonarrAPI.prototype, 'addSeries', {
  set() {},
  get() {
    return async (options: AddSeriesOptions) => {
      addSeriesOptions = options;
      return { id: 1, titleSlug: 'test-show' };
    };
  },
  configurable: true,
});

mock.method(MediaRequest, 'sendNotification', async () => undefined);

setupTestDb();

function configureSonarr(overrides: Partial<SonarrSettings> = {}): void {
  const settings = getSettings();
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
      activeAnimeProfileId: undefined,
      activeAnimeDirectory: '',
      activeAnimeLanguageProfileId: undefined,
      animeTags: [],
      is4k: false,
      enableSeasonFolders: true,
      tags: [],
      isDefault: true,
      syncEnabled: true,
      preventSearch: false,
      externalUrl: '',
      ...overrides,
    },
  ] as SonarrSettings[];
  settings.radarr = [];
}

async function seedApprovedTvRequest(
  overrides: Partial<MediaRequest> = {}
): Promise<MediaRequest> {
  const userRepo = getRepository(User);
  const mediaRepo = getRepository(Media);
  const requestRepo = getRepository(MediaRequest);

  const requestedBy = await userRepo.findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });

  const media = await mediaRepo.save(
    new Media({
      mediaType: MediaType.TV,
      tmdbId: 1050,
      tvdbId: 550,
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

  const created = await requestRepo.save(
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
      ],
      ...overrides,
    })
  );

  const request = await requestRepo.findOneOrFail({
    where: { id: created.id },
    relations: { requestedBy: true, media: true, seasons: true },
  });

  // Flipped in memory so the subscriber is exercised directly rather than
  // through a save that would re-enter it
  request.status = MediaRequestStatus.APPROVED;

  return request;
}

async function sendToSonarr(request: MediaRequest): Promise<void> {
  const subscriber = new MediaRequestSubscriber();
  await subscriber.sendToSonarr(request, getRepository(MediaRequest).manager);
  // addSeries is dispatched detached from the send, so let it settle
  await new Promise((resolve) => setImmediate(resolve));
}

describe('MediaRequestSubscriber', () => {
  beforeEach(() => {
    addSeriesOptions = null;
    getTvShowImpl = async () => fakeTmdbShow(1050, [ANIME_KEYWORD_ID]);
  });

  describe('sonarr anime routing', () => {
    it('uses the anime directory and profile when the request stores no overrides', async () => {
      configureSonarr({
        activeAnimeDirectory: '/anime',
        activeAnimeProfileId: 7,
      });

      await sendToSonarr(await seedApprovedTvRequest());

      assert.equal(addSeriesOptions?.rootFolderPath, '/anime');
      assert.equal(addSeriesOptions?.profileId, 7);
    });

    it('honors a stored override that matches the standard directory', async () => {
      configureSonarr({
        activeAnimeDirectory: '/anime',
        activeAnimeProfileId: 7,
      });

      await sendToSonarr(
        await seedApprovedTvRequest({ rootFolder: '/tv', profileId: 1 })
      );

      assert.equal(addSeriesOptions?.rootFolderPath, '/tv');
      assert.equal(addSeriesOptions?.profileId, 1);
    });
  });
});
