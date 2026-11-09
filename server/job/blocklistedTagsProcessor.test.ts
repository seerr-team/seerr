import TheMovieDb from '@server/api/themoviedb';
import { IssueType } from '@server/constants/issue';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import Issue from '@server/entity/Issue';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import { Watchlist } from '@server/entity/Watchlist';
import blocklistedTagsProcessor from '@server/job/blocklistedTagsProcessor';
import { getSettings } from '@server/lib/settings';
import { IssueSubscriber } from '@server/subscriber/IssueSubscriber';
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
let beforeDiscover: (keywords: string) => void | Promise<void> = () =>
  undefined;

function stubDiscover(
  method: 'getDiscoverMovies' | 'getDiscoverTv',
  matches: () => Record<string, number[]>
) {
  Object.defineProperty(TheMovieDb.prototype, method, {
    get() {
      return async ({ keywords }: { keywords: string }) => {
        await beforeDiscover(keywords);

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

mock.method(
  IssueSubscriber.prototype as unknown as {
    sendIssueNotification: () => Promise<void>;
  },
  'sendIssueNotification',
  async () => undefined
);

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

async function seedRequest(
  media: Media,
  status: MediaRequestStatus,
  is4k = false
) {
  const requestedBy = await getRepository(User).findOneOrFail({
    where: { id: 1 },
  });

  return getRepository(MediaRequest).save(
    new MediaRequest({
      type: media.mediaType,
      status,
      media,
      requestedBy,
      is4k,
      seasons: [],
    })
  );
}

function findUser() {
  return getRepository(User).findOneOrFail({ where: { id: 1 } });
}

async function assertStaleEntryKeepsMedia(
  seedDependent: (media: Media) => Promise<() => Promise<boolean>>,
  mediaType = MediaType.MOVIE
) {
  const media = await seedTagEntry(TMDB_ID, mediaType);
  const dependentExists = await seedDependent(media);

  await blocklistedTagsProcessor.run();

  const saved = await findMedia(TMDB_ID, mediaType);
  assert.strictEqual(saved?.id, media.id);
  assert.strictEqual(saved?.status, MediaStatus.UNKNOWN);
  assert.strictEqual(saved?.status4k, MediaStatus.UNKNOWN);
  assert.strictEqual(await findEntry(TMDB_ID, mediaType), null);
  assert.ok(await dependentExists());
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

  it('keeps the tags of a matched entry when another keyword fails', async () => {
    const tags = `,${KEYWORD},${OTHER_KEYWORD},`;
    getSettings().main.blocklistedTags = `${KEYWORD},${OTHER_KEYWORD}`;
    await seedEntry(tags);
    movieMatches = { [KEYWORD]: [TMDB_ID] };
    beforeDiscover = (keywords) => {
      if (keywords === OTHER_KEYWORD) {
        throw new Error('TMDB unavailable');
      }
    };

    await blocklistedTagsProcessor.run();

    assert.strictEqual((await findEntry())?.blocklistedTags, tags);
  });

  it('removes the entry of a blocklisted title with a pending request', async () => {
    const media = await seedTagEntry();
    const request = await seedRequest(media, MediaRequestStatus.PENDING);
    movieMatches = { [KEYWORD]: [TMDB_ID] };

    await blocklistedTagsProcessor.run();

    const saved = await getRepository(Media).findOneOrFail({
      where: { id: media.id },
      relations: { requests: true },
    });
    assert.strictEqual(saved.status, MediaStatus.PENDING);
    assert.strictEqual(saved.status4k, MediaStatus.UNKNOWN);
    assert.deepStrictEqual(
      saved.requests.map((r) => r.id),
      [request.id]
    );
    assert.strictEqual(await findEntry(), null);
  });

  it('removes the entry of a matched title that a scan makes available mid-run', async () => {
    const media = await seedTagEntry();
    movieMatches = { [KEYWORD]: [TMDB_ID] };

    let discoverCalls = 0;
    beforeDiscover = async () => {
      discoverCalls++;

      if (discoverCalls === 2) {
        await getRepository(Media).update(media.id, {
          status: MediaStatus.AVAILABLE,
        });
      }
    };

    await blocklistedTagsProcessor.run();

    const saved = await findMedia();
    assert.strictEqual(saved?.id, media.id);
    assert.strictEqual(saved?.status, MediaStatus.AVAILABLE);
    assert.strictEqual(await findEntry(), null);
  });

  it('creates the missing media of a tag entry that still matches', async () => {
    const { id: entryId } = await getRepository(Blocklist).save(
      new Blocklist({
        tmdbId: TMDB_ID,
        mediaType: MediaType.MOVIE,
        title: `Title ${TMDB_ID}`,
        blocklistedTags: `,${KEYWORD},`,
      })
    );
    movieMatches = { [KEYWORD]: [TMDB_ID] };

    await blocklistedTagsProcessor.run();

    const saved = await findMedia();
    assert.strictEqual(saved?.status, MediaStatus.BLOCKLISTED);
    assert.strictEqual(saved?.status4k, MediaStatus.BLOCKLISTED);

    const entry = await getRepository(Blocklist).findOneOrFail({
      where: { id: entryId },
      relations: { media: true },
    });
    assert.strictEqual(entry.media.id, saved?.id);
  });

  it('restores each format from its own requests with approved over pending', async () => {
    const media = await seedTagEntry(TMDB_ID, MediaType.TV);
    await seedRequest(media, MediaRequestStatus.PENDING);
    await seedRequest(media, MediaRequestStatus.APPROVED);
    await seedRequest(media, MediaRequestStatus.PENDING, true);
    // Inserting an approved request moves the media to PROCESSING
    await getRepository(Media).update(media.id, {
      status: MediaStatus.BLOCKLISTED,
      status4k: MediaStatus.BLOCKLISTED,
    });

    await blocklistedTagsProcessor.run();

    const saved = await findMedia(TMDB_ID, MediaType.TV);
    assert.strictEqual(saved?.status, MediaStatus.PROCESSING);
    assert.strictEqual(saved?.status4k, MediaStatus.PENDING);
    assert.strictEqual(await findEntry(TMDB_ID, MediaType.TV), null);
  });

  it('keeps the media of a stale entry with a completed request', async () => {
    const media = await seedTagEntry();
    const request = await seedRequest(media, MediaRequestStatus.COMPLETED);

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

  it('keeps the media of a stale entry with only an issue', async () => {
    await assertStaleEntryKeepsMedia(async (media) => {
      const { id } = await getRepository(Issue).save(
        new Issue({
          issueType: IssueType.OTHER,
          media,
          createdBy: await findUser(),
        })
      );

      return () => getRepository(Issue).exist({ where: { id } });
    });
  });

  it('keeps the media of a stale entry with only a watchlist entry', async () => {
    await assertStaleEntryKeepsMedia(async (media) => {
      const { id } = await getRepository(Watchlist).save(
        new Watchlist({
          mediaType: MediaType.MOVIE,
          tmdbId: TMDB_ID,
          title: `Title ${TMDB_ID}`,
          requestedBy: await findUser(),
          media,
        })
      );

      return () => getRepository(Watchlist).exist({ where: { id } });
    });
  });

  it('keeps the media of a stale entry with only a season', async () => {
    await assertStaleEntryKeepsMedia(async (media) => {
      const { id } = await getRepository(Season).save(
        new Season({ seasonNumber: 1, media: Promise.resolve(media) })
      );

      return () => getRepository(Season).exist({ where: { id } });
    }, MediaType.TV);
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

  it('rolls back the run when cancelled on the last discover call', async () => {
    await seedEntry(`,${OTHER_KEYWORD},`);
    movieMatches = { [KEYWORD]: [TMDB_ID, OTHER_TMDB_ID] };

    let discoverCalls = 0;
    beforeDiscover = () => {
      discoverCalls++;

      if (discoverCalls === 2) {
        blocklistedTagsProcessor.cancel();
      }
    };

    await blocklistedTagsProcessor.run();

    assert.strictEqual(
      (await findEntry())?.blocklistedTags,
      `,${OTHER_KEYWORD},`
    );
    assert.strictEqual(await findEntry(OTHER_TMDB_ID), null);
    assert.strictEqual(await findMedia(OTHER_TMDB_ID), null);
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
