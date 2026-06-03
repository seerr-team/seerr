import type { PlexWatchlistItem } from '@server/api/plextv';
import PlexTvAPI from '@server/api/plextv';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { UserSettings } from '@server/entity/UserSettings';
import { Permission } from '@server/lib/permissions';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

let watchlistItems: PlexWatchlistItem[] = [];

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

let requestCalls: { mediaId: number; mediaType: MediaType }[] = [];

Object.defineProperty(MediaRequest, 'request', {
  value: async (body: { mediaId: number; mediaType: MediaType }) => {
    requestCalls.push({ mediaId: body.mediaId, mediaType: body.mediaType });
    return {} as MediaRequest;
  },
  writable: true,
  configurable: true,
});

import watchlistSync from '@server/lib/watchlistsync';

setupTestDb();

async function configureSyncUser(): Promise<User> {
  const userRepository = getRepository(User);
  const admin = await userRepository.findOneOrFail({ where: { id: 1 } });

  admin.plexToken = 'test-plex-token';
  admin.permissions = Permission.AUTO_REQUEST;
  await userRepository.save(admin);

  const userSettingsRepository = getRepository(UserSettings);
  await userSettingsRepository.save(
    new UserSettings({
      user: admin,
      watchlistSyncMovies: true,
      watchlistSyncTv: true,
    })
  );

  return admin;
}

async function seedMedia(
  tmdbId: number,
  mediaType: MediaType,
  status: MediaStatus
): Promise<void> {
  const mediaRepository = getRepository(Media);
  await mediaRepository.save(
    new Media({
      tmdbId,
      mediaType,
      status,
      status4k: MediaStatus.UNKNOWN,
    })
  );
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

describe('WatchlistSync re-request gating', () => {
  beforeEach(() => {
    requestCalls = [];
    watchlistItems = [];
  });

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

    const requestedArray = requestCalls.map(
      (c) => `${c.mediaType}:${c.mediaId}`
    );
    const requested = new Set(requestedArray);

    assert.strictEqual(
      requestedArray.length,
      requested.size,
      'Each item should be requested exactly once'
    );

    assert.ok(
      requested.has(`${MediaType.MOVIE}:100`),
      'DELETED movie on the watchlist should be re-requested'
    );

    assert.ok(
      requested.has(`${MediaType.MOVIE}:101`),
      'UNKNOWN movie should be requested'
    );
    assert.ok(
      !requested.has(`${MediaType.MOVIE}:102`),
      'AVAILABLE movie should NOT be requested'
    );
    assert.ok(
      !requested.has(`${MediaType.MOVIE}:103`),
      'BLOCKLISTED movie should NOT be requested'
    );

    assert.ok(
      requested.has(`${MediaType.TV}:200`),
      'DELETED show should be re-requested'
    );
    assert.ok(
      !requested.has(`${MediaType.TV}:201`),
      'AVAILABLE show should NOT be requested'
    );
  });

  it('re-requests DELETED watchlist items even when a stale auto-request exists', async () => {
    const user = await configureSyncUser();

    await seedMedia(100, MediaType.MOVIE, MediaStatus.DELETED);

    const media = await getRepository(Media).findOneOrFail({
      where: { tmdbId: 100, mediaType: MediaType.MOVIE },
    });

    await getRepository(MediaRequest).save(
      new MediaRequest({
        type: MediaType.MOVIE,
        status: MediaRequestStatus.COMPLETED,
        media,
        requestedBy: user,
        is4k: false,
        isAutoRequest: true,
      })
    );

    watchlistItems = [movieItem(100, 'Deleted Movie')];

    await watchlistSync.syncWatchlist();

    const calls = requestCalls.filter(
      (c) => c.mediaType === MediaType.MOVIE && c.mediaId === 100
    );

    assert.strictEqual(
      calls.length,
      1,
      'DELETED movie should be re-requested even when a stale auto-request exists'
    );
  });
});
