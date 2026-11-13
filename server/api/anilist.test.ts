import type { AniListMedia } from '@server/api/anilist';
import {
  buildSearchCandidates,
  dedupeByTmdbId,
  extractTmdbTvMapping,
  getCurrentAnimeSeason,
  pickCanonicalMalId,
  pickTvSearchResult,
} from '@server/api/anilist';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const makeMedia = (
  romaji: string | null,
  english: string | null = null
): AniListMedia => ({
  id: 1,
  idMal: null,
  title: { romaji, english },
  format: 'TV',
  episodes: null,
  startDate: { year: null, month: null, day: null },
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
    genre_ids: number[]
  ) => ({ id, original_language, genre_ids });

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
