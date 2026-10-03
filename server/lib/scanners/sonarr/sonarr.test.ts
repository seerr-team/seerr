import type { SonarrSeason, SonarrSeries } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbTvDetails,
  TmdbTvSeasonResult,
} from '@server/api/themoviedb/interfaces';
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
import { sonarrScanner } from '@server/lib/scanners/sonarr';
import type { SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import { runWithMockTimers } from '@server/test/runWithMockTimers';
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

let getSeriesImpl: () => Promise<SonarrSeries[]> = async () => [];
Object.defineProperty(SonarrAPI.prototype, 'getSeries', {
  set() {},
  get() {
    return async () => getSeriesImpl();
  },
  configurable: true,
});

let getLibrarySeriesByTvdbIdImpl: (
  tvdbId: number
) => Promise<SonarrSeries[]> = async () => [];
Object.defineProperty(SonarrAPI.prototype, 'getLibrarySeriesByTvdbId', {
  set() {},
  get() {
    return async (tvdbId: number) => getLibrarySeriesByTvdbIdImpl(tvdbId);
  },
  configurable: true,
});

function fakeTmdbShow(
  tmdbId: number,
  seasons: TmdbTvSeasonResult[] = [
    {
      id: 1,
      air_date: '2024-01-01',
      episode_count: 10,
      name: 'Season 1',
      overview: '',
      season_number: 1,
    },
  ]
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
    seasons,
    status: 'Ended',
    type: 'Scripted',
    vote_average: 0,
    vote_count: 0,
    aggregate_credits: { cast: [] },
    credits: { crew: [] },
    external_ids: {},
    keywords: { results: [] },
    videos: { results: [] },
  };
}

let getShowByTvdbIdImpl: (args: {
  tvdbId: number;
  language?: string;
}) => Promise<TmdbTvDetails> = async () => fakeTmdbShow(1);

TheMovieDb.prototype.getShowByTvdbId = async function (args) {
  return getShowByTvdbIdImpl(args);
};

TheMovieDb.prototype.getShowByTvdbIdForScan = async function (args) {
  return getShowByTvdbIdImpl(args);
};

let getTvShowImpl: (args: {
  tvId: number;
  language?: string;
}) => Promise<TmdbTvDetails> = async () => fakeTmdbShow(1);

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  set() {},
  get() {
    return async (args: { tvId: number; language?: string }) =>
      getTvShowImpl(args);
  },
  configurable: true,
});

Object.defineProperty(TheMovieDb.prototype, 'getTvShowForScan', {
  set() {},
  get() {
    return async (args: { tvId: number; language?: string }) =>
      getTvShowImpl(args);
  },
  configurable: true,
});

// both are assigned in the constructor, so the prototype stubs miss the instance
// sonarrScanner built when it was first imported
for (const method of ['getTvShow', 'getTvShowForScan'] as const) {
  Object.defineProperty(sonarrScanner.tmdb, method, {
    value: async (args: { tvId: number; language?: string }) =>
      getTvShowImpl(args),
    configurable: true,
  });
}

mock.method(MediaRequest, 'sendNotification', async () => undefined);

setupTestDb();

function fakeSonarrSeries(overrides: Partial<SonarrSeries> = {}): SonarrSeries {
  return {
    tvdbId: 100,
    id: 1,
    title: 'Test Show',
    titleSlug: 'test-show',
    monitored: true,
    seasons: [
      {
        seasonNumber: 1,
        monitored: true,
        statistics: {
          episodeFileCount: 10,
          totalEpisodeCount: 10,
          episodeCount: 10,
          percentOfEpisodes: 100,
          sizeOnDisk: 0,
          previousAiring: undefined,
        },
      },
    ],
    ...overrides,
  } as SonarrSeries;
}

function sonarrSeason(
  seasonNumber: number,
  monitored: boolean,
  episodeFileCount: number
): SonarrSeason {
  return {
    seasonNumber,
    monitored,
    statistics: {
      episodeFileCount,
      totalEpisodeCount: 10,
      episodeCount: 10,
      percentOfEpisodes: episodeFileCount * 10,
      sizeOnDisk: 0,
      previousAiring: undefined,
    },
  };
}

function twoSeasonTmdbShow(tmdbId: number): TmdbTvDetails {
  return fakeTmdbShow(
    tmdbId,
    [1, 2].map((seasonNumber) => ({
      id: seasonNumber,
      air_date: '2024-01-01',
      episode_count: 10,
      name: `Season ${seasonNumber}`,
      overview: '',
      season_number: seasonNumber,
    }))
  );
}

async function seedShowRequest(
  tmdbId: number,
  tvdbId: number,
  mediaStatus: MediaStatus,
  seasonStatuses: MediaStatus[],
  requestedSeasons: number[]
): Promise<MediaRequest> {
  const mediaRepository = getRepository(Media);
  const requestRepository = getRepository(MediaRequest);
  const userRepository = getRepository(User);

  const requestedBy = await userRepository.findOneOrFail({
    where: { id: 1 },
  });

  const media = await mediaRepository.save(
    new Media({
      tmdbId,
      tvdbId,
      mediaType: MediaType.TV,
      status: mediaStatus,
      seasons: seasonStatuses.map(
        (status, index) =>
          new Season({
            seasonNumber: index + 1,
            status,
            status4k: MediaStatus.UNKNOWN,
          })
      ),
    })
  );

  const settings = getSettings();
  settings.sonarr = [];
  settings.radarr = [];

  return requestRepository.save(
    new MediaRequest({
      type: MediaType.TV,
      status: MediaRequestStatus.APPROVED,
      media,
      requestedBy,
      is4k: false,
      seasons: requestedSeasons.map(
        (seasonNumber) =>
          new SeasonRequest({
            seasonNumber,
            status: MediaRequestStatus.APPROVED,
          })
      ),
    })
  );
}

async function requestSeasons(
  tmdbId: number,
  seasons: number[]
): Promise<number[]> {
  const user = await getRepository(User).findOneOrFail({ where: { id: 1 } });

  getSettings().sonarr = [];

  const request = await MediaRequest.request(
    { mediaId: tmdbId, mediaType: MediaType.TV, seasons, is4k: false },
    user
  );

  return request.seasons.map((season) => season.seasonNumber);
}

function configureSonarr(overrides: Partial<SonarrSettings>[] = [{}]): void {
  const settings = getSettings();
  settings.sonarr = overrides.map((o, i) => ({
    id: i,
    name: `Sonarr ${i}`,
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
    isDefault: i === 0,
    syncEnabled: true,
    preventSearch: false,
    externalUrl: '',
    ...o,
  })) as SonarrSettings[];
  settings.radarr = [];
}

describe('Sonarr Scanner', () => {
  beforeEach(() => {
    getSeriesImpl = async () => [];
    getLibrarySeriesByTvdbIdImpl = async () => [];
    getShowByTvdbIdImpl = async () => fakeTmdbShow(1);
    getTvShowImpl = async () => fakeTmdbShow(1);
  });

  describe('orphaned show cleanup', () => {
    it('skips cleanup when a standard server has sync disabled', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1050;
      media.tvdbId = 550;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.PROCESSING,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];
      await mediaRepository.save(media);

      configureSonarr([
        { syncEnabled: true, id: 0, hostname: 'server-a' },
        { syncEnabled: false, id: 1, hostname: 'server-b' },
      ]);

      getSeriesImpl = async () => [];

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1050 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.PROCESSING);
      assert.strictEqual(updated.seasons[0].status, MediaStatus.PROCESSING);
    });

    it('resets PROCESSING to UNKNOWN when show is not in any Sonarr server', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1000;
      media.tvdbId = 500;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.PROCESSING,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [fakeSonarrSeries({ tvdbId: 999 })];

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1000 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.UNKNOWN);
      assert.strictEqual(updated.seasons[0].status, MediaStatus.UNKNOWN);
    });

    it('does not reset AVAILABLE show when missing from Sonarr', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1001;
      media.tvdbId = 501;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.AVAILABLE;
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.AVAILABLE,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [];

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1001 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
    });

    it('does not reset PROCESSING show that still exists in Sonarr', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1;
      media.tvdbId = 200;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.PROCESSING,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [
        fakeSonarrSeries({
          tvdbId: 200,
          seasons: [
            {
              seasonNumber: 1,
              monitored: true,
              statistics: {
                episodeFileCount: 0,
                totalEpisodeCount: 10,
                episodeCount: 10,
                percentOfEpisodes: 0,
                sizeOnDisk: 0,
                previousAiring: undefined,
              },
            },
          ],
        }),
      ];

      getShowByTvdbIdImpl = async () => fakeTmdbShow(1);
      getTvShowImpl = async () => fakeTmdbShow(1);

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.PROCESSING);
    });

    it('only resets season statuses that are PROCESSING on orphaned shows', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1003;
      media.tvdbId = 503;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.AVAILABLE,
          status4k: MediaStatus.UNKNOWN,
        }),
        new Season({
          seasonNumber: 2,
          status: MediaStatus.PROCESSING,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [fakeSonarrSeries({ tvdbId: 999 })];

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1003 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.UNKNOWN);

      const s1 = updated.seasons.find((s) => s.seasonNumber === 1);
      const s2 = updated.seasons.find((s) => s.seasonNumber === 2);
      assert.strictEqual(s1?.status, MediaStatus.AVAILABLE);
      assert.strictEqual(s2?.status, MediaStatus.UNKNOWN);
    });

    it('does not reset movie media that is missing from Sonarr', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1004;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [];

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1004 },
      });
      assert.strictEqual(updated.status, MediaStatus.PROCESSING);
    });

    it('only resets orphaned shows not found across all servers', async () => {
      const mediaRepository = getRepository(Media);

      const orphan = new Media();
      orphan.tmdbId = 1010;
      orphan.tvdbId = 510;
      orphan.mediaType = MediaType.TV;
      orphan.status = MediaStatus.PROCESSING;
      orphan.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.PROCESSING,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];
      await mediaRepository.save(orphan);

      const existing = new Media();
      existing.tmdbId = 2;
      existing.tvdbId = 511;
      existing.mediaType = MediaType.TV;
      existing.status = MediaStatus.PROCESSING;
      existing.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.PROCESSING,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];
      await mediaRepository.save(existing);

      configureSonarr([
        { syncEnabled: true, id: 0, hostname: 'server-a' },
        { syncEnabled: true, id: 1, hostname: 'server-b' },
      ]);

      getSeriesImpl = async () => [fakeSonarrSeries({ tvdbId: 511 })];

      getShowByTvdbIdImpl = async () => fakeTmdbShow(2);
      getTvShowImpl = async () => fakeTmdbShow(2);

      await runWithMockTimers(() => sonarrScanner.run());

      const updatedOrphan = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1010 },
        relations: ['seasons'],
      });
      assert.strictEqual(updatedOrphan.status, MediaStatus.UNKNOWN);

      const updatedExisting = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2 },
        relations: ['seasons'],
      });
      assert.notStrictEqual(updatedExisting.status, MediaStatus.UNKNOWN);
    });

    it('does not reset a show added to Sonarr after the scan started', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1020;
      media.tvdbId = 620;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [fakeSonarrSeries({ tvdbId: 111 })];
      getLibrarySeriesByTvdbIdImpl = async (tvdbId) => [
        fakeSonarrSeries({ tvdbId }),
      ];

      await sonarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1020 },
      });
      assert.strictEqual(updated.status, MediaStatus.PROCESSING);
    });

    it('does not reset a show when the server cannot be reached', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1021;
      media.tvdbId = 621;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [fakeSonarrSeries({ tvdbId: 111 })];
      getLibrarySeriesByTvdbIdImpl = async () => {
        throw new Error('connect ECONNREFUSED');
      };

      await sonarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1021 },
      });
      assert.strictEqual(updated.status, MediaStatus.PROCESSING);
    });

    it('resets a show when the server returns no row matching its id', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1022;
      media.tvdbId = 622;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [fakeSonarrSeries({ tvdbId: 111 })];
      getLibrarySeriesByTvdbIdImpl = async () => [
        fakeSonarrSeries({ tvdbId: 111 }),
        fakeSonarrSeries({ tvdbId: 222 }),
      ];

      await sonarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1022 },
      });
      assert.strictEqual(updated.status, MediaStatus.UNKNOWN);
    });

    it('skips shows without a tvdbId during cleanup', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1020;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      media.seasons = [];
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [fakeSonarrSeries({ tvdbId: 999 })];

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1020 },
      });
      assert.strictEqual(updated.status, MediaStatus.PROCESSING);
    });
  });

  describe('4k orphaned show cleanup', () => {
    it('resets 4k PROCESSING to UNKNOWN when show is not in any Sonarr server', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1030;
      media.tvdbId = 530;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.UNKNOWN;
      media.status4k = MediaStatus.PROCESSING;
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.UNKNOWN,
          status4k: MediaStatus.PROCESSING,
        }),
      ];
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true, is4k: true }]);
      getSeriesImpl = async () => [fakeSonarrSeries({ tvdbId: 999 })];

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1030 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status4k, MediaStatus.UNKNOWN);
      assert.strictEqual(updated.seasons[0].status4k, MediaStatus.UNKNOWN);
    });

    it('does not reset 4k AVAILABLE season when show is orphaned', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1031;
      media.tvdbId = 531;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.UNKNOWN;
      media.status4k = MediaStatus.PROCESSING;
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.UNKNOWN,
          status4k: MediaStatus.AVAILABLE,
        }),
        new Season({
          seasonNumber: 2,
          status: MediaStatus.UNKNOWN,
          status4k: MediaStatus.PROCESSING,
        }),
      ];
      await mediaRepository.save(media);

      configureSonarr([{ syncEnabled: true, is4k: true }]);
      getSeriesImpl = async () => [fakeSonarrSeries({ tvdbId: 999 })];

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1031 },
        relations: ['seasons'],
      });
      const s1 = updated.seasons.find((s) => s.seasonNumber === 1);
      const s2 = updated.seasons.find((s) => s.seasonNumber === 2);
      assert.strictEqual(s1?.status4k, MediaStatus.AVAILABLE);
      assert.strictEqual(s2?.status4k, MediaStatus.UNKNOWN);
    });
  });

  describe('orphaned request handling', () => {
    it('declines the approved request and resets the show to UNKNOWN when orphaned', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const userRepository = getRepository(User);

      const requestedBy = await userRepository.findOneOrFail({
        where: { id: 1 },
      });

      const media = await mediaRepository.save(
        new Media({
          tmdbId: 2000,
          tvdbId: 555,
          mediaType: MediaType.TV,
          status: MediaStatus.PROCESSING,
          seasons: [
            new Season({
              seasonNumber: 1,
              status: MediaStatus.PROCESSING,
              status4k: MediaStatus.UNKNOWN,
            }),
          ],
        })
      );

      const settings = getSettings();
      settings.sonarr = [];
      settings.radarr = [];
      const request = await requestRepository.save(
        new MediaRequest({
          type: MediaType.TV,
          status: MediaRequestStatus.APPROVED,
          media,
          requestedBy,
          is4k: false,
        })
      );

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [fakeSonarrSeries({ tvdbId: 999 })];

      await runWithMockTimers(() => sonarrScanner.run());

      const updatedMedia = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2000 },
      });
      const updatedRequest = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(updatedMedia.status, MediaStatus.UNKNOWN);
      assert.strictEqual(updatedRequest.status, MediaRequestStatus.DECLINED);
    });

    it('does not decline the request when the show still exists in Sonarr', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const userRepository = getRepository(User);

      const requestedBy = await userRepository.findOneOrFail({
        where: { id: 1 },
      });

      const media = await mediaRepository.save(
        new Media({
          tmdbId: 2001,
          tvdbId: 600,
          mediaType: MediaType.TV,
          status: MediaStatus.PROCESSING,
          seasons: [
            new Season({
              seasonNumber: 1,
              status: MediaStatus.PROCESSING,
              status4k: MediaStatus.UNKNOWN,
            }),
          ],
        })
      );

      const settings = getSettings();
      settings.sonarr = [];
      settings.radarr = [];
      const request = await requestRepository.save(
        new MediaRequest({
          type: MediaType.TV,
          status: MediaRequestStatus.APPROVED,
          media,
          requestedBy,
          is4k: false,
        })
      );

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [
        fakeSonarrSeries({
          tvdbId: 600,
          seasons: [
            {
              seasonNumber: 1,
              monitored: true,
              statistics: {
                episodeFileCount: 0,
                totalEpisodeCount: 10,
                episodeCount: 10,
                percentOfEpisodes: 0,
                sizeOnDisk: 0,
                previousAiring: undefined,
              },
            },
          ],
        }),
      ];
      getShowByTvdbIdImpl = async () => fakeTmdbShow(2001);
      getTvShowImpl = async () => fakeTmdbShow(2001);

      await runWithMockTimers(() => sonarrScanner.run());

      const updatedRequest = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });
      assert.strictEqual(updatedRequest.status, MediaRequestStatus.APPROVED);
    });

    it('skips cleanup and leaves the request approved when Sonarr returns an empty list', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const userRepository = getRepository(User);

      const requestedBy = await userRepository.findOneOrFail({
        where: { id: 1 },
      });

      const media = await mediaRepository.save(
        new Media({
          tmdbId: 2005,
          tvdbId: 605,
          mediaType: MediaType.TV,
          status: MediaStatus.PROCESSING,
          seasons: [
            new Season({
              seasonNumber: 1,
              status: MediaStatus.PROCESSING,
              status4k: MediaStatus.UNKNOWN,
            }),
          ],
        })
      );

      const settings = getSettings();
      settings.sonarr = [];
      settings.radarr = [];
      const request = await requestRepository.save(
        new MediaRequest({
          type: MediaType.TV,
          status: MediaRequestStatus.APPROVED,
          media,
          requestedBy,
          is4k: false,
        })
      );

      configureSonarr([{ syncEnabled: true }]);
      getSeriesImpl = async () => [];

      await runWithMockTimers(() => sonarrScanner.run());

      const updatedMedia = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2005 },
      });
      const updatedRequest = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(updatedMedia.status, MediaStatus.PROCESSING);
      assert.strictEqual(updatedRequest.status, MediaRequestStatus.APPROVED);
    });

    it('declineOrphanedRequests throws when the requests relation is not loaded', async () => {
      const media = new Media();
      media.id = 1;
      media.tmdbId = 123;
      media.mediaType = MediaType.TV;

      await assert.rejects(
        () =>
          (
            sonarrScanner as unknown as {
              declineOrphanedRequests: (
                m: Media,
                is4k: boolean
              ) => Promise<void>;
            }
          ).declineOrphanedRequests(media, false),
        /without the 'requests' relation loaded/
      );
    });

    it('declines only the 4k request when the 4k dimension is orphaned but standard still exists', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const userRepository = getRepository(User);

      const requestedBy = await userRepository.findOneOrFail({
        where: { id: 1 },
      });

      const media = await mediaRepository.save(
        new Media({
          tmdbId: 2002,
          tvdbId: 666,
          mediaType: MediaType.TV,
          status: MediaStatus.PROCESSING,
          status4k: MediaStatus.PROCESSING,
          seasons: [
            new Season({
              seasonNumber: 1,
              status: MediaStatus.PROCESSING,
              status4k: MediaStatus.PROCESSING,
            }),
          ],
        })
      );

      const settings = getSettings();
      settings.sonarr = [];
      settings.radarr = [];
      const standardRequest = await requestRepository.save(
        new MediaRequest({
          type: MediaType.TV,
          status: MediaRequestStatus.APPROVED,
          media,
          requestedBy,
          is4k: false,
        })
      );
      const fourKRequest = await requestRepository.save(
        new MediaRequest({
          type: MediaType.TV,
          status: MediaRequestStatus.APPROVED,
          media,
          requestedBy,
          is4k: true,
        })
      );

      configureSonarr([
        { syncEnabled: true, id: 0, hostname: 'server-standard' },
        { syncEnabled: true, id: 1, hostname: 'server-4k', is4k: true },
      ]);

      let callCount = 0;
      getSeriesImpl = async () => {
        callCount++;
        if (callCount === 1) {
          // standard server still has the show (processing, no files)
          return [
            fakeSonarrSeries({
              tvdbId: 666,
              seasons: [
                {
                  seasonNumber: 1,
                  monitored: true,
                  statistics: {
                    episodeFileCount: 0,
                    totalEpisodeCount: 10,
                    episodeCount: 10,
                    percentOfEpisodes: 0,
                    sizeOnDisk: 0,
                    previousAiring: undefined,
                  },
                },
              ],
            }),
          ];
        }
        // 4k server: populated but the show is absent, so 4k dimension orphaned
        return [fakeSonarrSeries({ tvdbId: 997 })];
      };

      getShowByTvdbIdImpl = async ({ tvdbId }) =>
        tvdbId === 666 ? fakeTmdbShow(2002) : fakeTmdbShow(997);
      getTvShowImpl = async ({ tvId }) => fakeTmdbShow(tvId);

      await runWithMockTimers(() => sonarrScanner.run());

      const updatedMedia = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2002 },
      });
      const updatedStandard = await requestRepository.findOneOrFail({
        where: { id: standardRequest.id },
      });
      const updated4k = await requestRepository.findOneOrFail({
        where: { id: fourKRequest.id },
      });

      assert.strictEqual(updatedMedia.status, MediaStatus.PROCESSING);
      assert.strictEqual(updatedMedia.status4k, MediaStatus.UNKNOWN);
      assert.strictEqual(updatedStandard.status, MediaRequestStatus.APPROVED);
      assert.strictEqual(updated4k.status, MediaRequestStatus.DECLINED);
    });
  });

  describe('multi-server reset handling', () => {
    async function seedProcessingRequest(
      tmdbId: number,
      tvdbId: number,
      serverId: number
    ) {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const userRepository = getRepository(User);

      const requestedBy = await userRepository.findOneOrFail({
        where: { id: 1 },
      });

      const media = await mediaRepository.save(
        new Media({
          tmdbId,
          tvdbId,
          mediaType: MediaType.TV,
          status: MediaStatus.PROCESSING,
          serviceId: serverId,
          externalServiceId: 200,
          seasons: [
            new Season({
              seasonNumber: 1,
              status: MediaStatus.PROCESSING,
              status4k: MediaStatus.UNKNOWN,
            }),
          ],
        })
      );

      const settings = getSettings();
      settings.sonarr = [];
      settings.radarr = [];

      return requestRepository.save(
        new MediaRequest({
          type: MediaType.TV,
          status: MediaRequestStatus.APPROVED,
          media,
          requestedBy,
          is4k: false,
          serverId,
        })
      );
    }

    // getSeries takes no server argument and is called once per server.
    function queueServerResponses(responses: SonarrSeries[][]): void {
      let call = 0;
      getSeriesImpl = async () => responses[call++] ?? [];
    }

    // Distinct hostnames, or run()'s uniqWith collapses the two into one server.
    function configureTwoServers(): void {
      configureSonarr([
        { id: 0, hostname: 'server-a' },
        { id: 1, hostname: 'server-b' },
      ]);
    }

    function seriesWithEmptySeason(
      id: number,
      titleSlug: string,
      monitored: boolean
    ): SonarrSeries {
      return fakeSonarrSeries({
        tvdbId: 700,
        id,
        titleSlug,
        seasons: [
          {
            seasonNumber: 1,
            monitored,
            statistics: {
              episodeFileCount: 0,
              totalEpisodeCount: 10,
              episodeCount: 10,
              percentOfEpisodes: 0,
              sizeOnDisk: 0,
              previousAiring: undefined,
            },
          },
        ],
      });
    }

    const abandonedOnA = seriesWithEmptySeason(100, 'abandoned-on-a', false);
    const downloadingOnB = seriesWithEmptySeason(200, 'downloading-on-b', true);

    it('keeps the show processing, its request approved and its Sonarr link on the downloading server, scanning A then B', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const request = await seedProcessingRequest(2100, 700, 1);

      configureTwoServers();
      getTvShowImpl = async () => fakeTmdbShow(2100);
      queueServerResponses([[abandonedOnA], [downloadingOnB]]);
      getLibrarySeriesByTvdbIdImpl = async () => [downloadingOnB];

      await runWithMockTimers(() => sonarrScanner.run());

      const media = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2100 },
        relations: ['seasons'],
      });
      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(media.status, MediaStatus.PROCESSING);
      assert.strictEqual(media.seasons[0].status, MediaStatus.PROCESSING);
      assert.strictEqual(updated.status, MediaRequestStatus.APPROVED);
      assert.strictEqual(media.serviceId, 1);
      assert.strictEqual(media.externalServiceId, downloadingOnB.id);
      assert.strictEqual(media.externalServiceSlug, downloadingOnB.titleSlug);
    });

    it('keeps the show processing, its request approved and its Sonarr link on the downloading server, scanning B then A', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const request = await seedProcessingRequest(2100, 700, 1);

      configureTwoServers();
      getTvShowImpl = async () => fakeTmdbShow(2100);
      queueServerResponses([[downloadingOnB], [abandonedOnA]]);
      getLibrarySeriesByTvdbIdImpl = async () => [downloadingOnB];

      await runWithMockTimers(() => sonarrScanner.run());

      const media = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2100 },
        relations: ['seasons'],
      });
      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(media.status, MediaStatus.PROCESSING);
      assert.strictEqual(media.seasons[0].status, MediaStatus.PROCESSING);
      assert.strictEqual(updated.status, MediaRequestStatus.APPROVED);
      assert.strictEqual(media.serviceId, 0);
      assert.strictEqual(media.externalServiceId, downloadingOnB.id);
      assert.strictEqual(media.externalServiceSlug, downloadingOnB.titleSlug);
    });

    const withoutSeasonTwo = fakeSonarrSeries({
      tvdbId: 710,
      id: 100,
      seasons: [sonarrSeason(1, true, 10)],
    });
    const downloadingSeasonTwo = fakeSonarrSeries({
      tvdbId: 710,
      id: 200,
      seasons: [sonarrSeason(1, true, 10), sonarrSeason(2, true, 0)],
    });

    async function scanSeasonTwoAcrossServers(
      responses: SonarrSeries[][]
    ): Promise<{ media: Media; request: MediaRequest }> {
      const request = await seedShowRequest(
        2110,
        710,
        MediaStatus.PARTIALLY_AVAILABLE,
        [MediaStatus.AVAILABLE, MediaStatus.PROCESSING],
        [2]
      );

      configureTwoServers();
      getTvShowImpl = async () => twoSeasonTmdbShow(2110);
      queueServerResponses(responses);

      await runWithMockTimers(() => sonarrScanner.run());

      return {
        media: await getRepository(Media).findOneOrFail({
          where: { tmdbId: 2110 },
          relations: ['seasons'],
        }),
        request: await getRepository(MediaRequest).findOneOrFail({
          where: { id: request.id },
        }),
      };
    }

    it('keeps a season processing while another server downloads it, scanning the server without it first', async () => {
      const { media, request } = await scanSeasonTwoAcrossServers([
        [withoutSeasonTwo],
        [downloadingSeasonTwo],
      ]);

      assert.strictEqual(
        media.seasons.find((s) => s.seasonNumber === 2)?.status,
        MediaStatus.PROCESSING
      );
      assert.strictEqual(media.status, MediaStatus.PARTIALLY_AVAILABLE);
      assert.strictEqual(request.status, MediaRequestStatus.APPROVED);
    });

    it('keeps a season processing while another server downloads it, scanning the downloading server first', async () => {
      const { media, request } = await scanSeasonTwoAcrossServers([
        [downloadingSeasonTwo],
        [withoutSeasonTwo],
      ]);

      assert.strictEqual(
        media.seasons.find((s) => s.seasonNumber === 2)?.status,
        MediaStatus.PROCESSING
      );
      assert.strictEqual(media.status, MediaStatus.PARTIALLY_AVAILABLE);
      assert.strictEqual(request.status, MediaRequestStatus.APPROVED);
    });

    it('leaves the request alone when the server downloading a season fails to scan it', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const seasonRequestRepository = getRepository(SeasonRequest);
      const request = await seedShowRequest(
        2120,
        760,
        MediaStatus.PARTIALLY_AVAILABLE,
        [MediaStatus.AVAILABLE, MediaStatus.PROCESSING],
        [1, 2]
      );

      const delivered = await seasonRequestRepository.findOneOrFail({
        where: { request: { id: request.id }, seasonNumber: 1 },
      });
      delivered.status = MediaRequestStatus.COMPLETED;
      await seasonRequestRepository.save(delivered);

      configureTwoServers();
      queueServerResponses([
        [
          fakeSonarrSeries({
            tvdbId: 760,
            id: 200,
            seasons: [sonarrSeason(1, true, 10), sonarrSeason(2, true, 0)],
          }),
        ],
        [
          fakeSonarrSeries({
            tvdbId: 760,
            id: 100,
            seasons: [sonarrSeason(1, true, 10), sonarrSeason(2, false, 0)],
          }),
        ],
      ]);

      // The first lookup is the downloading server's, as it is scanned first.
      let lookups = 0;
      getTvShowImpl = async () => {
        if (lookups++ === 0) {
          throw new Error('TMDB unavailable');
        }

        return twoSeasonTmdbShow(2120);
      };

      await runWithMockTimers(() => sonarrScanner.run());

      const media = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2120 },
        relations: ['seasons'],
      });
      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(updated.status, MediaRequestStatus.APPROVED);
      assert.deepStrictEqual(
        updated.seasons.map((s) => s.seasonNumber),
        [1, 2]
      );
      assert.strictEqual(
        media.seasons.find((s) => s.seasonNumber === 2)?.status,
        MediaStatus.PROCESSING
      );
    });
  });

  describe('abandoned season handling', () => {
    it('frees an abandoned season for a new request while the rest of the request downloads', async () => {
      const requestRepository = getRepository(MediaRequest);
      const request = await seedShowRequest(
        2200,
        720,
        MediaStatus.PROCESSING,
        [MediaStatus.PROCESSING, MediaStatus.PROCESSING],
        [1, 2]
      );

      configureSonarr();
      getTvShowImpl = async () => twoSeasonTmdbShow(2200);
      getSeriesImpl = async () => [
        fakeSonarrSeries({
          tvdbId: 720,
          seasons: [sonarrSeason(1, true, 0), sonarrSeason(2, false, 0)],
        }),
      ];

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(updated.status, MediaRequestStatus.APPROVED);
      assert.deepStrictEqual(await requestSeasons(2200, [1, 2]), [2]);
    });

    it('frees a season Sonarr no longer carries while the rest of the request downloads', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const request = await seedShowRequest(
        2210,
        730,
        MediaStatus.PROCESSING,
        [MediaStatus.PROCESSING, MediaStatus.PROCESSING],
        [1, 2]
      );

      configureSonarr();
      getTvShowImpl = async () => twoSeasonTmdbShow(2210);
      getSeriesImpl = async () => [
        fakeSonarrSeries({ tvdbId: 730, seasons: [sonarrSeason(1, true, 0)] }),
      ];

      await runWithMockTimers(() => sonarrScanner.run());

      const media = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2210 },
        relations: ['seasons'],
      });
      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(
        media.seasons.find((s) => s.seasonNumber === 2)?.status,
        MediaStatus.UNKNOWN
      );
      assert.strictEqual(updated.status, MediaRequestStatus.APPROVED);
      assert.deepStrictEqual(await requestSeasons(2210, [1, 2]), [2]);
    });

    it('declines a request whose every season was abandoned while another season stays available', async () => {
      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const request = await seedShowRequest(
        2220,
        740,
        MediaStatus.PARTIALLY_AVAILABLE,
        [MediaStatus.AVAILABLE, MediaStatus.PROCESSING],
        [2]
      );

      configureSonarr();
      getTvShowImpl = async () => twoSeasonTmdbShow(2220);
      getSeriesImpl = async () => [
        fakeSonarrSeries({
          tvdbId: 740,
          seasons: [sonarrSeason(1, true, 10), sonarrSeason(2, false, 0)],
        }),
      ];

      await runWithMockTimers(() => sonarrScanner.run());

      const media = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2220 },
        relations: ['seasons'],
      });
      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(updated.status, MediaRequestStatus.DECLINED);
      assert.strictEqual(
        media.seasons.find((s) => s.seasonNumber === 2)?.status,
        MediaStatus.UNKNOWN
      );
      assert.strictEqual(media.status, MediaStatus.PARTIALLY_AVAILABLE);
    });

    it('completes a request once its only unfinished season is abandoned', async () => {
      const requestRepository = getRepository(MediaRequest);
      const seasonRequestRepository = getRepository(SeasonRequest);
      const request = await seedShowRequest(
        2230,
        750,
        MediaStatus.PARTIALLY_AVAILABLE,
        [MediaStatus.AVAILABLE, MediaStatus.PROCESSING],
        [1, 2]
      );

      const delivered = await seasonRequestRepository.findOneOrFail({
        where: { request: { id: request.id }, seasonNumber: 1 },
      });
      delivered.status = MediaRequestStatus.COMPLETED;
      await seasonRequestRepository.save(delivered);

      configureSonarr();
      getTvShowImpl = async () => twoSeasonTmdbShow(2230);
      getSeriesImpl = async () => [
        fakeSonarrSeries({
          tvdbId: 750,
          seasons: [sonarrSeason(1, true, 10), sonarrSeason(2, false, 0)],
        }),
      ];

      await runWithMockTimers(() => sonarrScanner.run());

      const updated = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(updated.status, MediaRequestStatus.COMPLETED);
    });
  });
});
