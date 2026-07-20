import ExternalAPI from '@server/api/externalapi';
import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaStatus, MediaType } from '@server/constants/media';
import Media from '@server/entity/Media';
import { removeMediaFiles } from '@server/lib/mediaDeletion';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

// Capture the id + base URL passed into the lookup, then throw before any
// real HTTP call, to verify removeMovie/removeSeries forward the right id
// type and hit the right server without needing a live Radarr/Sonarr.
let lastMovieLookup: { tmdbId: number; baseUrl: string } | undefined;
let lastSeriesLookup: { tvdbId: number; baseUrl: string } | undefined;

mock.method(
  RadarrAPI.prototype,
  'getMovieByTmdbId',
  async function (this: RadarrAPI, tmdbId: number) {
    lastMovieLookup = {
      tmdbId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseUrl: (this as any).axios.defaults.baseURL,
    };
    throw new Error('stop-before-network');
  }
);

mock.method(
  SonarrAPI.prototype,
  'getSeriesByTvdbId',
  async function (this: SonarrAPI, tvdbId: number) {
    lastSeriesLookup = {
      tvdbId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseUrl: (this as any).axios.defaults.baseURL,
    };
    throw new Error('stop-before-network');
  }
);

// Mutable so individual tests can swap the response.
let tvShowLookupResult: { external_ids: { tvdb_id: number | null } } = {
  external_ids: { tvdb_id: 246813 },
};
mock.method(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExternalAPI.prototype as any,
  'get',
  async () => tvShowLookupResult
);

function radarrSettings(
  overrides: Partial<RadarrSettings> = {}
): RadarrSettings {
  return {
    id: 1,
    name: 'Radarr',
    hostname: 'radarr.example.com',
    port: 7878,
    apiKey: 'radarr-key',
    useSsl: false,
    activeProfileId: 1,
    activeProfileName: 'HD',
    activeDirectory: '/movies',
    tags: [],
    is4k: false,
    isDefault: true,
    syncEnabled: true,
    preventSearch: false,
    tagRequests: false,
    overrideRule: [],
    minimumAvailability: 'released',
    ...overrides,
  };
}

function sonarrSettings(
  overrides: Partial<SonarrSettings> = {}
): SonarrSettings {
  return {
    id: 1,
    name: 'Sonarr',
    hostname: 'sonarr.example.com',
    port: 8989,
    apiKey: 'sonarr-key',
    useSsl: false,
    activeProfileId: 1,
    activeProfileName: 'HD',
    activeDirectory: '/tv',
    tags: [],
    is4k: false,
    isDefault: true,
    syncEnabled: true,
    preventSearch: false,
    tagRequests: false,
    overrideRule: [],
    seriesType: 'standard',
    animeSeriesType: 'standard',
    enableSeasonFolders: true,
    monitorNewItems: 'all',
    ...overrides,
  };
}

describe('removeMediaFiles', () => {
  beforeEach(() => {
    lastMovieLookup = undefined;
    lastSeriesLookup = undefined;
    tvShowLookupResult = { external_ids: { tvdb_id: 246813 } };
    getSettings().radarr = [];
    getSettings().sonarr = [];
  });

  it('passes the movie TMDB id (not an arr-internal id) to Radarr, via the default server', async () => {
    getSettings().radarr = [radarrSettings({ id: 1 })];
    const media = new Media({
      mediaType: MediaType.MOVIE,
      tmdbId: 98765,
      status: MediaStatus.AVAILABLE,
    });

    await assert.rejects(removeMediaFiles(media, false), /stop-before-network/);

    assert.equal(lastMovieLookup?.tmdbId, 98765);
    assert.equal(
      lastMovieLookup?.baseUrl,
      'http://radarr.example.com:7878/api/v3'
    );
    assert.equal(
      lastSeriesLookup,
      undefined,
      'Sonarr must not be contacted for a movie'
    );
  });

  it('resolves the TVDB id from TMDB external_ids and passes that (not the TMDB id) to Sonarr', async () => {
    getSettings().sonarr = [sonarrSettings({ id: 1 })];
    const media = new Media({
      mediaType: MediaType.TV,
      tmdbId: 11111,
      tvdbId: 22222,
      status: MediaStatus.AVAILABLE,
    });

    await assert.rejects(removeMediaFiles(media, false), /stop-before-network/);

    assert.equal(lastSeriesLookup?.tvdbId, 246813);
    assert.equal(
      lastSeriesLookup?.baseUrl,
      'http://sonarr.example.com:8989/api/v3'
    );
    assert.equal(
      lastMovieLookup,
      undefined,
      'Radarr must not be contacted for a series'
    );
  });

  it('falls back to media.tvdbId when TMDB has no external tvdb_id', async () => {
    tvShowLookupResult = { external_ids: { tvdb_id: null } };
    getSettings().sonarr = [sonarrSettings({ id: 1 })];
    const media = new Media({
      mediaType: MediaType.TV,
      tmdbId: 11111,
      tvdbId: 33333,
      status: MediaStatus.AVAILABLE,
    });

    await assert.rejects(removeMediaFiles(media, false), /stop-before-network/);

    assert.equal(lastSeriesLookup?.tvdbId, 33333);
  });

  it('uses the media-specific server (not the default) when one is set', async () => {
    getSettings().radarr = [
      radarrSettings({ id: 1, isDefault: true, hostname: 'default-radarr' }),
      radarrSettings({ id: 2, isDefault: false, hostname: 'specific-radarr' }),
    ];
    const media = new Media({
      mediaType: MediaType.MOVIE,
      tmdbId: 55555,
      status: MediaStatus.AVAILABLE,
      serviceId: 2,
    });

    await assert.rejects(removeMediaFiles(media, false), /stop-before-network/);

    assert.equal(
      lastMovieLookup?.baseUrl,
      'http://specific-radarr:7878/api/v3',
      'Should build the client against the media-specific server, not the default'
    );
  });

  it('does nothing and reports no attempt when no matching server is configured', async () => {
    const media = new Media({
      mediaType: MediaType.MOVIE,
      tmdbId: 1,
      status: MediaStatus.AVAILABLE,
    });

    const attempted = await removeMediaFiles(media, false);

    assert.equal(attempted, false);
    assert.equal(lastMovieLookup, undefined);
  });
});
