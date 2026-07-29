import ExternalAPI from '@server/api/externalapi';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import Media from '@server/entity/Media';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

// Intercept all TMDB HTTP calls (getDiscoverMovies/Tv are instance arrow-props
// that call the inherited protected `get`).
Object.defineProperty(ExternalAPI.prototype, 'get', {
  value: async (
    endpoint: string,
    config?: { params?: Record<string, unknown> }
  ) => {
    const params = config?.params ?? {};
    if (
      endpoint === '/discover/movie' &&
      params.with_genres === '28' &&
      params.page === 1
    ) {
      return {
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [{ id: 500, title: 'Blocked Action Movie', genre_ids: [28] }],
      };
    }
    // everything else: empty first page so the sort loop terminates immediately
    return { page: 1, total_pages: 1, total_results: 0, results: [] };
  },
  writable: true,
  configurable: true,
});

import blocklistedTagsProcessor from '@server/job/blocklistedTagsProcessor';

setupTestDb();

describe('Process Blocklisted Tags job — genre passes', () => {
  beforeEach(() => {
    const settings = getSettings();
    settings.main.blocklistedTags = '';
    settings.main.blocklistedGenresMovie = '';
    settings.main.blocklistedGenresTv = '';
    settings.main.blocklistedTagsLimit = 1;
  });

  it('blocklists movies matching a configured movie genre', async () => {
    getSettings().main.blocklistedGenresMovie = '28';

    await blocklistedTagsProcessor.run();

    const entry = await getRepository(Blocklist).findOne({
      where: { tmdbId: 500, mediaType: MediaType.MOVIE },
    });
    assert.ok(entry, 'expected a blocklist row for the matched movie');
    assert.ok(
      entry!.blocklistedGenres?.includes(',28,'),
      'genre marker recorded'
    );

    const media = await getRepository(Media).findOne({
      where: { tmdbId: 500, mediaType: MediaType.MOVIE },
    });
    assert.equal(media?.status, MediaStatus.BLOCKLISTED);
  });

  it('preserves manual blocklist entries (both markers null) across a run', async () => {
    getSettings().main.blocklistedGenresMovie = '28';
    await Blocklist.addToBlocklist({
      blocklistRequest: {
        mediaType: MediaType.MOVIE,
        tmdbId: 999,
        title: 'Manual',
      },
    });

    await blocklistedTagsProcessor.run();

    const manual = await getRepository(Blocklist).findOne({
      where: { tmdbId: 999, mediaType: MediaType.MOVIE },
    });
    assert.ok(manual, 'manual entry must survive cleanBlocklist');
    assert.equal(manual!.blocklistedTags ?? null, null);
    assert.equal(manual!.blocklistedGenres ?? null, null);
  });
});
