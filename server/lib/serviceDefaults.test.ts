import { MediaType } from '@server/constants/media';
import {
  resolveServiceDefaults,
  stripDefaultOverrides,
} from '@server/lib/serviceDefaults';
import type { SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

function sonarr(overrides: Partial<SonarrSettings> = {}): SonarrSettings {
  return {
    id: 0,
    name: 'Sonarr',
    hostname: 'localhost',
    port: 8989,
    apiKey: 'test-key',
    baseUrl: '',
    useSsl: false,
    activeProfileId: 1,
    activeDirectory: '/tv',
    activeLanguageProfileId: 1,
    tags: [],
    is4k: false,
    isDefault: true,
    syncEnabled: true,
    preventSearch: false,
    externalUrl: '',
    ...overrides,
  } as SonarrSettings;
}

describe('resolveServiceDefaults', () => {
  it('prefers the anime settings for an anime show', () => {
    const defaults = resolveServiceDefaults(
      MediaType.TV,
      sonarr({
        activeAnimeDirectory: '/anime',
        activeAnimeProfileId: 7,
        activeAnimeLanguageProfileId: 3,
        animeTags: [5],
      }),
      true
    );

    assert.strictEqual(defaults.rootFolder, '/anime');
    assert.strictEqual(defaults.profileId, 7);
    assert.strictEqual(defaults.languageProfileId, 3);
    assert.deepStrictEqual(defaults.tags, [5]);
  });

  it('falls back to the standard settings when no anime ones are set', () => {
    const defaults = resolveServiceDefaults(MediaType.TV, sonarr(), true);

    assert.strictEqual(defaults.rootFolder, '/tv');
    assert.strictEqual(defaults.profileId, 1);
  });

  it('ignores the anime settings for a show that is not anime', () => {
    const defaults = resolveServiceDefaults(
      MediaType.TV,
      sonarr({ activeAnimeDirectory: '/anime', activeAnimeProfileId: 7 }),
      false
    );

    assert.strictEqual(defaults.rootFolder, '/tv');
    assert.strictEqual(defaults.profileId, 1);
  });
});

describe('stripDefaultOverrides', () => {
  beforeEach(() => {
    const settings = getSettings();
    settings.radarr = [];
    settings.sonarr = [
      sonarr({ activeAnimeDirectory: '/anime', activeAnimeProfileId: 7 }),
    ];
  });

  function strip(
    overrides: Parameters<typeof stripDefaultOverrides>[0]['overrides'],
    isAnime = true
  ) {
    return stripDefaultOverrides({
      mediaType: MediaType.TV,
      is4k: false,
      isAnime,
      overrides,
    });
  }

  it('clears a value that matches the anime default', () => {
    assert.strictEqual(strip({ rootFolder: '/anime' }).rootFolder, null);
    assert.strictEqual(strip({ profileId: 7 }).profileId, null);
  });

  it('keeps the standard directory as a deliberate choice for an anime show', () => {
    assert.strictEqual(strip({ rootFolder: '/tv' }).rootFolder, '/tv');
  });

  it('leaves an absent field absent', () => {
    assert.strictEqual(strip({}).rootFolder, undefined);
    assert.strictEqual(strip({}).tags, undefined);
  });

  it('treats a reordered tag list as unchanged', () => {
    const settings = getSettings();
    settings.sonarr = [sonarr({ tags: [1, 2] })];

    assert.strictEqual(strip({ tags: [2, 1] }, false).tags, null);
  });

  it('keeps a tag list that is a different set', () => {
    const settings = getSettings();
    settings.sonarr = [sonarr({ tags: [1, 2] })];

    assert.deepStrictEqual(strip({ tags: [1, 3] }, false).tags, [1, 3]);
  });

  it('returns the values untouched when no service matches', () => {
    getSettings().sonarr = [];

    assert.strictEqual(strip({ rootFolder: '/anime' }).rootFolder, '/anime');
  });
});
