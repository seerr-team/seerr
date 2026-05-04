import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { RadarrMovie } from '@server/api/servarr/radarr';
import RadarrAPI from '@server/api/servarr/radarr';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import type { RadarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';

let getMoviesImpl: () => Promise<RadarrMovie[]> = async () => [];
Object.defineProperty(RadarrAPI.prototype, 'getMovies', {
  set() {},
  get() {
    return async () => getMoviesImpl();
  },
  configurable: true,
});

import { radarrScanner } from '@server/lib/scanners/radarr';

setupTestDb();

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
  settings.sonarr = [];
}

function fakeRadarrMovie(overrides: Partial<RadarrMovie> = {}): RadarrMovie {
  return {
    tmdbId: 550,
    id: 1,
    title: 'Test Movie',
    titleSlug: 'test-movie',
    monitored: true,
    hasFile: true,
    isAvailable: true,
    imdbId: 'tt0137523',
    folderName: '/movies/Test Movie (2024)',
    path: '/movies/Test Movie (2024)',
    profileId: 1,
    qualityProfileId: 1,
    added: '2024-01-01T00:00:00Z',
    tags: [],
    ...overrides,
  };
}

describe('Radarr Scanner', () => {
  beforeEach(() => {
    getMoviesImpl = async () => [];
  });

  describe('unmonitored movie handling', () => {
    it('resets PROCESSING to UNKNOWN when movie is unmonitored and has no file', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 550;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true }]);
      getMoviesImpl = async () => [
        fakeRadarrMovie({ monitored: false, hasFile: false }),
      ];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 550 },
      });
      assert.strictEqual(updated.status, MediaStatus.UNKNOWN);
    });

    it('does not create new media entry when movie is unmonitored and has no file', async () => {
      const mediaRepository = getRepository(Media);
      configureRadarr([{ syncEnabled: true }]);

      getMoviesImpl = async () => [
        fakeRadarrMovie({ tmdbId: 777, monitored: false, hasFile: false }),
      ];

      await radarrScanner.run();

      const media = await mediaRepository.findOne({
        where: { tmdbId: 777 },
      });
      assert.strictEqual(media, null);
    });

    it('sets AVAILABLE when movie has a file', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 551;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true }]);
      getMoviesImpl = async () => [
        fakeRadarrMovie({ tmdbId: 551, monitored: true, hasFile: true }),
      ];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 551 },
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
    });

    it('sets PROCESSING when movie is monitored but has no file', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 552;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.UNKNOWN;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true }]);
      getMoviesImpl = async () => [
        fakeRadarrMovie({ tmdbId: 552, monitored: true, hasFile: false }),
      ];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 552 },
      });
      assert.strictEqual(updated.status, MediaStatus.PROCESSING);
    });

    it('preserves DELETED status when movie is monitored but has no file', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 553;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.DELETED;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true }]);
      getMoviesImpl = async () => [
        fakeRadarrMovie({ tmdbId: 553, monitored: true, hasFile: false }),
      ];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 553 },
      });
      assert.strictEqual(updated.status, MediaStatus.DELETED);
    });

    it('keeps AVAILABLE status even when movie is unmonitored', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 554;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.AVAILABLE;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true }]);
      getMoviesImpl = async () => [
        fakeRadarrMovie({ tmdbId: 554, monitored: false, hasFile: true }),
      ];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 554 },
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
    });
  });

  describe('orphaned movie cleanup', () => {
    it('skips cleanup when a standard server has sync disabled', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 950;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureRadarr([
        { syncEnabled: true, id: 0, hostname: 'server-a' },
        { syncEnabled: false, id: 1, hostname: 'server-b' },
      ]);

      getMoviesImpl = async () => [];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 950 },
      });
      assert.strictEqual(updated.status, MediaStatus.PROCESSING);
    });

    it('resets PROCESSING to UNKNOWN when movie is not in any Radarr server', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 999;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true }]);
      // Radarr returns empty meaning movie was deleted
      getMoviesImpl = async () => [];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 999 },
      });
      assert.strictEqual(updated.status, MediaStatus.UNKNOWN);
    });

    it('does not reset AVAILABLE movie when missing from Radarr', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 888;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.AVAILABLE;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true }]);
      getMoviesImpl = async () => [];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 888 },
      });
      assert.strictEqual(updated.status, MediaStatus.AVAILABLE);
    });

    it('does not reset PROCESSING movie that still exists in Radarr', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 700;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true }]);
      getMoviesImpl = async () => [
        fakeRadarrMovie({ tmdbId: 700, monitored: true, hasFile: false }),
      ];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 700 },
      });
      assert.strictEqual(updated.status, MediaStatus.PROCESSING);
    });

    it('does not reset TV media that is missing from Radarr', async () => {
      const mediaRepository = getRepository(Media);

      // TV show stuck in processing so Radarr scanner should not touch it
      const media = new Media();
      media.tmdbId = 800;
      media.mediaType = MediaType.TV;
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true }]);
      getMoviesImpl = async () => [];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 800 },
      });
      assert.strictEqual(updated.status, MediaStatus.PROCESSING);
    });

    it('only resets orphaned movies not found across all servers', async () => {
      const mediaRepository = getRepository(Media);

      const orphan = new Media();
      orphan.tmdbId = 901;
      orphan.mediaType = MediaType.MOVIE;
      orphan.status = MediaStatus.PROCESSING;
      await mediaRepository.save(orphan);

      const existing = new Media();
      existing.tmdbId = 902;
      existing.mediaType = MediaType.MOVIE;
      existing.status = MediaStatus.PROCESSING;
      await mediaRepository.save(existing);

      // Two servers but movie exists on server 1 only
      configureRadarr([
        { syncEnabled: true, id: 0, hostname: 'server-a' },
        { syncEnabled: true, id: 1, hostname: 'server-b' },
      ]);

      let callCount = 0;
      getMoviesImpl = async () => {
        callCount++;
        if (callCount === 1) {
          return [fakeRadarrMovie({ tmdbId: 902, id: 10 })];
        }
        return [];
      };

      await radarrScanner.run();

      const updatedOrphan = await mediaRepository.findOneOrFail({
        where: { tmdbId: 901 },
      });
      assert.strictEqual(updatedOrphan.status, MediaStatus.UNKNOWN);

      const updatedExisting = await mediaRepository.findOneOrFail({
        where: { tmdbId: 902 },
      });
      assert.strictEqual(updatedExisting.status, MediaStatus.AVAILABLE);
    });
  });

  describe('4k orphaned movie cleanup', () => {
    it('resets 4k PROCESSING to UNKNOWN when movie is not in any Radarr server', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 960;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.UNKNOWN;
      media.status4k = MediaStatus.PROCESSING;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true, is4k: true }]);
      getMoviesImpl = async () => [];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 960 },
      });
      assert.strictEqual(updated.status4k, MediaStatus.UNKNOWN);
    });

    it('does not reset 4k AVAILABLE when movie is missing from Radarr', async () => {
      const mediaRepository = getRepository(Media);

      const media = new Media();
      media.tmdbId = 961;
      media.mediaType = MediaType.MOVIE;
      media.status = MediaStatus.UNKNOWN;
      media.status4k = MediaStatus.AVAILABLE;
      await mediaRepository.save(media);

      configureRadarr([{ syncEnabled: true, is4k: true }]);
      getMoviesImpl = async () => [];

      await radarrScanner.run();

      const updated = await mediaRepository.findOneOrFail({
        where: { tmdbId: 961 },
      });
      assert.strictEqual(updated.status4k, MediaStatus.AVAILABLE);
    });
  });
});
