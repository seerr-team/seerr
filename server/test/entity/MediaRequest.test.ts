import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

import ExternalAPI from '@server/api/externalapi';
import type { TmdbMovieDetails } from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import {
  MediaRequest,
  RequestPermissionError,
} from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
mock.method(ExternalAPI.prototype as any, 'get', async () => stubMovie());
mock.method(MediaRequest, 'sendNotification', async () => undefined);

function stubMovie(tmdbId = 954234): TmdbMovieDetails {
  return {
    id: tmdbId,
    genres: [],
    original_language: 'en',
    external_ids: {},
    keywords: { results: [] },
    release_date: '2020-01-01',
    videos: { results: [{ type: 'Trailer' }] },
  } as unknown as TmdbMovieDetails;
}

setupTestDb();

describe('MediaRequest.request() retention resolution', () => {
  let priorRetention: ReturnType<typeof getSettings>['main']['mediaRetention'];

  before(() => {
    priorRetention = getSettings().main.mediaRetention;
  });

  beforeEach(() => {
    getSettings().main.mediaRetention = priorRetention;
  });

  async function getFriend(): Promise<User> {
    const userRepo = getRepository(User);
    return userRepo.findOneOrFail({ where: { email: 'friend@seerr.dev' } });
  }

  it('does not set a retention period when disabled for the media type', async () => {
    getSettings().main.mediaRetention = {
      movie: { enabled: false },
      tv: { enabled: false },
    };

    const friend = await getFriend();
    const request = await MediaRequest.request(
      { mediaType: MediaType.MOVIE, mediaId: 100001, is4k: false },
      friend
    );

    assert.strictEqual(request.retentionDays, null);
  });

  it('falls back to the default fallback ceiling with no explicit choice, no cap configured, and no KEEP_MEDIA', async () => {
    getSettings().main.mediaRetention = {
      movie: { enabled: true },
      tv: { enabled: false },
    };

    const friend = await getFriend();
    const request = await MediaRequest.request(
      { mediaType: MediaType.MOVIE, mediaId: 100002, is4k: false },
      friend
    );

    assert.strictEqual(request.retentionDays, 365);
  });

  it('falls back to indefinite with no explicit choice, no cap configured, and KEEP_MEDIA granted', async () => {
    getSettings().main.mediaRetention = {
      movie: { enabled: true },
      tv: { enabled: false },
    };

    const userRepo = getRepository(User);
    const friend = await getFriend();
    friend.permissions |= Permission.KEEP_MEDIA;
    await userRepo.save(friend);

    const request = await MediaRequest.request(
      { mediaType: MediaType.MOVIE, mediaId: 100003, is4k: false },
      friend
    );

    assert.strictEqual(request.retentionDays, null);
  });

  it('rejects an explicit indefinite choice without KEEP_MEDIA, even with no cap configured', async () => {
    getSettings().main.mediaRetention = {
      movie: { enabled: true },
      tv: { enabled: false },
    };

    const friend = await getFriend();
    await assert.rejects(
      MediaRequest.request(
        {
          mediaType: MediaType.MOVIE,
          mediaId: 100004,
          is4k: false,
          retentionDays: null,
        },
        friend
      ),
      RequestPermissionError
    );
  });

  it('lets a KEEP_MEDIA user explicitly choose indefinite even when a finite day cap is configured', async () => {
    getSettings().main.mediaRetention = {
      movie: { enabled: true, defaultDays: 30 },
      tv: { enabled: false },
    };

    const userRepo = getRepository(User);
    const friend = await getFriend();
    friend.permissions |= Permission.KEEP_MEDIA;
    await userRepo.save(friend);

    const request = await MediaRequest.request(
      {
        mediaType: MediaType.MOVIE,
        mediaId: 100005,
        is4k: false,
        retentionDays: null,
      },
      friend
    );

    assert.strictEqual(request.retentionDays, null);
  });

  it('rejects an explicit finite value beyond the fallback ceiling when no cap is configured and KEEP_MEDIA is absent', async () => {
    getSettings().main.mediaRetention = {
      movie: { enabled: true },
      tv: { enabled: false },
    };

    const friend = await getFriend();
    await assert.rejects(
      MediaRequest.request(
        {
          mediaType: MediaType.MOVIE,
          mediaId: 100006,
          is4k: false,
          retentionDays: 999999,
        },
        friend
      ),
      RequestPermissionError
    );
  });

  it('rejects an explicit finite value beyond a configured day cap', async () => {
    getSettings().main.mediaRetention = {
      movie: { enabled: true, defaultDays: 30 },
      tv: { enabled: false },
    };

    const friend = await getFriend();
    await assert.rejects(
      MediaRequest.request(
        {
          mediaType: MediaType.MOVIE,
          mediaId: 100007,
          is4k: false,
          retentionDays: 60,
        },
        friend
      ),
      RequestPermissionError
    );
  });

  it('accepts an explicit finite value within a configured day cap', async () => {
    getSettings().main.mediaRetention = {
      movie: { enabled: true, defaultDays: 30 },
      tv: { enabled: false },
    };

    const friend = await getFriend();
    const request = await MediaRequest.request(
      {
        mediaType: MediaType.MOVIE,
        mediaId: 100008,
        is4k: false,
        retentionDays: 14,
      },
      friend
    );

    assert.strictEqual(request.retentionDays, 14);
  });

  it('lets an admin grant indefinite retention on behalf of a user without KEEP_MEDIA', async () => {
    getSettings().main.mediaRetention = {
      movie: { enabled: true, defaultDays: 30 },
      tv: { enabled: false },
    };

    const userRepo = getRepository(User);
    const admin = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const friend = await getFriend();

    const request = await MediaRequest.request(
      {
        mediaType: MediaType.MOVIE,
        mediaId: 100009,
        is4k: false,
        userId: friend.id,
        retentionDays: null,
      },
      admin
    );

    assert.strictEqual(request.retentionDays, null);
    assert.strictEqual(request.requestedBy.id, friend.id);
  });
});
