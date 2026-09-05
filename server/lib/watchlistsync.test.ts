import type { PlexWatchlistItem } from '@server/api/plextv';
import PlexTvAPI from '@server/api/plextv';
import TheMovieDb from '@server/api/themoviedb';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import {
  DuplicateMediaRequestError,
  MediaRequest,
  NoSeasonsAvailableError,
  QuotaRestrictedError,
} from '@server/entity/MediaRequest';
import SeasonRequest from '@server/entity/SeasonRequest';
import { User } from '@server/entity/User';
import { UserSettings } from '@server/entity/UserSettings';
import { WatchlistSyncEntry } from '@server/entity/WatchlistSyncEntry';
import { WatchlistSyncEntrySeason } from '@server/entity/WatchlistSyncEntrySeason';
import { Permission } from '@server/lib/permissions';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

const WATCHLISTED_AT = 1700000000;

let watchlistItems: PlexWatchlistItem[] = [];
let watchlistedAt = new Map<string, number | null>();
let userStateCalls: string[] = [];
let tmdbSeasons: number[] = [];

Object.defineProperty(PlexTvAPI.prototype, 'getWatchlist', {
  get() {
    return async () => ({
      offset: 0,
      size: 20,
      totalSize: watchlistItems.length,
      items: watchlistItems,
    });
  },
  set() {},
  configurable: true,
});

Object.defineProperty(PlexTvAPI.prototype, 'getWatchlistedAt', {
  get() {
    return async (ratingKey: string) => {
      userStateCalls.push(ratingKey);
      return watchlistedAt.has(ratingKey)
        ? watchlistedAt.get(ratingKey)
        : WATCHLISTED_AT;
    };
  },
  set() {},
  configurable: true,
});

Object.defineProperty(TheMovieDb.prototype, 'getTvShow', {
  get() {
    return async ({ tvId }: { tvId: number }) => ({
      id: tvId,
      seasons: tmdbSeasons.map((season_number) => ({ season_number })),
    });
  },
  set() {},
  configurable: true,
});

type RequestCall = {
  mediaId: number;
  mediaType: MediaType;
  seasons?: number[] | 'all';
};

let requestCalls: RequestCall[] = [];
let requestError: Error | null = null;

Object.defineProperty(MediaRequest, 'request', {
  value: async (body: RequestCall) => {
    requestCalls.push({
      mediaId: body.mediaId,
      mediaType: body.mediaType,
      seasons: body.seasons,
    });

    if (requestError) {
      throw requestError;
    }

    return {} as MediaRequest;
  },
  writable: true,
  configurable: true,
});

import watchlistSync from '@server/lib/watchlistsync';

setupTestDb();

async function configureSyncUser(userId = 1): Promise<User> {
  const userRepository = getRepository(User);
  const user = await userRepository.findOneOrFail({ where: { id: userId } });

  user.plexToken = 'test-plex-token';
  user.permissions = Permission.AUTO_REQUEST;
  await userRepository.save(user);

  await getRepository(UserSettings).save(
    new UserSettings({
      user,
      watchlistSyncMovies: true,
      watchlistSyncTv: true,
    })
  );

  return user;
}

async function seedMedia(
  tmdbId: number,
  mediaType: MediaType,
  status: MediaStatus
): Promise<Media> {
  return getRepository(Media).save(
    new Media({
      tmdbId,
      mediaType,
      status,
      status4k: MediaStatus.UNKNOWN,
    })
  );
}

async function seedEntry(
  user: User,
  tmdbId: number,
  mediaType: MediaType,
  stamp: number,
  seasons: number[] = []
): Promise<void> {
  await getRepository(WatchlistSyncEntry).save(
    new WatchlistSyncEntry({
      requestedBy: user,
      tmdbId,
      mediaType,
      watchlistedAt: stamp,
      seasons: seasons.map(
        (seasonNumber) => new WatchlistSyncEntrySeason({ seasonNumber })
      ),
    })
  );
}

async function seedRequest({
  user,
  tmdbId,
  mediaType,
  createdAt,
  seasons = [],
  isAutoRequest = true,
}: {
  user: User;
  tmdbId: number;
  mediaType: MediaType;
  createdAt: number;
  seasons?: number[];
  isAutoRequest?: boolean;
}): Promise<void> {
  const media =
    (await getRepository(Media).findOne({ where: { tmdbId, mediaType } })) ??
    (await seedMedia(tmdbId, mediaType, MediaStatus.DELETED));

  await getRepository(MediaRequest).save(
    new MediaRequest({
      type: mediaType,
      status: MediaRequestStatus.COMPLETED,
      media,
      requestedBy: user,
      is4k: false,
      isAutoRequest,
      createdAt: new Date(createdAt * 1000),
      seasons: seasons.map(
        (seasonNumber) => new SeasonRequest({ seasonNumber })
      ),
    })
  );
}

function getEntry(
  tmdbId: number,
  mediaType: MediaType,
  userId = 1
): Promise<WatchlistSyncEntry | null> {
  return getRepository(WatchlistSyncEntry).findOne({
    where: { requestedBy: { id: userId }, tmdbId, mediaType },
  });
}

function movieItem(tmdbId: number, title: string): PlexWatchlistItem {
  return { ratingKey: `rk-${tmdbId}`, tmdbId, title, type: 'movie' };
}

function showItem(tmdbId: number, title: string): PlexWatchlistItem {
  return {
    ratingKey: `rk-${tmdbId}`,
    tmdbId,
    tvdbId: tmdbId * 1000,
    title,
    type: 'show',
  };
}

function requestedIds(): string[] {
  return requestCalls.map((c) => `${c.mediaType}:${c.mediaId}`);
}

beforeEach(() => {
  requestCalls = [];
  watchlistItems = [];
  watchlistedAt = new Map();
  userStateCalls = [];
  tmdbSeasons = [0, 1, 2, 3];
  requestError = null;
});

describe('WatchlistSync status gating', () => {
  it('re-requests DELETED watchlist items and skips non-requestable ones', async () => {
    await configureSyncUser();

    await seedMedia(100, MediaType.MOVIE, MediaStatus.DELETED);
    await seedMedia(101, MediaType.MOVIE, MediaStatus.UNKNOWN);
    await seedMedia(102, MediaType.MOVIE, MediaStatus.AVAILABLE);
    await seedMedia(103, MediaType.MOVIE, MediaStatus.BLOCKLISTED);
    await seedMedia(200, MediaType.TV, MediaStatus.DELETED);
    await seedMedia(201, MediaType.TV, MediaStatus.AVAILABLE);

    watchlistItems = [
      movieItem(100, 'Deleted Movie'),
      movieItem(101, 'Unknown Movie'),
      movieItem(102, 'Available Movie'),
      movieItem(103, 'Blocklisted Movie'),
      showItem(200, 'Deleted Show'),
      showItem(201, 'Available Show'),
    ];

    await watchlistSync.syncWatchlist();

    const requested = new Set(requestedIds());

    assert.strictEqual(
      requestedIds().length,
      requested.size,
      'Each item should be requested exactly once'
    );
    assert.ok(requested.has(`${MediaType.MOVIE}:100`));
    assert.ok(requested.has(`${MediaType.MOVIE}:101`));
    assert.ok(!requested.has(`${MediaType.MOVIE}:102`));
    assert.ok(!requested.has(`${MediaType.MOVIE}:103`));
    assert.ok(requested.has(`${MediaType.TV}:200`));
    assert.ok(!requested.has(`${MediaType.TV}:201`));
  });

  it('does not look up watchlist state for items the status filter drops', async () => {
    await configureSyncUser();

    await seedMedia(102, MediaType.MOVIE, MediaStatus.AVAILABLE);

    watchlistItems = [movieItem(101, 'New Movie'), movieItem(102, 'Available')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(userStateCalls, ['rk-101']);
  });
});

describe('WatchlistSync movie entries', () => {
  it('requests a new entry and records it', async () => {
    await configureSyncUser();
    watchlistItems = [movieItem(100, 'New Movie')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestedIds(), [`${MediaType.MOVIE}:100`]);

    const entry = await getEntry(100, MediaType.MOVIE);
    assert.strictEqual(entry?.watchlistedAt, WATCHLISTED_AT);
  });

  it('skips an entry that has already been acted on', async () => {
    const user = await configureSyncUser();
    await seedEntry(user, 100, MediaType.MOVIE, WATCHLISTED_AT);

    watchlistItems = [movieItem(100, 'Tracked Movie')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestCalls, []);
  });

  it('requests again when the title is re-added', async () => {
    const user = await configureSyncUser();
    await seedEntry(user, 100, MediaType.MOVIE, WATCHLISTED_AT - 5000);

    watchlistItems = [movieItem(100, 'Re-added Movie')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestedIds(), [`${MediaType.MOVIE}:100`]);

    const entry = await getEntry(100, MediaType.MOVIE);
    assert.strictEqual(entry?.watchlistedAt, WATCHLISTED_AT);
  });

  it('ignores request history when the title was re-added', async () => {
    const user = await configureSyncUser();
    await seedEntry(user, 100, MediaType.MOVIE, WATCHLISTED_AT - 5000);
    await seedRequest({
      user,
      tmdbId: 100,
      mediaType: MediaType.MOVIE,
      createdAt: WATCHLISTED_AT + 60,
    });

    watchlistItems = [movieItem(100, 'Re-added Movie')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestedIds(), [`${MediaType.MOVIE}:100`]);

    const entry = await getEntry(100, MediaType.MOVIE);
    assert.strictEqual(entry?.watchlistedAt, WATCHLISTED_AT);
  });

  it('records the entry when a request already exists', async () => {
    await configureSyncUser();
    requestError = new DuplicateMediaRequestError('duplicate');

    watchlistItems = [movieItem(100, 'Duplicate Movie')];

    await watchlistSync.syncWatchlist();

    const entry = await getEntry(100, MediaType.MOVIE);
    assert.strictEqual(entry?.watchlistedAt, WATCHLISTED_AT);
  });

  it('retries on the next sync when the quota is exceeded', async () => {
    await configureSyncUser();
    requestError = new QuotaRestrictedError('quota');

    watchlistItems = [movieItem(100, 'Quota Movie')];

    await watchlistSync.syncWatchlist();

    assert.strictEqual(await getEntry(100, MediaType.MOVIE), null);

    requestError = null;
    await watchlistSync.syncWatchlist();

    assert.strictEqual(requestCalls.length, 2);
  });

  it('skips items with no watchlisted date', async () => {
    await configureSyncUser();
    watchlistedAt.set('rk-100', null);

    watchlistItems = [movieItem(100, 'Undated Movie')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestCalls, []);
    assert.strictEqual(await getEntry(100, MediaType.MOVIE), null);
  });
});

describe('WatchlistSync show entries', () => {
  it('requests every season except specials and records them', async () => {
    await configureSyncUser();
    watchlistItems = [showItem(200, 'New Show')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestCalls[0]?.seasons, [1, 2, 3]);

    const entry = await getEntry(200, MediaType.TV);
    assert.deepStrictEqual(
      entry?.seasons.map((s) => s.seasonNumber).sort((a, b) => a - b),
      [1, 2, 3]
    );
  });

  it('requests only seasons added since the entry was acted on', async () => {
    const user = await configureSyncUser();
    await seedEntry(user, 200, MediaType.TV, WATCHLISTED_AT, [1, 2, 3]);
    tmdbSeasons = [0, 1, 2, 3, 4];

    watchlistItems = [showItem(200, 'Ongoing Show')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestCalls[0]?.seasons, [4]);

    const entry = await getEntry(200, MediaType.TV);
    assert.deepStrictEqual(
      entry?.seasons.map((s) => s.seasonNumber).sort((a, b) => a - b),
      [1, 2, 3, 4]
    );
  });

  it('does not request when every season has been acted on', async () => {
    const user = await configureSyncUser();
    await seedEntry(user, 200, MediaType.TV, WATCHLISTED_AT, [1, 2, 3]);

    watchlistItems = [showItem(200, 'Handled Show')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestCalls, []);
  });

  it('requests all seasons again when the show is re-added', async () => {
    const user = await configureSyncUser();
    await seedEntry(user, 200, MediaType.TV, WATCHLISTED_AT - 5000, [1, 2, 3]);

    watchlistItems = [showItem(200, 'Re-added Show')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestCalls[0]?.seasons, [1, 2, 3]);

    const entry = await getEntry(200, MediaType.TV);
    assert.strictEqual(entry?.watchlistedAt, WATCHLISTED_AT);
    assert.deepStrictEqual(
      entry?.seasons.map((s) => s.seasonNumber).sort((a, b) => a - b),
      [1, 2, 3]
    );
  });

  it('ignores request history when the show was re-added', async () => {
    const user = await configureSyncUser();
    await seedEntry(user, 200, MediaType.TV, WATCHLISTED_AT - 5000, [1, 2, 3]);
    await seedRequest({
      user,
      tmdbId: 200,
      mediaType: MediaType.TV,
      createdAt: WATCHLISTED_AT + 60,
      seasons: [1, 2, 3],
    });

    watchlistItems = [showItem(200, 'Re-added Show')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestCalls[0]?.seasons, [1, 2, 3]);

    const entry = await getEntry(200, MediaType.TV);
    assert.strictEqual(entry?.watchlistedAt, WATCHLISTED_AT);
  });

  it('drops recorded seasons that no longer exist on the show', async () => {
    const user = await configureSyncUser();
    await seedEntry(user, 200, MediaType.TV, WATCHLISTED_AT - 5000, [1, 2, 3]);
    tmdbSeasons = [0, 1];

    watchlistItems = [showItem(200, 'Shrunk Show')];

    await watchlistSync.syncWatchlist();

    const entry = await getEntry(200, MediaType.TV);
    assert.deepStrictEqual(
      entry?.seasons.map((s) => s.seasonNumber).sort((a, b) => a - b),
      [1]
    );
  });

  it('records seasons that were already covered elsewhere', async () => {
    await configureSyncUser();
    requestError = new NoSeasonsAvailableError('none');

    watchlistItems = [showItem(200, 'Covered Show')];

    await watchlistSync.syncWatchlist();

    const entry = await getEntry(200, MediaType.TV);
    assert.deepStrictEqual(
      entry?.seasons.map((s) => s.seasonNumber).sort((a, b) => a - b),
      [1, 2, 3]
    );
  });
});

describe('WatchlistSync seeding from request history', () => {
  it('records an entry instead of requesting when sync already handled it', async () => {
    const user = await configureSyncUser();
    await seedRequest({
      user,
      tmdbId: 100,
      mediaType: MediaType.MOVIE,
      createdAt: WATCHLISTED_AT + 60,
    });

    watchlistItems = [movieItem(100, 'Previously Handled')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestCalls, []);

    const entry = await getEntry(100, MediaType.MOVIE);
    assert.strictEqual(entry?.watchlistedAt, WATCHLISTED_AT);
  });

  it('requests when the earlier request predates the watchlist add', async () => {
    const user = await configureSyncUser();
    await seedRequest({
      user,
      tmdbId: 100,
      mediaType: MediaType.MOVIE,
      createdAt: WATCHLISTED_AT - 5000,
    });

    watchlistItems = [movieItem(100, 'Re-added Since')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestedIds(), [`${MediaType.MOVIE}:100`]);
  });

  it('ignores manual requests when seeding', async () => {
    const user = await configureSyncUser();
    await seedRequest({
      user,
      tmdbId: 100,
      mediaType: MediaType.MOVIE,
      createdAt: WATCHLISTED_AT + 60,
      isAutoRequest: false,
    });

    watchlistItems = [movieItem(100, 'Manually Requested')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestedIds(), [`${MediaType.MOVIE}:100`]);
  });

  it('seeds handled seasons from the earlier request', async () => {
    const user = await configureSyncUser();
    await seedRequest({
      user,
      tmdbId: 200,
      mediaType: MediaType.TV,
      createdAt: WATCHLISTED_AT + 60,
      seasons: [1, 2],
    });

    watchlistItems = [showItem(200, 'Partly Handled Show')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestCalls[0]?.seasons, [3]);
  });
});

describe('WatchlistSync users', () => {
  it('tracks the same title separately for each user', async () => {
    const admin = await configureSyncUser(1);
    await configureSyncUser(2);
    await seedEntry(admin, 100, MediaType.MOVIE, WATCHLISTED_AT);

    watchlistItems = [movieItem(100, 'Shared Movie')];

    await watchlistSync.syncWatchlist();

    assert.deepStrictEqual(requestedIds(), [`${MediaType.MOVIE}:100`]);
    assert.ok(await getEntry(100, MediaType.MOVIE, 2));
  });
});
