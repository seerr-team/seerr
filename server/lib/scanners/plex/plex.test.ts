import animeList from '@server/api/animelist';
import type { PlexLibraryItem, PlexMetadata } from '@server/api/plexapi';
import PlexAPI from '@server/api/plexapi';
import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbTvDetails,
  TmdbTvSeasonResult,
} from '@server/api/themoviedb/interfaces';
import { MediaStatus } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Episode from '@server/entity/Episode';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import type { SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

Object.defineProperty(animeList, 'sync', {
  value: async () => {},
  configurable: true,
  writable: true,
});

let getLibrariesImpl: () => Promise<
  { type: 'show' | 'movie'; key: string; title: string; agent: string }[]
> = async () => [];
let getLibraryContentsImpl: (
  id: string
) => Promise<{ totalSize: number; items: PlexLibraryItem[] }> = async () => ({
  totalSize: 0,
  items: [],
});
let getMetadataImpl: (key: string) => Promise<PlexMetadata> = async () => {
  throw new Error('unmocked getMetadata');
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
    return async (key: string) => getMetadataImpl(key);
  },
  set() {},
  configurable: true,
});
Object.defineProperty(PlexAPI.prototype, 'getChildrenMetadata', {
  get() {
    return async (key: string) => getChildrenMetadataImpl(key);
  },
  set() {},
  configurable: true,
});

let getTvShowImpl: (args: {
  tvId: number;
}) => Promise<TmdbTvDetails> = async () => fakeTmdbShow(1);

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  get() {
    return async (args: { tvId: number }) => getTvShowImpl(args);
  },
  set() {},
  configurable: true,
});

import { plexFullScanner } from '@server/lib/scanners/plex';

setupTestDb();

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

function fakePlexMedia(videoResolution: string) {
  return {
    id: 1,
    duration: 0,
    bitrate: 0,
    width: videoResolution === '4k' ? 3840 : 1920,
    height: videoResolution === '4k' ? 2160 : 1080,
    aspectRatio: 1.78,
    audioChannels: 2,
    audioCodec: 'aac',
    videoCodec: 'h264',
    videoResolution,
    container: 'mkv',
    videoFrameRate: '24p',
    videoProfile: 'high',
  };
}

function fakePlexMetadata(
  overrides: Partial<PlexMetadata> & Pick<PlexMetadata, 'ratingKey' | 'index'>
): PlexMetadata {
  return {
    guid: '',
    type: 'season',
    title: 'Item',
    Guid: [],
    leafCount: 0,
    viewedLeafCount: 0,
    addedAt: 1700000000,
    updatedAt: 1700000000,
    Media: [],
    ...overrides,
  };
}

function mockPlexShow(
  tmdbId: number,
  episodeCount: number,
  episodeResolutions?: (string | string[])[]
): void {
  const settings = getSettings();
  settings.main.mediaServerType = MediaServerType.PLEX;
  settings.plex = {
    ...settings.plex,
    ip: '127.0.0.1',
    libraries: [
      { id: 'test-library-id', name: 'TV Shows', enabled: true, type: 'show' },
    ],
  };

  getTvShowImpl = async () =>
    fakeTmdbShow(tmdbId, [
      {
        id: 1,
        air_date: '2024-01-01',
        episode_count: episodeCount,
        name: 'Season 1',
        overview: '',
        season_number: 1,
      },
    ]);

  getLibraryContentsImpl = async (id: string) => {
    if (id !== 'test-library-id') {
      return { totalSize: 0, items: [] };
    }
    return {
      totalSize: 1,
      items: [
        {
          ratingKey: 'show-1',
          title: 'Test Show',
          guid: `themoviedb://${tmdbId}`,
          addedAt: 1700000000,
          updatedAt: 1700000000,
          type: 'show',
          Media: [],
        },
      ],
    };
  };

  getMetadataImpl = async () =>
    fakePlexMetadata({
      ratingKey: 'show-1',
      guid: `themoviedb://${tmdbId}`,
      type: 'show',
      title: 'Test Show',
      index: 1,
      Children: {
        size: 12,
        Metadata: [
          fakePlexMetadata({
            ratingKey: 'season-1',
            type: 'season',
            title: 'Season 1',
            index: 1,
          }),
        ],
      },
    });

  getChildrenMetadataImpl = async (key: string) => {
    if (key !== 'season-1') {
      return [];
    }
    return Array.from({ length: episodeCount }, (_, i) => {
      const resolution =
        episodeResolutions?.[i] ??
        (episodeResolutions === undefined ? '1080' : undefined);
      const resolutions = resolution
        ? Array.isArray(resolution)
          ? resolution
          : [resolution]
        : [];

      return fakePlexMetadata({
        ratingKey: `ep-${i + 1}`,
        title: `Episode ${i + 1}`,
        index: i + 1,
        Media: resolutions.map((value) => fakePlexMedia(value)),
      });
    });
  };
}

function enable4kShowDetection(): void {
  getSettings().sonarr = [{ is4k: true } as SonarrSettings];
}

describe('Plex Scanner', () => {
  beforeEach(async () => {
    getLibrariesImpl = async () => [];
    getLibraryContentsImpl = async () => ({ totalSize: 0, items: [] });
    getMetadataImpl = async () => {
      throw new Error('unmocked getMetadata');
    };
    getChildrenMetadataImpl = async () => [];
    getTvShowImpl = async () => fakeTmdbShow(1);
    getSettings().main.enableEpisodeAvailability = false;
    getSettings().sonarr = [];

    const userRepository = getRepository(User);
    const existingAdmin = await userRepository.findOne({ where: { id: 1 } });
    if (!existingAdmin) {
      const admin = new User();
      admin.id = 1;
      admin.plexToken = 'test-plex-token';
      admin.email = 'admin@test.com';
      admin.permissions = 2;
      admin.username = 'admin';
      await userRepository.save(admin);
    } else if (!existingAdmin.plexToken) {
      existingAdmin.plexToken = 'test-plex-token';
      await userRepository.save(existingAdmin);
    }
  });

  describe('episode availability tracking', () => {
    it('persists AVAILABLE episodes when tracking is enabled with TMDB', async () => {
      getSettings().main.enableEpisodeAvailability = true;
      mockPlexShow(7000, 2);

      await plexFullScanner.run();

      const media = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 7000 },
        relations: ['seasons'],
      });
      const season = media.seasons.find((s) => s.seasonNumber === 1);
      assert.ok(season);

      const episodes = await getRepository(Episode).find({
        where: { season: { id: season.id } },
        order: { episodeNumber: 'ASC' },
      });

      assert.strictEqual(episodes.length, 2);
      assert.strictEqual(episodes[0].status, MediaStatus.AVAILABLE);
      assert.strictEqual(episodes[0].status4k, MediaStatus.UNKNOWN);
      assert.strictEqual(episodes[1].status, MediaStatus.AVAILABLE);
      assert.strictEqual(episodes[1].status4k, MediaStatus.UNKNOWN);
    });

    it('treats 4K files as standard when 4K detection is disabled', async () => {
      getSettings().main.enableEpisodeAvailability = true;
      mockPlexShow(7002, 1, ['4k']);

      await plexFullScanner.run();

      const media = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 7002 },
        relations: ['seasons'],
      });
      const season = media.seasons.find((s) => s.seasonNumber === 1);
      assert.ok(season);

      const episodes = await getRepository(Episode).find({
        where: { season: { id: season.id } },
        order: { episodeNumber: 'ASC' },
      });

      assert.strictEqual(episodes.length, 1);
      assert.strictEqual(episodes[0].status, MediaStatus.AVAILABLE);
      assert.strictEqual(episodes[0].status4k, MediaStatus.UNKNOWN);
    });

    it('splits standard and 4K episode availability when 4K detection is enabled', async () => {
      getSettings().main.enableEpisodeAvailability = true;
      enable4kShowDetection();
      mockPlexShow(7003, 3, ['1080', '4k', ['1080', '4k']]);

      await plexFullScanner.run();

      const media = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 7003 },
        relations: ['seasons'],
      });
      const season = media.seasons.find((s) => s.seasonNumber === 1);
      assert.ok(season);

      const episodes = await getRepository(Episode).find({
        where: { season: { id: season.id } },
        order: { episodeNumber: 'ASC' },
      });

      assert.strictEqual(episodes.length, 3);
      assert.strictEqual(episodes[0].status, MediaStatus.AVAILABLE);
      assert.strictEqual(episodes[0].status4k, MediaStatus.UNKNOWN);
      assert.strictEqual(episodes[1].status, MediaStatus.UNKNOWN);
      assert.strictEqual(episodes[1].status4k, MediaStatus.AVAILABLE);
      assert.strictEqual(episodes[2].status, MediaStatus.AVAILABLE);
      assert.strictEqual(episodes[2].status4k, MediaStatus.AVAILABLE);
    });

    it('does not persist episodes when tracking is disabled', async () => {
      mockPlexShow(7001, 2);

      await plexFullScanner.run();

      const episodeCount = await getRepository(Episode).count();
      assert.strictEqual(episodeCount, 0);
    });

    it('does not persist episodes with empty or missing Media', async () => {
      getSettings().main.enableEpisodeAvailability = true;
      mockPlexShow(7004, 2, []);

      const originalGetChildrenMetadata = getChildrenMetadataImpl;
      getChildrenMetadataImpl = async (key: string) => {
        const episodes = await originalGetChildrenMetadata(key);
        if (key !== 'season-1' || episodes.length < 2) {
          return episodes;
        }

        const missingMedia = { ...episodes[1] };
        delete (missingMedia as { Media?: unknown }).Media;
        return [episodes[0], missingMedia];
      };

      await plexFullScanner.run();

      const media = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 7004 },
        relations: ['seasons'],
      });
      const season = media.seasons.find((s) => s.seasonNumber === 1);
      assert.ok(season);
      assert.strictEqual(media.seasons.length, 1);

      const episodeCount = await getRepository(Episode).count({
        where: { season: { id: season.id } },
      });
      assert.strictEqual(episodeCount, 0);
    });
  });
});
