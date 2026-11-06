import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { AxiosInstance } from 'axios';
import axios from 'axios';

import SonarrAPI, {
  apiPathForMajor,
  capabilitiesForMajor,
  majorFromApiInfoCurrent,
} from '@server/api/servarr/sonarr';
import type { SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';

function buildSonarr(major = 3): SonarrAPI {
  return SonarrAPI.create({
    url: `http://localhost:8989${apiPathForMajor(major)}`,
    apiKey: 'test',
    major,
  });
}

function getAxios(sonarr: SonarrAPI): AxiosInstance {
  return (sonarr as unknown as { axios: AxiosInstance }).axios;
}

function baseSettings(overrides: Partial<SonarrSettings> = {}): SonarrSettings {
  return {
    id: 1,
    name: 'Sonarr',
    hostname: 'localhost',
    port: 8989,
    apiKey: 'test',
    useSsl: false,
    activeProfileId: 1,
    activeProfileName: 'Any',
    activeDirectory: '/tv',
    tags: [],
    is4k: false,
    isDefault: true,
    syncEnabled: true,
    preventSearch: false,
    tagRequests: false,
    overrideRule: [],
    seriesType: 'standard',
    animeSeriesType: 'anime',
    enableSeasonFolders: true,
    monitorNewItems: 'all',
    ...overrides,
  };
}

describe('SonarrAPI version helpers', () => {
  it('maps majors to the correct API path', () => {
    assert.strictEqual(apiPathForMajor(3), '/api/v3');
    assert.strictEqual(apiPathForMajor(4), '/api/v3');
    assert.strictEqual(apiPathForMajor(5), '/api/v5');
    assert.strictEqual(apiPathForMajor(6), '/api/v5');
  });

  it('builds capabilities for major 3 / 4 / 5', () => {
    assert.deepStrictEqual(capabilitiesForMajor(3), {
      major: 3,
      languageProfiles: true,
      metadataLanguage: false,
      seasonOrders: false,
    });
    assert.deepStrictEqual(capabilitiesForMajor(4), {
      major: 4,
      languageProfiles: false,
      metadataLanguage: false,
      seasonOrders: false,
    });
    assert.deepStrictEqual(capabilitiesForMajor(5), {
      major: 5,
      languageProfiles: false,
      metadataLanguage: true,
      seasonOrders: true,
    });
  });

  it('parses ApiInfo current values', () => {
    assert.strictEqual(majorFromApiInfoCurrent('v5'), 5);
    assert.strictEqual(majorFromApiInfoCurrent('v3'), 3);
    assert.strictEqual(majorFromApiInfoCurrent('5'), 5);
    assert.strictEqual(majorFromApiInfoCurrent(null), null);
    assert.strictEqual(majorFromApiInfoCurrent(undefined), null);
  });
});

describe('SonarrAPI factory', () => {
  afterEach(() => mock.restoreAll());

  it('fromSettings uses cached apiMajorVersion without probing', async () => {
    const probe = mock.method(SonarrAPI, 'probeMajorVersion', async () => {
      throw new Error('should not probe');
    });

    const sonarr = await SonarrAPI.fromSettings(
      baseSettings({ apiMajorVersion: 5 }),
      { persist: false }
    );

    assert.strictEqual(sonarr.capabilities.major, 5);
    assert.strictEqual(sonarr.capabilities.metadataLanguage, true);
    assert.strictEqual(probe.mock.callCount(), 0);
  });

  it('fromSettings uses system/status app version, not /api current', async () => {
    // Sonarr v4 reports /api current: "v3" even though the app major is 4.
    const urls: string[] = [];
    mock.method(axios, 'get', async (url: string) => {
      urls.push(url);
      if (url.endsWith('/api')) {
        return { data: { current: 'v3', deprecated: [] } };
      }
      if (url.includes('/api/v3/system/status')) {
        return { data: { version: '4.0.12.2823' } };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const settings = baseSettings();
    const sonarr = await SonarrAPI.fromSettings(settings, { persist: false });

    assert.strictEqual(settings.apiMajorVersion, 4);
    assert.strictEqual(sonarr.capabilities.major, 4);
    assert.strictEqual(sonarr.capabilities.languageProfiles, false);
    assert.match(getAxios(sonarr).defaults.baseURL ?? '', /\/api\/v3$/);
    assert.ok(
      urls
        .find((url) => url.includes('/system/status'))
        ?.includes('/api/v3/system/status')
    );
  });

  it('fromSettings probes v5 system/status first when /api current is v5', async () => {
    const urls: string[] = [];
    mock.method(axios, 'get', async (url: string) => {
      urls.push(url);
      if (url.endsWith('/api')) {
        return { data: { current: 'v5', deprecated: ['v3'] } };
      }
      if (url.includes('/api/v5/system/status')) {
        return { data: { version: '5.0.0.2941' } };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const settings = baseSettings();
    const sonarr = await SonarrAPI.fromSettings(settings, { persist: false });

    assert.strictEqual(settings.apiMajorVersion, 5);
    assert.strictEqual(sonarr.capabilities.major, 5);
    assert.match(getAxios(sonarr).defaults.baseURL ?? '', /\/api\/v5$/);
    assert.ok(
      urls
        .find((url) => url.includes('/system/status'))
        ?.includes('/api/v5/system/status')
    );
  });

  it('fromSettings persists apiMajorVersion onto matching settings entry', async () => {
    mock.method(axios, 'get', async (url: string) => {
      if (url.endsWith('/api')) {
        return { data: { current: 'v5', deprecated: ['v3'] } };
      }
      if (url.includes('/api/v5/system/status')) {
        return { data: { version: '5.0.0.2941' } };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const stored = baseSettings({ id: 7 });
    const settings = getSettings();
    settings.sonarr = [stored];
    const save = mock.method(settings, 'save', async () => undefined);

    const sonarr = await SonarrAPI.fromSettings(stored);

    assert.strictEqual(stored.apiMajorVersion, 5);
    assert.strictEqual(settings.sonarr[0].apiMajorVersion, 5);
    assert.strictEqual(sonarr.capabilities.major, 5);
    assert.ok(save.mock.callCount() >= 1);
  });

  it('fromSettings skips persist when the endpoint changed during probe', async () => {
    const stored = baseSettings({ id: 7, hostname: 'old.example' });
    const settings = getSettings();
    settings.sonarr = [stored];
    const save = mock.method(settings, 'save', async () => undefined);

    mock.method(SonarrAPI, 'probeMajorVersion', async () => {
      stored.hostname = 'new.example';
      return 5;
    });

    await SonarrAPI.fromSettings(
      baseSettings({ id: 7, hostname: 'old.example' })
    );

    assert.strictEqual(save.mock.callCount(), 0);
  });

  it('fromSettings throws when every system/status probe fails', async () => {
    mock.method(axios, 'get', async () => {
      throw new Error('unreachable');
    });

    await assert.rejects(
      () => SonarrAPI.fromSettings(baseSettings(), { persist: false }),
      /Failed to determine API version/
    );
  });

  it('getLanguageProfiles returns [] when unsupported', async () => {
    const sonarr = buildSonarr(5);
    const getRolling = mock.method(
      sonarr as unknown as { getRolling: () => Promise<unknown> },
      'getRolling',
      async () => [{ id: 1, name: 'English' }]
    );

    const profiles = await sonarr.getLanguageProfiles();
    assert.deepStrictEqual(profiles, []);
    assert.strictEqual(getRolling.mock.callCount(), 0);
  });
});

describe('SonarrAPI addSeries payload', () => {
  afterEach(() => mock.restoreAll());

  const lookupSeries = {
    title: 'Test Show',
    seasons: [{ seasonNumber: 1, monitored: false }],
  };

  const addOptions = {
    tvdbid: 1234,
    title: 'Test Show',
    profileId: 1,
    languageProfileId: 2,
    seasons: [1],
    seasonFolder: true,
    rootFolderPath: '/tv',
    seriesType: 'standard' as const,
    monitored: true,
    searchNow: false,
  };

  async function captureCreatePayload(major: number) {
    const sonarr = buildSonarr(major);
    mock.method(sonarr, 'getSeriesByTvdbId', async () => lookupSeries);
    let posted: Record<string, unknown> | undefined;
    mock.method(
      getAxios(sonarr),
      'post',
      async (_url: string, body: unknown) => {
        posted = body as Record<string, unknown>;
        return { data: { ...lookupSeries, id: 99 } };
      }
    );

    await sonarr.addSeries(addOptions);
    assert.ok(posted);
    return posted;
  }

  it('includes languageProfileId on Sonarr v3', async () => {
    const payload = await captureCreatePayload(3);
    assert.strictEqual(payload.languageProfileId, 2);
  });

  it('omits languageProfileId on Sonarr v4 and v5', async () => {
    for (const major of [4, 5]) {
      const payload = await captureCreatePayload(major);
      assert.strictEqual(payload.languageProfileId, undefined);
    }
  });
});

describe('SonarrAPI removeSeries', () => {
  afterEach(() => mock.restoreAll());

  it('removes the series when it exists in the library', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await sonarr.removeSeries(1234);

    assert.strictEqual(del.mock.callCount(), 1);
    assert.strictEqual(del.mock.calls[0].arguments[0], '/series/9');
  });

  it('does nothing when the series is not in the library', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({
      data: [{ id: 0, title: 'Breaking Bad' }],
    }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.doesNotReject(() => sonarr.removeSeries(1234));
    assert.strictEqual(del.mock.callCount(), 0);
  });

  it('rejects when the tvdbId is unknown to the lookup', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({ data: [] }));
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.rejects(() => sonarr.removeSeries(1234), /Series not found/);
    assert.strictEqual(del.mock.callCount(), 0);
  });

  it('ignores a 404 when the series was already removed in Sonarr', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    mock.method(getAxios(sonarr), 'delete', async () => {
      throw { response: { status: 404 } };
    });

    await assert.doesNotReject(() => sonarr.removeSeries(1234));
  });

  it('rethrows errors other than 404', async () => {
    const sonarr = buildSonarr();
    mock.method(SonarrAPI.prototype, 'getSeriesByTvdbId', async () => ({
      id: 9,
      title: 'Test Series',
    }));
    mock.method(getAxios(sonarr), 'delete', async () => {
      throw { response: { status: 500 } };
    });

    await assert.rejects(() => sonarr.removeSeries(1234));
  });

  it('rethrows a 404 from the lookup instead of treating it as removed', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => {
      throw { response: { status: 404 } };
    });
    const del = mock.method(getAxios(sonarr), 'delete', async () => ({}));

    await assert.rejects(
      () => sonarr.removeSeries(1234),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 404
    );
    assert.strictEqual(del.mock.callCount(), 0);
  });
});

describe('SonarrAPI getSeriesByTvdbId', () => {
  afterEach(() => mock.restoreAll());

  it('rethrows a 401 from the lookup with the status intact', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => {
      throw { response: { status: 401 } };
    });

    await assert.rejects(
      () => sonarr.getSeriesByTvdbId(1234),
      (e: unknown) =>
        (e as { response?: { status?: number } }).response?.status === 401
    );
  });

  it('throws "Series not found" when the lookup returns no results', async () => {
    const sonarr = buildSonarr();
    mock.method(getAxios(sonarr), 'get', async () => ({ data: [] }));

    await assert.rejects(() => sonarr.getSeriesByTvdbId(1234), {
      message: 'Series not found',
    });
  });
});
