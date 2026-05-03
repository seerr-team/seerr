import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type {
  JellyfinLibraryItem,
  JellyfinLibraryItemExtended,
} from '@server/api/jellyfin';
import JellyfinAPI from '@server/api/jellyfin';
import type { PlexMetadata } from '@server/api/plexapi';
import PlexAPI from '@server/api/plexapi';
import type { SonarrSeason, SonarrSeries } from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaStatus, MediaType } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import type { SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';

// --- Mock JellyfinAPI ---
let getSystemInfoImpl: () => Promise<Record<string, unknown>> = async () => ({
  ServerName: 'Test',
});
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

Object.defineProperty(JellyfinAPI.prototype, 'getSystemInfo', {
  get() {
    return async () => getSystemInfoImpl();
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
    return async (seriesID: string, seasonID: string) =>
      getEpisodesImpl(seriesID, seasonID);
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

// --- Mock PlexAPI ---
let getMetadataImpl: (
  key: string,
  options?: { includeChildren?: boolean }
) => Promise<PlexMetadata> = async () => {
  throw new Error('404');
};
let getChildrenMetadataImpl: (
  key: string
) => Promise<PlexMetadata[]> = async () => [];

Object.defineProperty(PlexAPI.prototype, 'getMetadata', {
  get() {
    return async (key: string, options?: { includeChildren?: boolean }) =>
      getMetadataImpl(key, options);
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

// --- Mock SonarrAPI ---
let getSeriesByIdImpl: (id: number) => Promise<SonarrSeries> = async () => {
  throw new Error('404');
};

Object.defineProperty(SonarrAPI.prototype, 'getSeriesById', {
  get() {
    return async (id: number) => getSeriesByIdImpl(id);
  },
  set() {},
  configurable: true,
});

import availabilitySync from '@server/lib/availabilitySync';

setupTestDb();

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

function configureJellyfin(): void {
  const settings = getSettings();
  settings.main.mediaServerType = MediaServerType.JELLYFIN;
  settings.jellyfin = {
    ...settings.jellyfin,
    apiKey: 'test-api-key',
  };
}

function configurePlex(): void {
  const settings = getSettings();
  settings.main.mediaServerType = MediaServerType.PLEX;
}

// --- Jellyfin helpers ---
function fakeJellyfinSeason(
  seasonNumber: number,
  id?: string
): JellyfinLibraryItem {
  return {
    Name: `Season ${seasonNumber}`,
    Id: id ?? `jellyfin-season-${seasonNumber}-id`,
    IndexNumber: seasonNumber,
    Type: 'Season' as const,
    HasSubtitles: false,
    LocationType: 'FileSystem' as const,
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

function fakeJellyfinShow(
  id: string,
  tmdbId: string
): JellyfinLibraryItemExtended {
  return {
    Name: 'Test Show',
    Id: id,
    Type: 'Series',
    HasSubtitles: false,
    LocationType: 'FileSystem',
    MediaType: 'Video',
    ProviderIds: { Tmdb: tmdbId },
  };
}

// --- Plex helpers ---
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
    addedAt: 0,
    updatedAt: 0,
    Media: [],
  };
}

function fakePlexEpisodes(count: number): PlexMetadata[] {
  return Array.from({ length: count }, (_, i) => ({
    ratingKey: `ep-${i}`,
    guid: `plex://episode/ep-${i}`,
    type: 'movie' as const,
    title: `Episode ${i + 1}`,
    Guid: [],
    index: i + 1,
    leafCount: 0,
    viewedLeafCount: 0,
    addedAt: 0,
    updatedAt: 0,
    Media: [
      {
        id: i,
        duration: 2400,
        bitrate: 4000,
        width: 1920,
        height: 1080,
        aspectRatio: 1.78,
        audioChannels: 2,
        audioCodec: 'aac',
        videoCodec: 'h264',
        videoResolution: '1080',
        container: 'mkv',
        videoFrameRate: '24p',
        videoProfile: 'high',
      },
    ],
  }));
}

function fakePlexShow(ratingKey: string): PlexMetadata {
  return {
    ratingKey,
    guid: `plex://show/${ratingKey}`,
    type: 'show',
    title: 'Test Show',
    Guid: [],
    index: 1,
    leafCount: 0,
    viewedLeafCount: 0,
    addedAt: 0,
    updatedAt: 0,
    Media: [],
  };
}

// --- Sonarr helpers ---
function fakeSonarrSeasons(
  totalSeasons: number,
  seasonsWithFiles: Record<number, number>
): SonarrSeason[] {
  return Array.from({ length: totalSeasons }, (_, i) => ({
    seasonNumber: i + 1,
    monitored: true,
    statistics: {
      episodeFileCount: seasonsWithFiles[i + 1] ?? 0,
      totalEpisodeCount: 22,
      episodeCount: 22,
      percentOfEpisodes: seasonsWithFiles[i + 1] ? 100 : 0,
      sizeOnDisk: seasonsWithFiles[i + 1] ? 7516192768 : 0,
      previousAiring: undefined,
    },
  }));
}

describe('AvailabilitySync', () => {
  beforeEach(async () => {
    getSystemInfoImpl = async () => ({ ServerName: 'Test' });
    getItemDataImpl = async () => undefined;
    getSeasonsImpl = async () => [];
    getEpisodesImpl = async () => [];
    getMetadataImpl = async () => {
      throw new Error('404');
    };
    getChildrenMetadataImpl = async () => [];
    getSeriesByIdImpl = async () => {
      throw new Error('404');
    };

    const userRepository = getRepository(User);
    const existingAdmin = await userRepository.findOne({ where: { id: 1 } });
    if (!existingAdmin) {
      const admin = new User();
      admin.id = 1;
      admin.plexToken = 'test-plex-token';
      admin.jellyfinUserId = 'admin-user-id';
      admin.jellyfinDeviceId = 'admin-device-id';
      admin.email = 'admin@test.com';
      admin.permissions = 2;
      admin.username = 'admin';
      await userRepository.save(admin);
    }
  });

  describe('TV season availability - Jellyfin', () => {
    it('should mark deleted seasons as DELETED when only some seasons exist in Jellyfin and Sonarr', async () => {
      configureJellyfin();
      configureSonarr([{ syncEnabled: true }]);

      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1408;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.AVAILABLE;
      media.jellyfinMediaId = 'jellyfin-house-id';
      media.externalServiceId = 100;
      media.seasons = [];

      for (let i = 1; i <= 8; i++) {
        media.seasons.push(
          new Season({
            seasonNumber: i,
            status: MediaStatus.AVAILABLE,
            status4k: MediaStatus.UNKNOWN,
          })
        );
      }

      await mediaRepository.save(media);

      getItemDataImpl = async (id: string) => {
        if (id === 'jellyfin-house-id') {
          return fakeJellyfinShow('jellyfin-house-id', '1408');
        }
        return undefined;
      };

      getSeasonsImpl = async (seriesID: string) => {
        if (seriesID === 'jellyfin-house-id') {
          return [fakeJellyfinSeason(6)];
        }
        return [];
      };

      getEpisodesImpl = async (_seriesID: string, seasonID: string) => {
        if (seasonID === 'jellyfin-season-6-id') {
          return fakeJellyfinEpisodes(21);
        }
        return [];
      };

      getSeriesByIdImpl = async (id: number) => {
        if (id === 100) {
          return {
            tvdbId: 73255,
            id: 100,
            title: 'House',
            titleSlug: 'house',
            monitored: true,
            statistics: {
              episodeFileCount: 21,
              totalEpisodeCount: 177,
              episodeCount: 177,
              percentOfEpisodes: 11.86,
              sizeOnDisk: 0,
              seasonCount: 8,
            },
            seasons: fakeSonarrSeasons(8, { 6: 21 }),
          } as unknown as SonarrSeries;
        }
        throw new Error('404');
      };

      await availabilitySync.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1408 },
        relations: ['seasons'],
      });

      const s6 = updated.seasons.find((s) => s.seasonNumber === 6);
      assert.strictEqual(
        s6?.status,
        MediaStatus.AVAILABLE,
        'Season 6 should remain AVAILABLE'
      );

      for (const season of updated.seasons) {
        if (season.seasonNumber !== 6) {
          assert.strictEqual(
            season.status,
            MediaStatus.DELETED,
            `Season ${season.seasonNumber} should be DELETED but was ${season.status}`
          );
        }
      }

      assert.strictEqual(
        updated.status,
        MediaStatus.PARTIALLY_AVAILABLE,
        'Show should be PARTIALLY_AVAILABLE after season removal'
      );
    });

    it('should still mark deleted seasons when externalServiceId is null (no Sonarr link)', async () => {
      configureJellyfin();
      configureSonarr([{ syncEnabled: true }]);

      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1409;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.AVAILABLE;
      media.jellyfinMediaId = 'jellyfin-house2-id';
      media.externalServiceId = undefined as unknown as number;
      media.seasons = [];

      for (let i = 1; i <= 8; i++) {
        media.seasons.push(
          new Season({
            seasonNumber: i,
            status: MediaStatus.AVAILABLE,
            status4k: MediaStatus.UNKNOWN,
          })
        );
      }

      await mediaRepository.save(media);

      getItemDataImpl = async (id: string) => {
        if (id === 'jellyfin-house2-id') {
          return fakeJellyfinShow('jellyfin-house2-id', '1409');
        }
        return undefined;
      };

      getSeasonsImpl = async (seriesID: string) => {
        if (seriesID === 'jellyfin-house2-id') {
          return [fakeJellyfinSeason(6, 'jellyfin-house2-s6-id')];
        }
        return [];
      };

      getEpisodesImpl = async (_seriesID: string, seasonID: string) => {
        if (seasonID === 'jellyfin-house2-s6-id') {
          return fakeJellyfinEpisodes(21);
        }
        return [];
      };

      getSeriesByIdImpl = async () => {
        throw new Error('404');
      };

      await availabilitySync.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1409 },
        relations: ['seasons'],
      });

      const s6 = updated.seasons.find((s) => s.seasonNumber === 6);
      assert.strictEqual(
        s6?.status,
        MediaStatus.AVAILABLE,
        'Season 6 should remain AVAILABLE'
      );

      for (const season of updated.seasons) {
        if (season.seasonNumber !== 6) {
          assert.strictEqual(
            season.status,
            MediaStatus.DELETED,
            `Season ${season.seasonNumber} should be DELETED but was ${season.status}`
          );
        }
      }

      assert.strictEqual(
        updated.status,
        MediaStatus.PARTIALLY_AVAILABLE,
        'Show should be PARTIALLY_AVAILABLE after season removal'
      );
    });

    it('should mark deleted seasons even when Jellyfin returns empty season metadata entries (real-world behavior)', async () => {
      configureJellyfin();
      configureSonarr([{ syncEnabled: true }]);

      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1410;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.AVAILABLE;
      media.jellyfinMediaId = 'jellyfin-house3-id';
      media.externalServiceId = 101;
      media.seasons = [];

      for (let i = 1; i <= 8; i++) {
        media.seasons.push(
          new Season({
            seasonNumber: i,
            status: MediaStatus.AVAILABLE,
            status4k: MediaStatus.UNKNOWN,
          })
        );
      }

      await mediaRepository.save(media);

      getItemDataImpl = async (id: string) => {
        if (id === 'jellyfin-house3-id') {
          return fakeJellyfinShow('jellyfin-house3-id', '1410');
        }
        return undefined;
      };

      // MOCK REAL BEHAVIOR: Jellyfin returns ALL 8 season metadata entries
      // even though only season 6 has actual episode files.
      getSeasonsImpl = async (seriesID: string) => {
        if (seriesID === 'jellyfin-house3-id') {
          return Array.from({ length: 8 }, (_, i) =>
            fakeJellyfinSeason(i + 1, `jellyfin-house3-s${i + 1}-id`)
          );
        }
        return [];
      };

      // Only season 6 has actual episodes
      getEpisodesImpl = async (_seriesID: string, seasonID: string) => {
        if (seasonID === 'jellyfin-house3-s6-id') {
          return fakeJellyfinEpisodes(21);
        }
        return [];
      };

      getSeriesByIdImpl = async (id: number) => {
        if (id === 101) {
          return {
            tvdbId: 73255,
            id: 101,
            title: 'House',
            titleSlug: 'house',
            monitored: true,
            statistics: {
              episodeFileCount: 21,
              totalEpisodeCount: 177,
              episodeCount: 177,
              percentOfEpisodes: 11.86,
              sizeOnDisk: 0,
              seasonCount: 8,
            },
            seasons: fakeSonarrSeasons(8, { 6: 21 }),
          } as unknown as SonarrSeries;
        }
        throw new Error('404');
      };

      await availabilitySync.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1410 },
        relations: ['seasons'],
      });

      const s6 = updated.seasons.find((s) => s.seasonNumber === 6);
      assert.strictEqual(
        s6?.status,
        MediaStatus.AVAILABLE,
        'Season 6 should remain AVAILABLE'
      );

      for (const season of updated.seasons) {
        if (season.seasonNumber !== 6) {
          assert.strictEqual(
            season.status,
            MediaStatus.DELETED,
            `Season ${season.seasonNumber} should be DELETED but was ${season.status}`
          );
        }
      }

      assert.strictEqual(
        updated.status,
        MediaStatus.PARTIALLY_AVAILABLE,
        'Show should be PARTIALLY_AVAILABLE after season removal'
      );
    });

    it('should assume season exists when getEpisodes fails (safe fallback)', async () => {
      configureJellyfin();
      configureSonarr([{ syncEnabled: true }]);

      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 1411;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.AVAILABLE;
      media.jellyfinMediaId = 'jellyfin-house4-id';
      media.externalServiceId = 102;
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.AVAILABLE,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];

      await mediaRepository.save(media);

      getItemDataImpl = async (id: string) => {
        if (id === 'jellyfin-house4-id') {
          return fakeJellyfinShow('jellyfin-house4-id', '1411');
        }
        return undefined;
      };

      getSeasonsImpl = async (seriesID: string) => {
        if (seriesID === 'jellyfin-house4-id') {
          return [fakeJellyfinSeason(1, 'jellyfin-house4-s1-id')];
        }
        return [];
      };

      getEpisodesImpl = async () => {
        throw new Error('Connection refused');
      };

      getSeriesByIdImpl = async (id: number) => {
        if (id === 102) {
          return {
            tvdbId: 99999,
            id: 102,
            title: 'House 4',
            titleSlug: 'house-4',
            monitored: true,
            statistics: {
              episodeFileCount: 10,
              totalEpisodeCount: 10,
              episodeCount: 10,
              percentOfEpisodes: 100,
              sizeOnDisk: 0,
              seasonCount: 1,
            },
            seasons: fakeSonarrSeasons(1, { 1: 10 }),
          } as unknown as SonarrSeries;
        }
        throw new Error('404');
      };

      await availabilitySync.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 1411 },
        relations: ['seasons'],
      });

      assert.strictEqual(
        updated.seasons[0].status,
        MediaStatus.AVAILABLE,
        'Season should remain AVAILABLE when getEpisodes fails'
      );
      assert.strictEqual(
        updated.status,
        MediaStatus.AVAILABLE,
        'Show should remain AVAILABLE when getEpisodes fails'
      );
    });
  });

  describe('TV season availability - Plex', () => {
    it('should mark deleted seasons when Plex returns empty season metadata entries', async () => {
      configurePlex();
      configureSonarr([{ syncEnabled: true }]);

      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 2000;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.AVAILABLE;
      media.ratingKey = 'plex-house-rk';
      media.externalServiceId = 200;
      media.seasons = [];

      for (let i = 1; i <= 8; i++) {
        media.seasons.push(
          new Season({
            seasonNumber: i,
            status: MediaStatus.AVAILABLE,
            status4k: MediaStatus.UNKNOWN,
          })
        );
      }

      await mediaRepository.save(media);

      getMetadataImpl = async (key: string) => {
        if (key === 'plex-house-rk') {
          return fakePlexShow('plex-house-rk');
        }
        throw new Error('404');
      };

      // Plex returns ALL 8 season metadata entries,
      // but only season 6 has episode files
      getChildrenMetadataImpl = async (key: string) => {
        if (key === 'plex-house-rk') {
          return Array.from({ length: 8 }, (_, i) =>
            fakePlexSeason(i + 1, `plex-house-s${i + 1}-rk`)
          );
        }
        if (key === 'plex-house-s6-rk') {
          return fakePlexEpisodes(21);
        }
        return [];
      };

      // Sonarr: only season 6 has files
      getSeriesByIdImpl = async (id: number) => {
        if (id === 200) {
          return {
            tvdbId: 73255,
            id: 200,
            title: 'House',
            titleSlug: 'house',
            monitored: true,
            statistics: {
              episodeFileCount: 21,
              totalEpisodeCount: 177,
              episodeCount: 177,
              percentOfEpisodes: 11.86,
              sizeOnDisk: 0,
              seasonCount: 8,
            },
            seasons: fakeSonarrSeasons(8, { 6: 21 }),
          } as unknown as SonarrSeries;
        }
        throw new Error('404');
      };

      await availabilitySync.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2000 },
        relations: ['seasons'],
      });

      const s6 = updated.seasons.find((s) => s.seasonNumber === 6);
      assert.strictEqual(
        s6?.status,
        MediaStatus.AVAILABLE,
        'Season 6 should remain AVAILABLE'
      );

      for (const season of updated.seasons) {
        if (season.seasonNumber !== 6) {
          assert.strictEqual(
            season.status,
            MediaStatus.DELETED,
            `Season ${season.seasonNumber} should be DELETED but was ${season.status}`
          );
        }
      }

      assert.strictEqual(
        updated.status,
        MediaStatus.PARTIALLY_AVAILABLE,
        'Show should be PARTIALLY_AVAILABLE after season removal'
      );
    });

    it('should assume season exists when getChildrenMetadata fails for episodes (safe fallback)', async () => {
      configurePlex();
      configureSonarr([{ syncEnabled: true }]);

      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 2001;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.AVAILABLE;
      media.ratingKey = 'plex-house2-rk';
      media.externalServiceId = 201;
      media.seasons = [
        new Season({
          seasonNumber: 1,
          status: MediaStatus.AVAILABLE,
          status4k: MediaStatus.UNKNOWN,
        }),
      ];

      await mediaRepository.save(media);

      getMetadataImpl = async (key: string) => {
        if (key === 'plex-house2-rk') {
          return fakePlexShow('plex-house2-rk');
        }
        throw new Error('404');
      };

      getChildrenMetadataImpl = async (key: string) => {
        if (key === 'plex-house2-rk') {
          return [fakePlexSeason(1, 'plex-house2-s1-rk')];
        }
        throw new Error('Connection refused');
      };

      getSeriesByIdImpl = async (id: number) => {
        if (id === 201) {
          return {
            tvdbId: 99999,
            id: 201,
            title: 'House 2',
            titleSlug: 'house-2',
            monitored: true,
            statistics: {
              episodeFileCount: 10,
              totalEpisodeCount: 10,
              episodeCount: 10,
              percentOfEpisodes: 100,
              sizeOnDisk: 0,
              seasonCount: 1,
            },
            seasons: fakeSonarrSeasons(1, { 1: 10 }),
          } as unknown as SonarrSeries;
        }
        throw new Error('404');
      };

      await availabilitySync.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2001 },
        relations: ['seasons'],
      });

      assert.strictEqual(
        updated.seasons[0].status,
        MediaStatus.AVAILABLE,
        'Season should remain AVAILABLE when getChildrenMetadata fails'
      );
      assert.strictEqual(
        updated.status,
        MediaStatus.AVAILABLE,
        'Show should remain AVAILABLE when getChildrenMetadata fails'
      );
    });

    it('should mark deleted seasons when only some seasons have episodes in Plex (no Sonarr link)', async () => {
      configurePlex();
      configureSonarr([{ syncEnabled: true }]);

      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 2002;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.AVAILABLE;
      media.ratingKey = 'plex-house3-rk';
      media.externalServiceId = undefined as unknown as number;
      media.seasons = [];

      for (let i = 1; i <= 4; i++) {
        media.seasons.push(
          new Season({
            seasonNumber: i,
            status: MediaStatus.AVAILABLE,
            status4k: MediaStatus.UNKNOWN,
          })
        );
      }

      await mediaRepository.save(media);

      getMetadataImpl = async (key: string) => {
        if (key === 'plex-house3-rk') {
          return fakePlexShow('plex-house3-rk');
        }
        throw new Error('404');
      };

      getChildrenMetadataImpl = async (key: string) => {
        if (key === 'plex-house3-rk') {
          return Array.from({ length: 4 }, (_, i) =>
            fakePlexSeason(i + 1, `plex-house3-s${i + 1}-rk`)
          );
        }
        // Only seasons 2 and 4 have episodes
        if (key === 'plex-house3-s2-rk' || key === 'plex-house3-s4-rk') {
          return fakePlexEpisodes(10);
        }
        return [];
      };

      getSeriesByIdImpl = async () => {
        throw new Error('404');
      };

      await availabilitySync.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 2002 },
        relations: ['seasons'],
      });

      const s2 = updated.seasons.find((s) => s.seasonNumber === 2);
      const s4 = updated.seasons.find((s) => s.seasonNumber === 4);
      assert.strictEqual(
        s2?.status,
        MediaStatus.AVAILABLE,
        'Season 2 should remain AVAILABLE'
      );
      assert.strictEqual(
        s4?.status,
        MediaStatus.AVAILABLE,
        'Season 4 should remain AVAILABLE'
      );

      const s1 = updated.seasons.find((s) => s.seasonNumber === 1);
      const s3 = updated.seasons.find((s) => s.seasonNumber === 3);
      assert.strictEqual(
        s1?.status,
        MediaStatus.DELETED,
        'Season 1 should be DELETED'
      );
      assert.strictEqual(
        s3?.status,
        MediaStatus.DELETED,
        'Season 3 should be DELETED'
      );

      assert.strictEqual(
        updated.status,
        MediaStatus.PARTIALLY_AVAILABLE,
        'Show should be PARTIALLY_AVAILABLE after season removal'
      );
    });
  });
});
