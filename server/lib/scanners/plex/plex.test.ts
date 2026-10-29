import animeList from '@server/api/animelist';
import type {
  PlexLibrary,
  PlexLibraryItem,
  PlexMetadata,
} from '@server/api/plexapi';
import PlexAPI from '@server/api/plexapi';
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
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaRequest from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import SeasonRequest from '@server/entity/SeasonRequest';
import { User } from '@server/entity/User';
import availabilitySync from '@server/lib/availabilitySync';
import { plexFullScanner } from '@server/lib/scanners/plex';
import type { Library, SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import { runWithMockTimers } from '@server/test/runWithMockTimers';
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

Object.defineProperty(animeList, 'sync', {
  value: async () => {},
  configurable: true,
  writable: true,
});

function plexNotFoundError(): Error & { response: { status: number } } {
  return Object.assign(new Error('Request failed with status code 404'), {
    response: { status: 404 },
  });
}

function rethrowPlexTestError(error: unknown): never {
  if (error instanceof Error && error.message === '404') {
    throw plexNotFoundError();
  }
  throw error;
}

let getLibrariesImpl: () => Promise<PlexLibrary[]> = async () => [];
let getLibraryContentsImpl: (
  id: string
) => Promise<{ totalSize: number; items: PlexLibraryItem[] }> = async () => ({
  totalSize: 0,
  items: [],
});
let getMetadataImpl: (
  key: string,
  options?: { includeChildren?: boolean }
) => Promise<PlexMetadata> = async () => {
  throw plexNotFoundError();
};
let getChildrenMetadataImpl: (
  key: string
) => Promise<PlexMetadata[]> = async () => [];

Object.defineProperty(PlexAPI.prototype, 'getLibraries', {
  get() {
    return async () => getLibrariesImpl();
  },
  set() {},
  configurable: true,
});

Object.defineProperty(PlexAPI.prototype, 'getLibraryContents', {
  get() {
    return async (id: string) => getLibraryContentsImpl(id);
  },
  set() {},
  configurable: true,
});

Object.defineProperty(PlexAPI.prototype, 'getMetadata', {
  get() {
    return async (key: string, options?: { includeChildren?: boolean }) => {
      try {
        return await getMetadataImpl(key, options);
      } catch (error) {
        rethrowPlexTestError(error);
      }
    };
  },
  set() {},
  configurable: true,
});

Object.defineProperty(PlexAPI.prototype, 'getChildrenMetadata', {
  get() {
    return async (key: string) => {
      try {
        return await getChildrenMetadataImpl(key);
      } catch (error) {
        rethrowPlexTestError(error);
      }
    };
  },
  set() {},
  configurable: true,
});

let getTvShowImpl: (args: {
  tvId: number;
  language?: string;
}) => Promise<TmdbTvDetails> = async () => fakeTmdbShow(1);

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  get() {
    return async (args: { tvId: number; language?: string }) =>
      getTvShowImpl(args);
  },
  set() {},
  configurable: true,
});

Object.defineProperty(TheMovieDb.prototype, 'getTvShowForScan', {
  get() {
    return async (args: { tvId: number; language?: string }) =>
      getTvShowImpl(args);
  },
  set() {},
  configurable: true,
});

for (const method of ['getTvShow', 'getTvShowForScan'] as const) {
  // plexFullScanner / availabilitySync built their own TheMovieDb on import,
  // before the stubs above.
  Object.defineProperty(plexFullScanner.tmdb, method, {
    value: async (args: { tvId: number; language?: string }) =>
      getTvShowImpl(args),
    configurable: true,
  });
  Object.defineProperty(availabilitySync.tmdb, method, {
    value: async (args: { tvId: number; language?: string }) =>
      getTvShowImpl(args),
    configurable: true,
  });
}

mock.method(MediaRequest, 'sendNotification', async () => undefined);

setupTestDb();

function tmdbSeasons(count: number): TmdbTvSeasonResult[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    air_date: '2024-01-01',
    episode_count: 10,
    name: `Season ${i + 1}`,
    overview: '',
    season_number: i + 1,
  }));
}

function fakeTmdbShow(
  tmdbId: number,
  seasons: TmdbTvSeasonResult[] = tmdbSeasons(1)
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
    number_of_episodes: seasons.reduce(
      (sum, season) => sum + season.episode_count,
      0
    ),
    number_of_seasons: seasons.length,
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

function fakePlexSeason(seasonNumber: number, ratingKey: string): PlexMetadata {
  return {
    ratingKey,
    guid: `plex://season/${ratingKey}`,
    type: 'season',
    title: `Season ${seasonNumber}`,
    Guid: [],
    index: seasonNumber,
    leafCount: 0,
    viewedLeafCount: 0,
    addedAt: 1,
    updatedAt: 1,
    Media: [],
  };
}

function fakePlexEpisodes(
  prefix: string,
  count: number,
  width: number
): PlexMetadata[] {
  const videoResolution = width >= 2000 ? '4k' : '1080';
  return Array.from({ length: count }, (_, i) => ({
    ratingKey: `${prefix}-ep-${i}`,
    guid: `plex://episode/${prefix}-ep-${i}`,
    type: 'movie' as const,
    title: `Episode ${i + 1}`,
    Guid: [],
    index: i + 1,
    leafCount: 0,
    viewedLeafCount: 0,
    addedAt: 1,
    updatedAt: 1,
    Media: [
      {
        id: i,
        duration: 2400,
        bitrate: width >= 2000 ? 20000 : 4000,
        width,
        height: width >= 2000 ? 2160 : 1080,
        aspectRatio: 1.78,
        audioChannels: 2,
        audioCodec: 'aac',
        videoCodec: 'h264',
        videoResolution,
        container: 'mkv',
        videoFrameRate: '24p',
        videoProfile: 'high',
      },
    ],
  }));
}

function fakePlexLibraryShow(
  ratingKey: string,
  tmdbId: number,
  title = 'Split Show'
): PlexLibraryItem {
  return {
    ratingKey,
    title,
    guid: `tmdb://${tmdbId}`,
    type: 'show',
    addedAt: 1,
    updatedAt: 1,
    Media: [],
  };
}

function fakePlexShowMetadata(
  ratingKey: string,
  tmdbId: number,
  seasons: PlexMetadata[]
): PlexMetadata {
  return {
    ratingKey,
    guid: `tmdb://${tmdbId}`,
    type: 'show',
    title: 'Test Show',
    Guid: [{ id: `tmdb://${tmdbId}` }],
    Children: {
      size: 12,
      Metadata: seasons,
    },
    index: 1,
    leafCount: 0,
    viewedLeafCount: 0,
    addedAt: 1,
    updatedAt: 1,
    Media: [],
  };
}

function configurePlexLibraries(libraries: Library[]): void {
  const settings = getSettings();
  settings.main.mediaServerType = MediaServerType.PLEX;
  settings.sonarr = [];
  settings.radarr = [];
  settings.plex = {
    ...settings.plex,
    ip: '127.0.0.1',
    port: 32400,
    libraries,
  };
}

/** Enables BaseScanner.startRun() 4K show detection via settings.sonarr. */
function enableSonarr4k(): void {
  getSettings().sonarr = [
    {
      id: 0,
      name: 'Sonarr 4K',
      hostname: 'localhost',
      port: 8989,
      apiKey: 'test-key',
      baseUrl: '',
      useSsl: false,
      activeProfileId: 1,
      activeProfileName: 'Default',
      activeDirectory: '/tv',
      activeLanguageProfileId: 1,
      seriesType: 'standard',
      animeSeriesType: 'standard',
      animeTags: [],
      is4k: true,
      enableSeasonFolders: true,
      monitorNewItems: 'all',
      tags: [],
      isDefault: true,
      syncEnabled: true,
      preventSearch: false,
      tagRequests: false,
      overrideRule: [],
      externalUrl: '',
    } satisfies SonarrSettings,
  ];
}

async function assertSeasonsAvailable(tmdbId: number, count: number) {
  const updated = await getRepository(Media).findOneOrFail({
    where: { tmdbId, mediaType: MediaType.TV },
    relations: ['seasons'],
  });

  assert.strictEqual(updated.seasons.length, count);
  for (const season of updated.seasons) {
    assert.strictEqual(
      season.status,
      MediaStatus.AVAILABLE,
      `Season ${season.seasonNumber} should remain AVAILABLE`
    );
  }
  assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
  return updated;
}

describe('Plex Scanner', () => {
  beforeEach(() => {
    getLibrariesImpl = async () => [];
    getLibraryContentsImpl = async () => ({ totalSize: 0, items: [] });
    getMetadataImpl = async () => {
      throw new Error('404');
    };
    getChildrenMetadataImpl = async () => [];
    getTvShowImpl = async () => fakeTmdbShow(1);
  });

  describe('in-flight request handling', () => {
    it('leaves an approved request alone when the show has no episodes yet', async () => {
      configurePlexLibraries([
        {
          id: 'test-library-id',
          name: 'TV Shows',
          enabled: true,
          type: 'show',
        },
      ]);

      const mediaRepository = getRepository(Media);
      const requestRepository = getRepository(MediaRequest);
      const userRepository = getRepository(User);

      const requestedBy = await userRepository.findOneOrFail({
        where: { id: 1 },
      });

      const media = await mediaRepository.save(
        new Media({
          tmdbId: 6100,
          mediaType: MediaType.TV,
          status: MediaStatus.PROCESSING,
          status4k: MediaStatus.UNKNOWN,
          ratingKey: 'plex-inflight-show-key',
          seasons: [
            new Season({
              seasonNumber: 1,
              status: MediaStatus.PROCESSING,
              status4k: MediaStatus.UNKNOWN,
            }),
          ],
        })
      );

      // sendToSonarr runs on insert and only bails when no server is configured,
      // so leftover settings from another test would reach TMDB and fail the request.
      const settings = getSettings();
      settings.radarr = [];
      settings.sonarr = [];

      const request = await requestRepository.save(
        new MediaRequest({
          type: MediaType.TV,
          status: MediaRequestStatus.APPROVED,
          media,
          requestedBy,
          is4k: false,
          seasons: [
            new SeasonRequest({
              seasonNumber: 1,
              status: MediaRequestStatus.APPROVED,
            }),
          ],
        })
      );

      getTvShowImpl = async () => fakeTmdbShow(6100);
      getLibrariesImpl = async () => [
        {
          key: 'test-library-id',
          title: 'TV Shows',
          type: 'show',
          agent: 'tv.plex.agents.series',
        },
      ];

      getLibraryContentsImpl = async (id: string) =>
        id === 'test-library-id'
          ? {
              totalSize: 1,
              items: [
                fakePlexLibraryShow(
                  'plex-inflight-show-key',
                  6100,
                  'Test Show'
                ),
              ],
            }
          : { totalSize: 0, items: [] };

      getMetadataImpl = async (key: string) => {
        if (key === 'plex-inflight-show-key') {
          return fakePlexShowMetadata('plex-inflight-show-key', 6100, [
            fakePlexSeason(1, 'plex-inflight-s1-key'),
          ]);
        }
        throw new Error('404');
      };

      getChildrenMetadataImpl = async () => [];

      await runWithMockTimers(() => plexFullScanner.run());

      const updatedRequest = await requestRepository.findOneOrFail({
        where: { id: request.id },
      });

      assert.strictEqual(
        updatedRequest.status,
        MediaRequestStatus.APPROVED,
        'A media server scan must not cancel a request Sonarr is still working on'
      );
    });
  });

  describe('split-library availability', () => {
    const split1080p: Library = {
      id: 'lib-1080',
      name: 'TV 1080p',
      enabled: true,
      type: 'show',
    };
    const split4k: Library = {
      id: 'lib-4k',
      name: 'TV 4K',
      enabled: true,
      type: 'show',
    };
    const libA: Library = {
      id: 'lib-a',
      name: 'TV A',
      enabled: true,
      type: 'show',
    };
    const libB: Library = {
      id: 'lib-b',
      name: 'TV B',
      enabled: true,
      type: 'show',
    };

    function mockSplitShow(tmdbId: number) {
      const rk1080 = `split-${tmdbId}-1080`;
      const rk4k = `split-${tmdbId}-4k`;

      getTvShowImpl = async () => fakeTmdbShow(tmdbId, tmdbSeasons(4));
      getLibrariesImpl = async () => [
        {
          type: 'show',
          key: split1080p.id,
          title: split1080p.name,
          agent: 'tv.plex.agents.series',
        },
        {
          type: 'show',
          key: split4k.id,
          title: split4k.name,
          agent: 'tv.plex.agents.series',
        },
      ];
      getLibraryContentsImpl = async (id: string) => {
        if (id === split1080p.id) {
          return {
            totalSize: 1,
            items: [fakePlexLibraryShow(rk1080, tmdbId)],
          };
        }
        if (id === split4k.id) {
          return {
            totalSize: 1,
            items: [fakePlexLibraryShow(rk4k, tmdbId)],
          };
        }
        return { totalSize: 0, items: [] };
      };
      getMetadataImpl = async (key: string) => {
        if (key === rk1080) {
          return fakePlexShowMetadata(rk1080, tmdbId, [
            fakePlexSeason(1, `${rk1080}-s1`),
          ]);
        }
        if (key === rk4k) {
          return fakePlexShowMetadata(rk4k, tmdbId, [
            fakePlexSeason(2, `${rk4k}-s2`),
            fakePlexSeason(3, `${rk4k}-s3`),
            fakePlexSeason(4, `${rk4k}-s4`),
          ]);
        }
        throw new Error('404');
      };
      getChildrenMetadataImpl = async (key: string) => {
        if (key === rk1080) {
          return [fakePlexSeason(1, `${rk1080}-s1`)];
        }
        if (key === rk4k) {
          return [
            fakePlexSeason(2, `${rk4k}-s2`),
            fakePlexSeason(3, `${rk4k}-s3`),
            fakePlexSeason(4, `${rk4k}-s4`),
          ];
        }
        if (key === `${rk1080}-s1`) {
          return fakePlexEpisodes(key, 10, 1920);
        }
        if (key === `${rk4k}-s2`) {
          // One 1080p episode in the 4K library copy, which used to steal ratingKey.
          return [
            ...fakePlexEpisodes(`${key}-4k`, 9, 3840),
            ...fakePlexEpisodes(`${key}-1080`, 1, 1920),
          ];
        }
        if (key === `${rk4k}-s3` || key === `${rk4k}-s4`) {
          return fakePlexEpisodes(key, 10, 3840);
        }
        return [];
      };

      return { rk1080, rk4k };
    }

    function mockTwoStandardLibraries(tmdbId: number) {
      const rkA = `std-${tmdbId}-a`;
      const rkB = `std-${tmdbId}-b`;

      getTvShowImpl = async () => fakeTmdbShow(tmdbId, tmdbSeasons(4));
      getLibrariesImpl = async () => [
        {
          type: 'show',
          key: libA.id,
          title: libA.name,
          agent: 'tv.plex.agents.series',
        },
        {
          type: 'show',
          key: libB.id,
          title: libB.name,
          agent: 'tv.plex.agents.series',
        },
      ];
      getLibraryContentsImpl = async (id: string) => {
        if (id === libA.id) {
          return { totalSize: 1, items: [fakePlexLibraryShow(rkA, tmdbId)] };
        }
        if (id === libB.id) {
          return { totalSize: 1, items: [fakePlexLibraryShow(rkB, tmdbId)] };
        }
        return { totalSize: 0, items: [] };
      };
      getMetadataImpl = async (key: string) => {
        if (key === rkA) {
          return fakePlexShowMetadata(rkA, tmdbId, [
            fakePlexSeason(1, `${rkA}-s1`),
          ]);
        }
        if (key === rkB) {
          return fakePlexShowMetadata(rkB, tmdbId, [
            fakePlexSeason(2, `${rkB}-s2`),
            fakePlexSeason(3, `${rkB}-s3`),
            fakePlexSeason(4, `${rkB}-s4`),
          ]);
        }
        throw new Error('404');
      };
      getChildrenMetadataImpl = async (key: string) => {
        if (key === rkA) {
          return [fakePlexSeason(1, `${rkA}-s1`)];
        }
        if (key === rkB) {
          return [
            fakePlexSeason(2, `${rkB}-s2`),
            fakePlexSeason(3, `${rkB}-s3`),
            fakePlexSeason(4, `${rkB}-s4`),
          ];
        }
        if (
          key === `${rkA}-s1` ||
          key === `${rkB}-s2` ||
          key === `${rkB}-s3` ||
          key === `${rkB}-s4`
        ) {
          return fakePlexEpisodes(key, 10, 1920);
        }
        return [];
      };

      return { rkA, rkB };
    }

    for (const order of [
      [split1080p, split4k],
      [split4k, split1080p],
    ] as const) {
      it(`keeps every season after scanning ${order.map((library) => library.name).join(' then ')} then running availability sync`, async () => {
        const tmdbId = order[0].id === split1080p.id ? 9010 : 9011;
        const { rk1080, rk4k } = mockSplitShow(tmdbId);
        configurePlexLibraries([...order]);

        await runWithMockTimers(() => plexFullScanner.run());

        const scanned = await getRepository(Media).findOneOrFail({
          where: { tmdbId, mediaType: MediaType.TV },
        });
        assert.deepStrictEqual(
          scanned.plexRatingKeys?.slice().sort(),
          [rk1080, rk4k].sort()
        );

        await availabilitySync.run();
        await assertSeasonsAvailable(tmdbId, 4);
      });
    }

    for (const order of [
      [libA, libB],
      [libB, libA],
    ] as const) {
      it(`keeps every season after scanning two non-4K libraries ${order.map((library) => library.name).join(' then ')} then running availability sync`, async () => {
        const tmdbId = order[0].id === libA.id ? 9020 : 9021;
        const { rkA, rkB } = mockTwoStandardLibraries(tmdbId);
        configurePlexLibraries([...order]);

        await runWithMockTimers(() => plexFullScanner.run());

        const scanned = await getRepository(Media).findOneOrFail({
          where: { tmdbId, mediaType: MediaType.TV },
        });
        assert.deepStrictEqual(
          scanned.plexRatingKeys?.slice().sort(),
          [rkA, rkB].sort()
        );

        await availabilitySync.run();
        await assertSeasonsAvailable(tmdbId, 4);
      });
    }

    it('records ratingKey4k and 4K season/show availability when Sonarr enables 4K detection', async () => {
      const tmdbId = 9030;
      const { rk1080, rk4k } = mockSplitShow(tmdbId);

      // Pure 4K season 2 so the 4K library copy does not also claim ratingKey.
      const baseChildren = getChildrenMetadataImpl;
      getChildrenMetadataImpl = async (key: string) => {
        if (key === `${rk4k}-s2`) {
          return fakePlexEpisodes(key, 10, 3840);
        }
        return baseChildren(key);
      };

      configurePlexLibraries([split1080p, split4k]);
      enableSonarr4k();

      await runWithMockTimers(() => plexFullScanner.run());

      const scanned = await getRepository(Media).findOneOrFail({
        where: { tmdbId, mediaType: MediaType.TV },
        relations: ['seasons'],
      });

      assert.deepStrictEqual(
        scanned.plexRatingKeys?.slice().sort(),
        [rk1080, rk4k].sort()
      );
      assert.strictEqual(scanned.ratingKey, rk1080);
      assert.strictEqual(scanned.ratingKey4k, rk4k);

      const seasons = Object.fromEntries(
        scanned.seasons.map((season) => [season.seasonNumber, season])
      );

      assert.strictEqual(seasons[1].status, MediaStatus.AVAILABLE);
      assert.strictEqual(seasons[1].status4k, MediaStatus.UNKNOWN);
      for (const seasonNumber of [2, 3, 4]) {
        assert.strictEqual(
          seasons[seasonNumber].status,
          MediaStatus.UNKNOWN,
          `Season ${seasonNumber} should have no standard availability`
        );
        assert.strictEqual(
          seasons[seasonNumber].status4k,
          MediaStatus.AVAILABLE,
          `Season ${seasonNumber} should be 4K AVAILABLE`
        );
      }

      assert.strictEqual(scanned.status, MediaStatus.PARTIALLY_AVAILABLE);
      assert.strictEqual(scanned.status4k, MediaStatus.PARTIALLY_AVAILABLE);
    });
  });
});
