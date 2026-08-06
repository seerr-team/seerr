import type { AniListMedia } from '@server/api/anilist';
import {
  buildSearchCandidates,
  dedupeByTmdbId,
  extractTmdbTvMapping,
  getCurrentAnimeSeason,
  getMalIdFromTmdb,
  mapWithConcurrency,
  pickCanonicalMalId,
  pickTvSearchResult,
} from '@server/api/anilist';
import cacheManager from '@server/lib/cache';
import axios from 'axios';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

afterEach(() => mock.restoreAll());

const makeMedia = (
  romaji: string | null,
  english: string | null = null,
  year: number | null = null
): AniListMedia => ({
  id: 1,
  idMal: null,
  title: { romaji, english },
  format: 'TV',
  episodes: null,
  startDate: { year, month: null, day: null },
  coverImage: { large: null },
});

describe('getCurrentAnimeSeason', () => {
  it('maps months to AniList seasons', () => {
    assert.deepEqual(getCurrentAnimeSeason(new Date('2026-01-15')), {
      season: 'WINTER',
      year: 2026,
    });
    assert.deepEqual(getCurrentAnimeSeason(new Date('2026-03-31')), {
      season: 'WINTER',
      year: 2026,
    });
    assert.deepEqual(getCurrentAnimeSeason(new Date('2026-04-01')), {
      season: 'SPRING',
      year: 2026,
    });
    assert.deepEqual(getCurrentAnimeSeason(new Date('2026-07-05')), {
      season: 'SUMMER',
      year: 2026,
    });
    assert.deepEqual(getCurrentAnimeSeason(new Date('2026-12-31')), {
      season: 'FALL',
      year: 2026,
    });
    assert.deepEqual(
      getCurrentAnimeSeason(new Date('2026-03-31T23:30:00.000Z')),
      {
        season: 'WINTER',
        year: 2026,
      }
    );
  });
});

describe('extractTmdbTvMapping', () => {
  it('extracts tv id and tmdb season from object form', () => {
    assert.deepEqual(
      extractTmdbTvMapping({
        anilist_id: 20958,
        themoviedb_id: { tv: 1429 },
        season: { tvdb: 2, tmdb: 2 },
        type: 'TV',
      }),
      { tmdbId: 1429, tmdbSeason: 2 }
    );
  });

  it('ignores movie mappings', () => {
    assert.equal(
      extractTmdbTvMapping({
        anilist_id: 1,
        themoviedb_id: { movie: [128] },
        type: 'MOVIE',
      }),
      null
    );
  });

  it('handles plain number ids for non-movies', () => {
    assert.deepEqual(
      extractTmdbTvMapping({ anilist_id: 1, themoviedb_id: 1429, type: 'TV' }),
      { tmdbId: 1429, tmdbSeason: undefined }
    );
  });

  it('returns null when no tmdb id exists', () => {
    assert.equal(
      extractTmdbTvMapping({ anilist_id: 1, themoviedb_id: null }),
      null
    );
    assert.equal(extractTmdbTvMapping({ anilist_id: 1 }), null);
  });

  it('handles season present without tmdb key', () => {
    assert.deepEqual(
      extractTmdbTvMapping({
        anilist_id: 1,
        themoviedb_id: { tv: 5 },
        season: { tvdb: 1 },
        type: 'TV',
      }),
      { tmdbId: 5, tmdbSeason: undefined }
    );
  });
});

describe('buildSearchCandidates', () => {
  it('strips trailing season markers from sequels', () => {
    const candidates = buildSearchCandidates(makeMedia('Grand Blue Season 3'));
    assert.deepEqual(candidates, ['Grand Blue Season 3', 'Grand Blue']);
  });

  it('strips ordinal season suffixes and roman numerals', () => {
    assert.ok(
      buildSearchCandidates(
        makeMedia('Nige Jouzu no Wakagimi 2nd Season')
      ).includes('Nige Jouzu no Wakagimi')
    );
    assert.ok(
      buildSearchCandidates(makeMedia('Youjo Senki II')).includes('Youjo Senki')
    );
  });

  it('adds the segment before a colon for subtitled sequels', () => {
    const candidates = buildSearchCandidates(
      makeMedia('Clevatess II: Majuu no Ou to Itsuwari no Yuusha Denshou')
    );
    assert.ok(candidates.includes('Clevatess'));
  });

  it('includes the english title and deduplicates', () => {
    const candidates = buildSearchCandidates(
      makeMedia('Otome Kaijuu Caramelise', 'Otome Kaijuu Caramelise')
    );
    assert.deepEqual(candidates, ['Otome Kaijuu Caramelise']);
  });

  it('handles missing titles', () => {
    assert.deepEqual(buildSearchCandidates(makeMedia(null, null)), []);
  });
});

describe('pickTvSearchResult', () => {
  const result = (
    id: number,
    original_language: string,
    genre_ids: number[],
    name = `Result ${id}`,
    first_air_date = '2026-01-01'
  ) => ({
    id,
    original_language,
    genre_ids,
    name,
    original_name: name,
    first_air_date,
  });

  it('prefers japanese animation results', () => {
    const picked = pickTvSearchResult([
      result(1, 'en', [16]),
      result(2, 'ja', [18]),
      result(3, 'ja', [16, 18]),
    ]);
    assert.equal(picked?.id, 3);
  });

  it('falls back to any japanese result', () => {
    const picked = pickTvSearchResult([
      result(1, 'en', [16]),
      result(2, 'ja', [18]),
    ]);
    assert.equal(picked?.id, 2);
  });

  it('returns undefined without japanese results', () => {
    assert.equal(pickTvSearchResult([result(1, 'en', [16])]), undefined);
  });

  it('requires a strong title match for anime fallback searches', () => {
    const picked = pickTvSearchResult(
      [
        result(1, 'ja', [16], 'Unrelated Anime'),
        result(2, 'ja', [16], 'Target Anime'),
      ],
      makeMedia('Target Anime', null, 2026)
    );

    assert.equal(picked?.id, 2);
  });

  it('rejects a matching title from the wrong release year', () => {
    assert.equal(
      pickTvSearchResult(
        [result(1, 'ja', [16], 'Target Anime', '2025-01-01')],
        makeMedia('Target Anime', null, 2026)
      ),
      undefined
    );
  });

  it('allows sequels when TMDB reports the parent series year', () => {
    assert.equal(
      pickTvSearchResult(
        [result(1, 'ja', [16], 'Target Anime', '2020-01-01')],
        makeMedia('Target Anime 2nd Season', null, 2026)
      )?.id,
      1
    );
  });

  it('rejects ambiguous equally strong matches', () => {
    assert.equal(
      pickTvSearchResult(
        [
          result(1, 'ja', [16], 'Target Anime'),
          result(2, 'ja', [16], 'Target Anime'),
        ],
        makeMedia('Target Anime', null, 2026)
      ),
      undefined
    );
  });
});

describe('mapWithConcurrency', () => {
  it('keeps concurrent work below the configured limit', async () => {
    let active = 0;
    let maximumActive = 0;

    const results = await mapWithConcurrency(
      [1, 2, 3, 4, 5],
      2,
      async (value) => {
        active++;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return value * 2;
      }
    );

    assert.equal(maximumActive, 2);
    assert.deepEqual(results, [2, 4, 6, 8, 10]);
  });

  it('rejects invalid concurrency limits', async () => {
    await assert.rejects(
      mapWithConcurrency([1], 0, async (value) => value),
      /positive integer/
    );
  });
});

describe('Fribb mappings', () => {
  it('shares one in-flight mapping request', async () => {
    const cache = cacheManager.getCache('anilist').data;
    cache.flushAll();
    const get = mock.method(axios, 'get', async () => ({
      data: [
        {
          anilist_id: 1,
          mal_id: 100,
          themoviedb_id: { tv: 10 },
          season: { tmdb: 1 },
          type: 'TV',
        },
      ],
    }));

    try {
      const results = await Promise.all([
        getMalIdFromTmdb(10),
        getMalIdFromTmdb(10),
      ]);

      assert.deepEqual(results, [100, 100]);
      assert.equal(get.mock.calls.length, 1);
    } finally {
      cache.flushAll();
    }
  });

  it('keeps the last good mapping after an empty refresh', async () => {
    const cache = cacheManager.getCache('anilist').data;
    cache.flushAll();
    let now = Date.now();
    mock.method(Date, 'now', () => now);
    let requestCount = 0;
    const get = mock.method(axios, 'get', async () => ({
      data:
        requestCount++ === 0
          ? [
              {
                anilist_id: 1,
                mal_id: 100,
                themoviedb_id: { tv: 10 },
                season: { tmdb: 1 },
                type: 'TV',
              },
            ]
          : [],
    }));

    try {
      assert.equal(await getMalIdFromTmdb(10), 100);
      now += 86400001;
      assert.equal(await getMalIdFromTmdb(10), 100);
      assert.equal(get.mock.callCount(), 2);
    } finally {
      cache.flushAll();
    }
  });
});

describe('pickCanonicalMalId', () => {
  it('prefers the earliest season', () => {
    assert.equal(
      pickCanonicalMalId([
        { malId: 25777, tmdbSeason: 2 },
        { malId: 16498, tmdbSeason: 1 },
        { malId: 99147, tmdbSeason: 3 },
      ]),
      16498
    );
  });

  it('breaks season ties by lowest mal id', () => {
    assert.equal(
      pickCanonicalMalId([
        { malId: 500, tmdbSeason: 1 },
        { malId: 100, tmdbSeason: 1 },
      ]),
      100
    );
  });

  it('treats missing season as last', () => {
    assert.equal(
      pickCanonicalMalId([{ malId: 900 }, { malId: 800, tmdbSeason: 1 }]),
      800
    );
  });

  it('prefers the base TV series over season-0 recap movies', () => {
    // Real Attack on Titan (TMDB 1429) shape: a season-0 recap movie shares
    // the show id but should never win over the base TV series.
    assert.equal(
      pickCanonicalMalId([
        { malId: 36702, tmdbSeason: 0, isTv: false },
        { malId: 16498, tmdbSeason: 1, isTv: true },
        { malId: 25777, tmdbSeason: 2, isTv: true },
      ]),
      16498
    );
  });

  it('prefers TV type when seasons tie', () => {
    assert.equal(
      pickCanonicalMalId([
        { malId: 100, tmdbSeason: 1, isTv: false },
        { malId: 200, tmdbSeason: 1, isTv: true },
      ]),
      200
    );
  });

  it('returns null for no entries', () => {
    assert.equal(pickCanonicalMalId([]), null);
  });
});

describe('dedupeByTmdbId', () => {
  it('keeps the first entry per tmdb id (split-cours)', () => {
    const items = dedupeByTmdbId([
      { anilistId: 16498, tmdbId: 1429, title: 'Attack on Titan' },
      { anilistId: 20958, tmdbId: 1429, title: 'Attack on Titan S2' },
      { anilistId: 21460, tmdbId: 62564, title: 'Mob Psycho 100' },
    ]);
    assert.deepEqual(
      items.map((item) => item.anilistId),
      [16498, 21460]
    );
  });
});
