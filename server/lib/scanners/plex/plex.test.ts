import animeList from '@server/api/animelist';
import type {
  PlexLibrary,
  PlexLibraryItem,
  PlexMetadata,
} from '@server/api/plexapi';
import PlexAPI from '@server/api/plexapi';
import type { RadarrMovie } from '@server/api/servarr/radarr';
import RadarrAPI from '@server/api/servarr/radarr';
import type { SonarrSeries } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbTvDetails,
  TmdbTvSeasonResult,
} from '@server/api/themoviedb/interfaces';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

Object.defineProperty(animeList, 'sync', {
  value: async () => {},
  configurable: true,
  writable: true,
});

let getLibrariesImpl: () => Promise<PlexLibrary[]> = async () => [];
let getLibraryContentsImpl: () => Promise<{
  totalSize: number;
  items: PlexLibraryItem[];
}> = async () => ({ totalSize: 0, items: [] });
let getMetadataImpl: (key: string) => Promise<PlexMetadata> = async () => {
  throw new Error('No metadata');
};
let getChildrenMetadataImpl: (
  key: string
) => Promise<PlexMetadata[]> = async () => [];
let getChildrenCallCount = 0;

Object.defineProperty(PlexAPI.prototype, 'getLibraries', {
  get() {
    return async () => getLibrariesImpl();
  },
  set() {},
  configurable: true,
});

Object.defineProperty(PlexAPI.prototype, 'getLibraryContents', {
  get() {
    return async () => getLibraryContentsImpl();
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
    return async (key: string) => {
      getChildrenCallCount++;
      return getChildrenMetadataImpl(key);
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

let getMovieByTmdbIdImpl: (id: number) => Promise<RadarrMovie> = async () => {
  throw new Error('Movie not found');
};
Object.defineProperty(RadarrAPI.prototype, 'getMovieByTmdbId', {
  get() {
    return async (id: number) => getMovieByTmdbIdImpl(id);
  },
  set() {},
  configurable: true,
});

let getSeriesByTvdbIdImpl: (id: number) => Promise<SonarrSeries> = async () => {
  throw new Error('Series not found');
};
Object.defineProperty(SonarrAPI.prototype, 'getSeriesByTvdbId', {
  get() {
    return async (id: number) => getSeriesByTvdbIdImpl(id);
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

function fakePlexMedia(
  videoResolution: string
): PlexLibraryItem['Media'][number] {
  return { videoResolution } as PlexLibraryItem['Media'][number];
}

function fakePlexMovieItem(
  ratingKey: string,
  tmdbId: number,
  videoResolution: string
): PlexLibraryItem {
  return {
    ratingKey,
    title: 'Test Movie',
    guid: `tmdb://${tmdbId}`,
    addedAt: 1700000000,
    updatedAt: 1700000000,
    type: 'movie',
    Media: [fakePlexMedia(videoResolution)],
  };
}

function fakePlexShowItem(ratingKey: string): PlexLibraryItem {
  return {
    ratingKey,
    title: 'Test Show',
    guid: `plex://show/${ratingKey}`,
    addedAt: 1700000000,
    updatedAt: 1700000000,
    type: 'show',
    Media: [],
  };
}

function fakePlexSeasonMeta(index: number, ratingKey: string): PlexMetadata {
  return {
    ratingKey,
    index,
    title: `Season ${index}`,
  } as PlexMetadata;
}

function fakePlexShowMetadata(
  ratingKey: string,
  tmdbId: number,
  tvdbId: number,
  children: PlexMetadata[]
): PlexMetadata {
  return {
    ratingKey,
    guid: `plex://show/${ratingKey}`,
    type: 'show',
    title: 'Test Show',
    Guid: [{ id: `tmdb://${tmdbId}` }, { id: `tvdb://${tvdbId}` }],
    Children: { size: 12, Metadata: children },
    index: 0,
    leafCount: 0,
    viewedLeafCount: 0,
    addedAt: 1700000000,
    updatedAt: 1700000000,
    Media: [],
  };
}

function fakePlexEpisodes(
  count: number,
  videoResolution: string
): PlexMetadata[] {
  return Array.from({ length: count }, (_, i) => ({
    ratingKey: `ep-${i}`,
    index: i + 1,
    Media: [fakePlexMedia(videoResolution)],
  })) as PlexMetadata[];
}

function fakeRadarrMovie(overrides: Partial<RadarrMovie> = {}): RadarrMovie {
  return {
    id: 1,
    tmdbId: 700,
    hasFile: true,
    ...overrides,
  } as RadarrMovie;
}

function fakeSonarrSeries(overrides: Partial<SonarrSeries> = {}): SonarrSeries {
  return {
    id: 1,
    tvdbId: 12345,
    title: 'Test Show',
    statistics: { episodeFileCount: 10 },
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
        },
      },
    ],
    ...overrides,
  } as SonarrSeries;
}

function configurePlex(type: 'movie' | 'show' = 'movie'): void {
  const settings = getSettings();
  settings.plex.libraries = [
    { id: 'plex-lib', name: 'Library', enabled: true, type },
  ];
}

function configureRadarr(overrides: Partial<RadarrSettings>[] = [{}]): void {
  const settings = getSettings();
  settings.radarr = overrides.map((o, i) => ({
    id: i,
    name: `Radarr ${i}`,
    hostname: 'localhost',
    port: 7878,
    apiKey: 'test-key',
    baseUrl: '',
    useSsl: false,
    activeProfileId: 1,
    activeDirectory: '/movies',
    is4k: false,
    minimumAvailability: 'released',
    tags: [],
    isDefault: i === 0,
    syncEnabled: true,
    preventSearch: false,
    externalUrl: '',
    ...o,
  })) as RadarrSettings[];
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
    is4k: false,
    enableSeasonFolders: true,
    tags: [],
    isDefault: i === 0,
    syncEnabled: true,
    preventSearch: false,
    externalUrl: '',
    ...o,
  })) as SonarrSettings[];
}

describe('Plex Scanner', () => {
  beforeEach(() => {
    getLibrariesImpl = async () => [];
    getLibraryContentsImpl = async () => ({ totalSize: 0, items: [] });
    getMetadataImpl = async () => {
      throw new Error('No metadata');
    };
    getChildrenMetadataImpl = async () => [];
    getChildrenCallCount = 0;
    getTvShowImpl = async () => fakeTmdbShow(1);
    getMovieByTmdbIdImpl = async () => {
      throw new Error('Movie not found');
    };
    getSeriesByTvdbIdImpl = async () => {
      throw new Error('Series not found');
    };

    const settings = getSettings();
    settings.radarr = [];
    settings.sonarr = [];
  });

  describe('service availability integration', () => {
    it('uses service-based detection for a movie found in Radarr and skips resolution fallback', async () => {
      configurePlex('movie');
      configureRadarr([{ is4k: false }, { is4k: true }]);

      let callCount = 0;
      getMovieByTmdbIdImpl = async () => {
        callCount++;
        if (callCount === 1) {
          return fakeRadarrMovie({ tmdbId: 7000, hasFile: true });
        }
        throw new Error('Movie not found');
      };

      getLibraryContentsImpl = async () => ({
        totalSize: 1,
        items: [fakePlexMovieItem('mv-7000', 7000, '4k')],
      });

      await plexFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 7000 },
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
      assert.strictEqual(
        updated.status4k,
        MediaStatus.UNKNOWN,
        'Service detection found only a standard file, so the 4K resolution fallback must not run'
      );
    });

    it('falls back to resolution-based detection when a movie is not in any Radarr instance', async () => {
      configurePlex('movie');
      // No Radarr match: getMovieByTmdbIdImpl keeps its throwing default.
      configureRadarr([{ is4k: false }, { is4k: true }]);

      getLibraryContentsImpl = async () => ({
        totalSize: 1,
        items: [fakePlexMovieItem('mv-7001', 7001, '1080')],
      });

      await plexFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 7001 },
      });
      assert.strictEqual(
        updated.status,
        MediaStatus.AVAILABLE,
        'Resolution fallback should mark the standard-resolution file available'
      );
      assert.strictEqual(updated.status4k, MediaStatus.UNKNOWN);
    });

    it('processes both standard and 4K when a movie is found in both Radarr instances', async () => {
      configurePlex('movie');
      configureRadarr([{ is4k: false }, { is4k: true }]);
      getMovieByTmdbIdImpl = async () =>
        fakeRadarrMovie({ tmdbId: 7002, hasFile: true });

      getLibraryContentsImpl = async () => ({
        totalSize: 1,
        items: [fakePlexMovieItem('mv-7002', 7002, '1080')],
      });

      await plexFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 7002 },
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
      assert.strictEqual(updated.status4k, MediaStatus.AVAILABLE);
    });

    it('uses Sonarr season counts for a show found in Sonarr without querying children', async () => {
      configurePlex('show');
      configureSonarr([{ is4k: false }, { is4k: true }]);

      let callCount = 0;
      getSeriesByTvdbIdImpl = async () => {
        callCount++;
        if (callCount === 1) {
          return fakeSonarrSeries({ tvdbId: 55501 });
        }
        throw new Error('Series not found');
      };

      getTvShowImpl = async () => fakeTmdbShow(7100);
      getLibraryContentsImpl = async () => ({
        totalSize: 1,
        items: [fakePlexShowItem('show-7100')],
      });
      getMetadataImpl = async () =>
        fakePlexShowMetadata('show-7100', 7100, 55501, [
          fakePlexSeasonMeta(1, 'season-7100-1'),
        ]);

      await plexFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 7100 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
      assert.strictEqual(
        getChildrenCallCount,
        0,
        'Episode counts should come from Sonarr; getChildrenMetadata must not be called'
      );
    });

    it('uses the Plex Guid tvdb id when TMDB has no tvdb id', async () => {
      configurePlex('show');
      configureSonarr([{ is4k: false }, { is4k: true }]);

      let lookedUpTvdbId: number | undefined;
      let callCount = 0;
      getSeriesByTvdbIdImpl = async (id) => {
        callCount++;
        if (callCount === 1) {
          lookedUpTvdbId = id;
          return fakeSonarrSeries({ tvdbId: 55502 });
        }
        throw new Error('Series not found');
      };

      // TMDB returns no tvdb_id; only the Plex Guid has it
      getTvShowImpl = async () => fakeTmdbShow(7300);
      getLibraryContentsImpl = async () => ({
        totalSize: 1,
        items: [fakePlexShowItem('show-7300')],
      });
      getMetadataImpl = async () =>
        fakePlexShowMetadata('show-7300', 7300, 55502, [
          fakePlexSeasonMeta(1, 'season-7300-1'),
        ]);

      await plexFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 7300 },
        relations: ['seasons'],
      });
      assert.strictEqual(lookedUpTvdbId, 55502);
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
    });

    it('falls back to Plex episode counting when a show is not in any Sonarr instance', async () => {
      configurePlex('show');
      // No Sonarr match: getSeriesByTvdbIdImpl keeps its throwing default.
      configureSonarr([{ is4k: true }]);

      getTvShowImpl = async () => fakeTmdbShow(7101);
      getLibraryContentsImpl = async () => ({
        totalSize: 1,
        items: [fakePlexShowItem('show-7101')],
      });
      getMetadataImpl = async () =>
        fakePlexShowMetadata('show-7101', 7101, 55601, [
          fakePlexSeasonMeta(1, 'season-7101-1'),
        ]);
      getChildrenMetadataImpl = async (key: string) =>
        key === 'season-7101-1' ? fakePlexEpisodes(10, '1080') : [];

      await plexFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 7101 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
      assert.ok(
        getChildrenCallCount > 0,
        'A Sonarr miss should fall back to counting Plex episodes'
      );
    });

    it('does not mark a show available when a season is missing from the library', async () => {
      configurePlex('show');

      const mediaRepository = getRepository(Media);
      const media = new Media();
      media.tmdbId = 7102;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      media.seasons = [];
      await mediaRepository.save(media);

      getTvShowImpl = async () =>
        fakeTmdbShow(7102, [
          {
            id: 1,
            air_date: '2024-01-01',
            episode_count: 10,
            name: 'Season 1',
            overview: '',
            season_number: 1,
          },
          {
            id: 2,
            air_date: '2024-01-01',
            episode_count: 10,
            name: 'Season 2',
            overview: '',
            season_number: 2,
          },
        ]);
      getLibraryContentsImpl = async () => ({
        totalSize: 1,
        items: [fakePlexShowItem('show-7102')],
      });
      getMetadataImpl = async () =>
        fakePlexShowMetadata('show-7102', 7102, 55701, [
          fakePlexSeasonMeta(1, 'season-7102-1'),
        ]);
      getChildrenMetadataImpl = async (key: string) =>
        key === 'season-7102-1' ? fakePlexEpisodes(10, '1080') : [];

      await plexFullScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 7102 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.PARTIALLY_AVAILABLE);
      const s2 = updated.seasons.find((s) => s.seasonNumber === 2);
      assert.notStrictEqual(s2, undefined);
      assert.notStrictEqual(s2?.status, MediaStatus.AVAILABLE);
    });
  });
});
