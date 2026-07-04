import type { SonarrSeries } from '@server/api/servarr/sonarr';
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
import { User } from '@server/entity/User';
import { sonarrScanner } from '@server/lib/scanners/sonarr';
import type { SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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

      await sonarrScanner.run();

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
});
