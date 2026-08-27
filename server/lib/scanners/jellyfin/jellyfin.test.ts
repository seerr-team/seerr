import animeList from '@server/api/animelist';
import type {
  JellyfinLibraryItem,
  JellyfinLibraryItemExtended,
  JellyfinMediaStream,
} from '@server/api/jellyfin';
import JellyfinAPI from '@server/api/jellyfin';
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
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import type {
  Library,
  RadarrSettings,
  SonarrSettings,
} from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

// --- Mock animeList.sync to avoid filesystem/network I/O in tests ---
Object.defineProperty(animeList, 'sync', {
  value: async () => {},
  configurable: true,
  writable: true,
});

// --- Mock JellyfinAPI ---
let getLibraryContentsImpl: (
  id: string
) => Promise<JellyfinLibraryItem[]> = async () => [];
let getItemDataImpl: (
  id: string
) => Promise<JellyfinLibraryItemExtended | undefined> = async () => undefined;
let getSeasonsImpl: (
  seriesID: string
) => Promise<JellyfinLibraryItem[]> = async () => [];
let getEpisodesImpl: (
  seriesID: string,
  seasonID: string
) => Promise<JellyfinLibraryItem[]> = async () => [];
let getEpisodesCallCount = 0;

Object.defineProperty(JellyfinAPI.prototype, 'getLibraryContents', {
  get() {
    return async (id: string) => getLibraryContentsImpl(id);
  },
  set() {},
  configurable: true,
});

Object.defineProperty(JellyfinAPI.prototype, 'getItemData', {
  get() {
    return async (id: string) => getItemDataImpl(id);
  },
  set() {},
  configurable: true,
});

Object.defineProperty(JellyfinAPI.prototype, 'getSeasons', {
  get() {
    return async (seriesID: string) => getSeasonsImpl(seriesID);
  },
  set() {},
  configurable: true,
});

Object.defineProperty(JellyfinAPI.prototype, 'getEpisodes', {
  get() {
    return async (seriesID: string, seasonID: string) => {
      getEpisodesCallCount++;
      return getEpisodesImpl(seriesID, seasonID);
    };
  },
  set() {},
  configurable: true,
});

Object.defineProperty(JellyfinAPI.prototype, 'setUserId', {
  get() {
    return () => {};
  },
  set() {},
  configurable: true,
});

// --- Mock TheMovieDb ---
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

import { jellyfinFullScanner } from '@server/lib/scanners/jellyfin';

setupTestDb();

// --- Helpers ---

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

function fakeJellyfinSeriesItem(id: string): JellyfinLibraryItem {
  return {
    Name: 'Test Show',
    Id: id,
    Type: 'Series',
    HasSubtitles: false,
    LocationType: 'FileSystem',
    MediaType: 'Video',
  };
}

function fakeJellyfinShowMetadata(
  id: string,
  tmdbId: string,
  tvdbId?: string
): JellyfinLibraryItemExtended {
  return {
    Name: 'Test Show',
    Id: id,
    Type: 'Series',
    HasSubtitles: false,
    LocationType: 'FileSystem',
    MediaType: 'Video',
    ProviderIds: { Tmdb: tmdbId, ...(tvdbId ? { Tvdb: tvdbId } : {}) },
  };
}

function fakeJellyfinSeason(
  seasonNumber: number,
  id: string
): JellyfinLibraryItem {
  return {
    Name: `Season ${seasonNumber}`,
    Id: id,
    IndexNumber: seasonNumber,
    Type: 'Season',
    HasSubtitles: false,
    LocationType: 'FileSystem',
    MediaType: 'Video',
  };
}

function fakeJellyfinEpisodes(count: number): JellyfinLibraryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    Name: `Episode ${i + 1}`,
    Id: `ep-${i}`,
    IndexNumber: i + 1,
    Type: 'Episode' as const,
    HasSubtitles: false,
    LocationType: 'FileSystem' as const,
    MediaType: 'Video',
  }));
}

function configureJellyfinWithLibrary(
  libraries: Library[] = [
    { id: 'test-library-id', name: 'TV Shows', enabled: true, type: 'show' },
  ]
): void {
  const settings = getSettings();
  settings.main.mediaServerType = MediaServerType.JELLYFIN;
  settings.jellyfin = {
    ...settings.jellyfin,
    apiKey: 'test-api-key',
    libraries,
  };
}

function fakeVideoStream(width: number): JellyfinMediaStream {
  return {
    Codec: 'h264',
    Type: 'Video',
    Width: width,
    DisplayTitle: `${width}px`,
  };
}

function fakeJellyfinMovieItem(id: string): JellyfinLibraryItem {
  return {
    Name: 'Test Movie',
    Id: id,
    Type: 'Movie',
    HasSubtitles: false,
    LocationType: 'FileSystem',
    MediaType: 'Video',
  };
}

function fakeJellyfinMovieMetadata(
  id: string,
  tmdbId: string,
  width: number
): JellyfinLibraryItemExtended {
  return {
    Name: 'Test Movie',
    Id: id,
    Type: 'Movie',
    HasSubtitles: false,
    LocationType: 'FileSystem',
    MediaType: 'Video',
    ProviderIds: { Tmdb: tmdbId },
    MediaSources: [
      {
        Protocol: 'File',
        Id: `${id}-source`,
        Path: '/movies/test.mkv',
        Type: 'Default',
        VideoType: 'VideoFile',
        MediaStreams: [fakeVideoStream(width)],
      },
    ],
  };
}

function fakeJellyfinEpisodesWithResolution(
  count: number,
  width: number
): JellyfinLibraryItem[] {
  return Array.from({ length: count }, (_, i) => {
    const episode: JellyfinLibraryItemExtended = {
      Name: `Episode ${i + 1}`,
      Id: `ep-${i}`,
      IndexNumber: i + 1,
      Type: 'Episode',
      HasSubtitles: false,
      LocationType: 'FileSystem',
      MediaType: 'Video',
      ProviderIds: {},
      MediaSources: [
        {
          Protocol: 'File',
          Id: `ep-${i}-source`,
          Path: '/tv/test.mkv',
          Type: 'Default',
          VideoType: 'VideoFile',
          MediaStreams: [fakeVideoStream(width)],
        },
      ],
    };
    return episode;
  });
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

describe('Jellyfin Scanner', () => {
  beforeEach(async () => {
    getLibraryContentsImpl = async () => [];
    getItemDataImpl = async () => undefined;
    getSeasonsImpl = async () => [];
    getEpisodesImpl = async () => [];
    getEpisodesCallCount = 0;
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

    const userRepository = getRepository(User);
    const existingAdmin = await userRepository.findOne({ where: { id: 1 } });
    if (!existingAdmin) {
      const admin = new User();
      admin.id = 1;
      admin.jellyfinUserId = 'admin-user-id';
      admin.jellyfinDeviceId = 'admin-device-id';
      admin.email = 'admin@test.com';
      admin.permissions = 2;
      admin.username = 'admin';
      await userRepository.save(admin);
    }
  });

  describe('empty TMDB season handling', () => {
    it('should mark show as available when all non-empty TMDB seasons are fully scanned and an empty placeholder season exists in the DB', async () => {
      configureJellyfinWithLibrary();

      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 5000;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PARTIALLY_AVAILABLE;
      media.jellyfinMediaId = 'jf-scanner-show-id';
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.AVAILABLE,
          status4k: MediaStatus.UNKNOWN,
        }),
        new Season({
          seasonNumber: 2,
          status: MediaStatus.AVAILABLE,
          status4k: MediaStatus.UNKNOWN,
        }),
        new Season({
          seasonNumber: 3,
          status: MediaStatus.UNKNOWN,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];

      await mediaRepository.save(media);

      getTvShowImpl = async () =>
        fakeTmdbShow(5000, [
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
          {
            id: 3,
            air_date: '2024-01-01',
            episode_count: 0,
            name: 'Season 3',
            overview: '',
            season_number: 3,
          },
        ]);

      // Jellyfin: S1 and S2 are fully scanned; S3 has no files.
      getLibraryContentsImpl = async (id: string) => {
        if (id === 'test-library-id') {
          return [fakeJellyfinSeriesItem('jf-scanner-show-id')];
        }
        return [];
      };

      getItemDataImpl = async (id: string) => {
        if (id === 'jf-scanner-show-id') {
          return fakeJellyfinShowMetadata('jf-scanner-show-id', '5000');
        }
        return undefined;
      };

      getSeasonsImpl = async (seriesID: string) => {
        if (seriesID === 'jf-scanner-show-id') {
          return [
            fakeJellyfinSeason(1, 'jf-scanner-s1-id'),
            fakeJellyfinSeason(2, 'jf-scanner-s2-id'),
          ];
        }
        return [];
      };

      getEpisodesImpl = async (_seriesID: string, seasonID: string) => {
        if (seasonID === 'jf-scanner-s1-id') return fakeJellyfinEpisodes(10);
        if (seasonID === 'jf-scanner-s2-id') return fakeJellyfinEpisodes(10);
        return [];
      };

      await jellyfinFullScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 5000 },
        relations: ['seasons'],
      });

      assert.strictEqual(
        updated.status,
        MediaStatus.AVAILABLE,
        'Show should be AVAILABLE when all non-empty TMDB seasons are fully scanned, ignoring empty placeholder seasons'
      );
    });

    it('should mark show as available when an orphan UNKNOWN season exists in the DB but not in TMDB', async () => {
      configureJellyfinWithLibrary();

      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 5001;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PARTIALLY_AVAILABLE;
      media.jellyfinMediaId = 'jf-orphan-show-id';
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.AVAILABLE,
          status4k: MediaStatus.UNKNOWN,
        }),
        // Not present in the TMDB season list below
        new Season({
          seasonNumber: 2,
          status: MediaStatus.UNKNOWN,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];

      await mediaRepository.save(media);

      getTvShowImpl = async () =>
        fakeTmdbShow(5001, [
          {
            id: 1,
            air_date: '2024-01-01',
            episode_count: 10,
            name: 'Season 1',
            overview: '',
            season_number: 1,
          },
        ]);

      getLibraryContentsImpl = async (id: string) => {
        if (id === 'test-library-id') {
          return [fakeJellyfinSeriesItem('jf-orphan-show-id')];
        }
        return [];
      };

      getItemDataImpl = async (id: string) => {
        if (id === 'jf-orphan-show-id') {
          return fakeJellyfinShowMetadata('jf-orphan-show-id', '5001');
        }
        return undefined;
      };

      getSeasonsImpl = async (seriesID: string) => {
        if (seriesID === 'jf-orphan-show-id') {
          return [fakeJellyfinSeason(1, 'jf-orphan-s1-id')];
        }
        return [];
      };

      getEpisodesImpl = async (_seriesID: string, seasonID: string) => {
        if (seasonID === 'jf-orphan-s1-id') return fakeJellyfinEpisodes(10);
        return [];
      };

      await jellyfinFullScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 5001 },
        relations: ['seasons'],
      });

      assert.strictEqual(
        updated.status,
        MediaStatus.AVAILABLE,
        'Show should be AVAILABLE when the only DB season missing from TMDB is an UNKNOWN orphan placeholder'
      );
    });

    it('should keep show partially available when a season missing from TMDB was previously available', async () => {
      configureJellyfinWithLibrary();

      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 5002;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PARTIALLY_AVAILABLE;
      media.jellyfinMediaId = 'jf-deleted-show-id';
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.AVAILABLE,
          status4k: MediaStatus.UNKNOWN,
        }),
        new Season({
          seasonNumber: 2,
          status: MediaStatus.DELETED,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];

      await mediaRepository.save(media);

      getTvShowImpl = async () =>
        fakeTmdbShow(5002, [
          {
            id: 1,
            air_date: '2024-01-01',
            episode_count: 10,
            name: 'Season 1',
            overview: '',
            season_number: 1,
          },
        ]);

      getLibraryContentsImpl = async (id: string) => {
        if (id === 'test-library-id') {
          return [fakeJellyfinSeriesItem('jf-deleted-show-id')];
        }
        return [];
      };

      getItemDataImpl = async (id: string) => {
        if (id === 'jf-deleted-show-id') {
          return fakeJellyfinShowMetadata('jf-deleted-show-id', '5002');
        }
        return undefined;
      };

      getSeasonsImpl = async (seriesID: string) => {
        if (seriesID === 'jf-deleted-show-id') {
          return [fakeJellyfinSeason(1, 'jf-deleted-s1-id')];
        }
        return [];
      };

      getEpisodesImpl = async (_seriesID: string, seasonID: string) => {
        if (seasonID === 'jf-deleted-s1-id') return fakeJellyfinEpisodes(10);
        return [];
      };

      await jellyfinFullScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 5002 },
        relations: ['seasons'],
      });

      assert.strictEqual(
        updated.status,
        MediaStatus.PARTIALLY_AVAILABLE,
        'Show should stay PARTIALLY_AVAILABLE when a DELETED season is missing from the metadata provider'
      );
    });
  });

  describe('service availability integration', () => {
    it('uses service-based detection for a movie found in Radarr and skips resolution fallback', async () => {
      configureJellyfinWithLibrary([
        { id: 'test-library-id', name: 'Movies', enabled: true, type: 'movie' },
      ]);
      configureRadarr([{ is4k: false }, { is4k: true }]);

      let callCount = 0;
      getMovieByTmdbIdImpl = async () => {
        callCount++;
        if (callCount === 1) {
          return fakeRadarrMovie({ tmdbId: 6000, hasFile: true });
        }
        throw new Error('Movie not found');
      };

      getLibraryContentsImpl = async (id: string) =>
        id === 'test-library-id'
          ? [fakeJellyfinMovieItem('jf-movie-6000')]
          : [];
      getItemDataImpl = async (id: string) =>
        id === 'jf-movie-6000'
          ? fakeJellyfinMovieMetadata('jf-movie-6000', '6000', 3840)
          : undefined;

      await jellyfinFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 6000 },
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
      assert.strictEqual(
        updated.status4k,
        MediaStatus.UNKNOWN,
        'Service detection found only a standard file, so the 4K resolution fallback must not run'
      );
    });

    it('falls back to resolution-based detection when a movie is not in any Radarr instance', async () => {
      configureJellyfinWithLibrary([
        { id: 'test-library-id', name: 'Movies', enabled: true, type: 'movie' },
      ]);
      // No Radarr match: getMovieByTmdbIdImpl keeps its throwing default.
      configureRadarr([{ is4k: false }, { is4k: true }]);

      getLibraryContentsImpl = async (id: string) =>
        id === 'test-library-id'
          ? [fakeJellyfinMovieItem('jf-movie-6001')]
          : [];
      getItemDataImpl = async (id: string) =>
        id === 'jf-movie-6001'
          ? fakeJellyfinMovieMetadata('jf-movie-6001', '6001', 1920)
          : undefined;

      await jellyfinFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 6001 },
      });
      assert.strictEqual(
        updated.status,
        MediaStatus.AVAILABLE,
        'Resolution fallback should mark the standard-resolution file available'
      );
      assert.strictEqual(updated.status4k, MediaStatus.UNKNOWN);
    });

    it('processes both standard and 4K when a movie is found in both Radarr instances', async () => {
      configureJellyfinWithLibrary([
        { id: 'test-library-id', name: 'Movies', enabled: true, type: 'movie' },
      ]);
      configureRadarr([{ is4k: false }, { is4k: true }]);
      getMovieByTmdbIdImpl = async () =>
        fakeRadarrMovie({ tmdbId: 6002, hasFile: true });

      getLibraryContentsImpl = async (id: string) =>
        id === 'test-library-id'
          ? [fakeJellyfinMovieItem('jf-movie-6002')]
          : [];
      getItemDataImpl = async (id: string) =>
        id === 'jf-movie-6002'
          ? fakeJellyfinMovieMetadata('jf-movie-6002', '6002', 1920)
          : undefined;

      await jellyfinFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 6002 },
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
      assert.strictEqual(updated.status4k, MediaStatus.AVAILABLE);
    });

    it('uses Sonarr season counts for a show found in Sonarr without querying episodes', async () => {
      configureJellyfinWithLibrary();
      configureSonarr([{ is4k: false }, { is4k: true }]);

      let callCount = 0;
      getSeriesByTvdbIdImpl = async () => {
        callCount++;
        if (callCount === 1) {
          return fakeSonarrSeries({ tvdbId: 12345 });
        }
        throw new Error('Series not found');
      };

      getTvShowImpl = async () => ({
        ...fakeTmdbShow(6100),
        external_ids: { tvdb_id: 12345 },
      });

      getLibraryContentsImpl = async (id: string) =>
        id === 'test-library-id'
          ? [fakeJellyfinSeriesItem('jf-show-6100')]
          : [];
      getItemDataImpl = async (id: string) =>
        id === 'jf-show-6100'
          ? fakeJellyfinShowMetadata('jf-show-6100', '6100')
          : undefined;
      getSeasonsImpl = async (seriesID: string) =>
        seriesID === 'jf-show-6100'
          ? [fakeJellyfinSeason(1, 'jf-show-6100-s1')]
          : [];

      await jellyfinFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 6100 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
      assert.strictEqual(
        getEpisodesCallCount,
        0,
        'Episode counts should come from Sonarr; getEpisodes must not be called'
      );
    });

    it('uses the Jellyfin Tvdb provider id when TMDB has no tvdb id', async () => {
      configureJellyfinWithLibrary();
      configureSonarr([{ is4k: false }, { is4k: true }]);

      let lookedUpTvdbId: number | undefined;
      let callCount = 0;
      getSeriesByTvdbIdImpl = async (id) => {
        callCount++;
        if (callCount === 1) {
          lookedUpTvdbId = id;
          return fakeSonarrSeries({ tvdbId: 54321 });
        }
        throw new Error('Series not found');
      };

      // TMDB returns no tvdb_id; only Jellyfin's ProviderIds.Tvdb has it
      getTvShowImpl = async () => fakeTmdbShow(6300);

      getLibraryContentsImpl = async (id: string) =>
        id === 'test-library-id'
          ? [fakeJellyfinSeriesItem('jf-show-6300')]
          : [];
      getItemDataImpl = async (id: string) =>
        id === 'jf-show-6300'
          ? fakeJellyfinShowMetadata('jf-show-6300', '6300', '54321')
          : undefined;
      getSeasonsImpl = async (seriesID: string) =>
        seriesID === 'jf-show-6300'
          ? [fakeJellyfinSeason(1, 'jf-show-6300-s1')]
          : [];

      await jellyfinFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 6300 },
        relations: ['seasons'],
      });
      assert.strictEqual(lookedUpTvdbId, 54321);
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
    });

    it('falls back to Jellyfin episode counting when a show is not in any Sonarr instance', async () => {
      configureJellyfinWithLibrary();
      // No Sonarr match: getSeriesByTvdbIdImpl keeps its throwing default.
      configureSonarr([{ is4k: true }]);

      getTvShowImpl = async () => ({
        ...fakeTmdbShow(6101),
        external_ids: { tvdb_id: 23456 },
      });

      getLibraryContentsImpl = async (id: string) =>
        id === 'test-library-id'
          ? [fakeJellyfinSeriesItem('jf-show-6101')]
          : [];
      getItemDataImpl = async (id: string) =>
        id === 'jf-show-6101'
          ? fakeJellyfinShowMetadata('jf-show-6101', '6101')
          : undefined;
      getSeasonsImpl = async (seriesID: string) =>
        seriesID === 'jf-show-6101'
          ? [fakeJellyfinSeason(1, 'jf-show-6101-s1')]
          : [];
      getEpisodesImpl = async (_seriesID: string, seasonID: string) =>
        seasonID === 'jf-show-6101-s1'
          ? fakeJellyfinEpisodesWithResolution(10, 1920)
          : [];

      await jellyfinFullScanner.run();

      const updated = await getRepository(Media).findOneOrFail({
        where: { tmdbId: 6101 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
      assert.ok(
        getEpisodesCallCount > 0,
        'A Sonarr miss should fall back to counting Jellyfin episodes'
      );
    });

    it('does not mark a show available when a season is missing from the library', async () => {
      configureJellyfinWithLibrary();

      const mediaRepository = getRepository(Media);
      const media = new Media();
      media.tmdbId = 6102;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      media.jellyfinMediaId = 'jf-show-6102';
      media.seasons = [];
      await mediaRepository.save(media);

      getTvShowImpl = async () =>
        fakeTmdbShow(6102, [
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

      getLibraryContentsImpl = async (id: string) =>
        id === 'test-library-id'
          ? [fakeJellyfinSeriesItem('jf-show-6102')]
          : [];
      getItemDataImpl = async (id: string) =>
        id === 'jf-show-6102'
          ? fakeJellyfinShowMetadata('jf-show-6102', '6102')
          : undefined;
      getSeasonsImpl = async (seriesID: string) =>
        seriesID === 'jf-show-6102'
          ? [fakeJellyfinSeason(1, 'jf-show-6102-s1')]
          : [];
      getEpisodesImpl = async (_seriesID: string, seasonID: string) =>
        seasonID === 'jf-show-6102-s1' ? fakeJellyfinEpisodes(10) : [];

      await jellyfinFullScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 6102 },
        relations: ['seasons'],
      });
      assert.strictEqual(updated.status, MediaStatus.PARTIALLY_AVAILABLE);
      const s2 = updated.seasons.find((s) => s.seasonNumber === 2);
      assert.notStrictEqual(s2, undefined);
      assert.notStrictEqual(s2?.status, MediaStatus.AVAILABLE);
    });
  });
});
