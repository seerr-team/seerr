import TheMovieDb from '@server/api/themoviedb';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import blocklistedTagsProcessor from '@server/job/blocklistedTagsProcessor';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

const KEYWORD = '445';
const OTHER_KEYWORD = '256466';
const TMDB_ID = 1001;
const OTHER_TMDB_ID = 1002;

let movieMatches: Record<string, number[]> = {};
let tvMatches: Record<string, number[]> = {};
let invalidKeywords: string[] = [];
let beforeDiscover: () => void = () => undefined;

function stubDiscover(
  method: 'getDiscoverMovies' | 'getDiscoverTv',
  matches: () => Record<string, number[]>
) {
  Object.defineProperty(TheMovieDb.prototype, method, {
    get() {
      return async ({ keywords }: { keywords: string }) => {
        beforeDiscover();

        const ids = matches()[keywords] ?? [];

        return {
          page: 1,
          total_pages: 1,
          total_results: ids.length,
          results: ids.map((id) => ({
            id,
            title: `Title ${id}`,
            name: `Title ${id}`,
          })),
        };
      };
    },
    set() {},
    configurable: true,
  });
}

stubDiscover('getDiscoverMovies', () => movieMatches);
stubDiscover('getDiscoverTv', () => tvMatches);

mock.method(
  TheMovieDb.prototype,
  'getKeywordDetails',
  async ({ keywordId }: { keywordId: number }) =>
    invalidKeywords.includes(String(keywordId))
      ? null
      : { id: keywordId, name: `Keyword ${keywordId}` }
);

mock.method(MediaRequest, 'sendNotification', async () => undefined);

setupTestDb();

beforeEach(() => {
  movieMatches = {};
  tvMatches = {};
  invalidKeywords = [];
  beforeDiscover = () => undefined;

  const settings = getSettings();
  settings.main.blocklistedTags = KEYWORD;
  settings.main.blocklistedTagsLimit = 1;
});

function findMedia(tmdbId = TMDB_ID, mediaType = MediaType.MOVIE) {
  return getRepository(Media).findOne({ where: { tmdbId, mediaType } });
}

function findEntry(tmdbId = TMDB_ID, mediaType = MediaType.MOVIE) {
  return getRepository(Blocklist).findOne({ where: { tmdbId, mediaType } });
}

async function seedEntry(
  blocklistedTags: string | undefined,
  tmdbId = TMDB_ID,
  mediaType = MediaType.MOVIE
) {
  await Blocklist.addToBlocklist({
    blocklistRequest: {
      mediaType,
      title: `Title ${tmdbId}`,
      tmdbId,
      blocklistedTags,
    },
  });

  return getRepository(Media).findOneOrFail({ where: { tmdbId, mediaType } });
}

function seedTagEntry(tmdbId = TMDB_ID, mediaType = MediaType.MOVIE) {
  return seedEntry(`,${KEYWORD},`, tmdbId, mediaType);
}

async function seedRequest(media: Media, status: MediaRequestStatus) {
  const requestedBy = await getRepository(User).findOneOrFail({
    where: { id: 1 },
  });

  return getRepository(MediaRequest).save(
    new MediaRequest({
      type: MediaType.MOVIE,
      status,
      media,
      requestedBy,
      is4k: false,
    })
  );
}

describe('BlocklistedTagProcessor', () => {
  it('leaves an available movie and its request alone across runs', async () => {
    const mediaAddedAt = new Date('2024-01-02T03:04:05.000Z');
    const media = await getRepository(Media).save(
      new Media({
        tmdbId: TMDB_ID,
        mediaType: MediaType.MOVIE,
        status: MediaStatus.AVAILABLE,
        status4k: MediaStatus.UNKNOWN,
        mediaAddedAt,
      })
    );
    const request = await seedRequest(media, MediaRequestStatus.APPROVED);
    movieMatches = { [KEYWORD]: [TMDB_ID] };

    await blocklistedTagsProcessor.run();
    await blocklistedTagsProcessor.run();

    const saved = await getRepository(Media).findOneOrFail({
      where: { tmdbId: TMDB_ID, mediaType: MediaType.MOVIE },
      relations: { requests: true },
    });
    assert.strictEqual(saved.id, media.id);
    assert.strictEqual(saved.status, MediaStatus.AVAILABLE);
    assert.strictEqual(saved.mediaAddedAt.getTime(), mediaAddedAt.getTime());
    assert.deepStrictEqual(
      saved.requests.map((r) => r.id),
      [request.id]
    );
    assert.strictEqual(await findEntry(), null);
  });

  it('keeps a placeholder that still matches and replaces its tags', async () => {
    getSettings().main.blocklistedTags = `${KEYWORD},${OTHER_KEYWORD}`;
    movieMatches = { [KEYWORD]: [TMDB_ID], [OTHER_KEYWORD]: [TMDB_ID] };

    await blocklistedTagsProcessor.run();

    const placeholder = await findMedia();
    assert.strictEqual(
      (await findEntry())?.blocklistedTags,
      `,${KEYWORD},${OTHER_KEYWORD},`
    );

    movieMatches = { [KEYWORD]: [TMDB_ID] };
    await blocklistedTagsProcessor.run();

    const saved = await findMedia();
    assert.ok(placeholder);
    assert.strictEqual(saved?.id, placeholder.id);
    assert.strictEqual(saved?.status, MediaStatus.BLOCKLISTED);
    assert.strictEqual((await findEntry())?.blocklistedTags, `,${KEYWORD},`);
  });

  it('removes a placeholder that no longer matches', async () => {
    await seedTagEntry();
    await seedTagEntry(TMDB_ID, MediaType.TV);
    tvMatches = { [KEYWORD]: [TMDB_ID] };

    await blocklistedTagsProcessor.run();

    assert.strictEqual(await findMedia(), null);
    assert.strictEqual(await findEntry(), null);
    assert.ok(await findMedia(TMDB_ID, MediaType.TV));
    assert.ok(await findEntry(TMDB_ID, MediaType.TV));
  });

  it('keeps existing entries when a discover query fails', async () => {
    const media = await seedTagEntry();
    beforeDiscover = () => {
      throw new Error('TMDB unavailable');
    };

    await blocklistedTagsProcessor.run();

    assert.strictEqual((await findMedia())?.id, media.id);
    assert.strictEqual((await findEntry())?.blocklistedTags, `,${KEYWORD},`);
  });

  it('keeps the media of a stale entry that has a request', async () => {
    const media = await seedTagEntry();
    const request = await seedRequest(media, MediaRequestStatus.PENDING);

    await blocklistedTagsProcessor.run();

    const saved = await getRepository(Media).findOneOrFail({
      where: { id: media.id },
      relations: { requests: true },
    });
    assert.strictEqual(saved.status, MediaStatus.UNKNOWN);
    assert.strictEqual(saved.status4k, MediaStatus.UNKNOWN);
    assert.deepStrictEqual(
      saved.requests.map((r) => r.id),
      [request.id]
    );
    assert.strictEqual(await findEntry(), null);
  });

  it('removes the entry of a placeholder that reached the library', async () => {
    const media = await seedTagEntry();
    await getRepository(Media).update(media.id, {
      status: MediaStatus.AVAILABLE,
    });
    movieMatches = { [KEYWORD]: [TMDB_ID] };

    await blocklistedTagsProcessor.run();

    const saved = await findMedia();
    assert.strictEqual(saved?.id, media.id);
    assert.strictEqual(saved?.status, MediaStatus.AVAILABLE);
    assert.strictEqual(saved?.status4k, MediaStatus.UNKNOWN);
    assert.strictEqual(await findEntry(), null);
  });

  it('clears tag entries but not manual ones when no tags are configured', async () => {
    getSettings().main.blocklistedTags = '';
    await seedTagEntry();
    const manual = await seedEntry(undefined, OTHER_TMDB_ID);

    await blocklistedTagsProcessor.run();

    assert.strictEqual(await findMedia(), null);
    assert.strictEqual(await findEntry(), null);
    assert.strictEqual((await findMedia(OTHER_TMDB_ID))?.id, manual.id);
    assert.strictEqual(
      (await findMedia(OTHER_TMDB_ID))?.status,
      MediaStatus.BLOCKLISTED
    );
    assert.strictEqual((await findEntry(OTHER_TMDB_ID))?.blocklistedTags, null);
  });

  it('clears entries for a keyword dropped as invalid', async (t) => {
    t.mock.method(getSettings(), 'save', async () => undefined);
    await seedTagEntry();
    invalidKeywords = [KEYWORD];

    await blocklistedTagsProcessor.run();

    assert.strictEqual(await findMedia(), null);
    assert.strictEqual(await findEntry(), null);
    assert.strictEqual(getSettings().main.blocklistedTags, '');
  });

  it('rolls back the whole run when cancelled', async () => {
    const media = await seedTagEntry();
    movieMatches = { [KEYWORD]: [OTHER_TMDB_ID] };
    beforeDiscover = () => blocklistedTagsProcessor.cancel();

    await blocklistedTagsProcessor.run();

    assert.strictEqual((await findMedia())?.id, media.id);
    assert.ok(await findEntry());
    assert.strictEqual(await findMedia(OTHER_TMDB_ID), null);
    assert.strictEqual(await findEntry(OTHER_TMDB_ID), null);
  });
});
