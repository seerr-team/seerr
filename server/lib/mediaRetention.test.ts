import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import RadarrAPI from '@server/api/servarr/radarr';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaRequest from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import mediaRetention from '@server/lib/mediaRetention';
import type { RadarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';

setupTestDb();

// Stand in for a real Radarr: succeed the lookup, then patch this
// instance's axios adapter so the follow-up delete call succeeds too,
// instead of hitting the network.
mock.method(
  RadarrAPI.prototype,
  'getMovieByTmdbId',
  async function (this: RadarrAPI) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).axios.defaults.adapter = async (config: unknown) => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    });
    return { id: 1, title: 'Fake Movie' };
  }
);

const fakeRadarrSettings: RadarrSettings = {
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
};

function disableRetention(): void {
  const settings = getSettings();
  settings.main.mediaRetention = {
    movie: { enabled: false },
    tv: { enabled: false },
  };
  settings.radarr = [];
  settings.sonarr = [];
}

async function getRequester(): Promise<User> {
  return getRepository(User).findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });
}

async function createMedia(overrides: Partial<Media> = {}): Promise<Media> {
  const media = new Media({
    tmdbId: Math.floor(Math.random() * 1000000),
    mediaType: MediaType.MOVIE,
    status: MediaStatus.AVAILABLE,
    ...overrides,
  });
  return getRepository(Media).save(media);
}

async function createRequest(
  media: Media,
  overrides: Partial<MediaRequest> = {}
): Promise<MediaRequest> {
  const requestedBy = await getRequester();
  const request = new MediaRequest({
    type: media.mediaType,
    media,
    requestedBy,
    status: MediaRequestStatus.APPROVED,
    is4k: false,
    ...overrides,
  });
  return getRepository(MediaRequest).save(request);
}

describe('MediaRetention', () => {
  it('does nothing when retention is disabled for the media type', async () => {
    disableRetention();

    const media = await createMedia();
    const request = await createRequest(media, {
      retentionDays: 1,
      availableSince: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    });

    await mediaRetention.run();

    const stillThere = await getRepository(MediaRequest).findOne({
      where: { id: request.id },
    });
    assert.ok(
      stillThere,
      'Request should not be removed when retention is disabled'
    );
  });

  it('backfills availableSince on first observation without removing the request', async () => {
    disableRetention();
    getSettings().main.mediaRetention.movie = {
      enabled: true,
      defaultDays: 30,
    };

    const media = await createMedia();
    const request = await createRequest(media, { retentionDays: 30 });

    await mediaRetention.run();

    const updated = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.ok(
      updated.availableSince,
      'availableSince should be stamped on first run'
    );

    const mediaAfter = await getRepository(Media).findOneOrFail({
      where: { id: media.id },
    });
    assert.strictEqual(mediaAfter.status, MediaStatus.AVAILABLE);
  });

  it('removes the request and marks media DELETED once Radarr confirms removal', async () => {
    disableRetention();
    getSettings().main.mediaRetention.movie = { enabled: true };
    getSettings().radarr = [fakeRadarrSettings];

    const media = await createMedia();
    const request = await createRequest(media, {
      retentionDays: 1,
      availableSince: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    });

    await mediaRetention.run();

    const removed = await getRepository(MediaRequest).findOne({
      where: { id: request.id },
    });
    assert.strictEqual(removed, null, 'Expired request should be removed');

    const mediaAfter = await getRepository(Media).findOneOrFail({
      where: { id: media.id },
    });
    assert.strictEqual(mediaAfter.status, MediaStatus.DELETED);
  });

  it('removes the request but does not mark media DELETED when no Radarr server is configured', async () => {
    disableRetention();
    getSettings().main.mediaRetention.movie = { enabled: true };

    const media = await createMedia();
    const request = await createRequest(media, {
      retentionDays: 1,
      availableSince: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    });

    await mediaRetention.run();

    const removed = await getRepository(MediaRequest).findOne({
      where: { id: request.id },
    });
    assert.strictEqual(removed, null, 'Expired request should be removed');

    const mediaAfter = await getRepository(Media).findOneOrFail({
      where: { id: media.id },
    });
    assert.notEqual(mediaAfter.status, MediaStatus.DELETED);
  });

  it('does not remove the request before it has expired', async () => {
    disableRetention();
    getSettings().main.mediaRetention.movie = { enabled: true };

    const media = await createMedia();
    const request = await createRequest(media, {
      retentionDays: 30,
      availableSince: new Date(),
    });

    await mediaRetention.run();

    const stillThere = await getRepository(MediaRequest).findOne({
      where: { id: request.id },
    });
    assert.ok(stillThere, 'Request should not be removed before expiry');
  });

  it('keeps the media (but removes the expired claim) when another requester still wants it', async () => {
    disableRetention();
    getSettings().main.mediaRetention.movie = { enabled: true };

    const media = await createMedia();
    const expiredRequest = await createRequest(media, {
      retentionDays: 1,
      availableSince: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    });
    const keptRequest = await createRequest(media, {
      retentionDays: null,
    });

    await mediaRetention.run();

    const removed = await getRepository(MediaRequest).findOne({
      where: { id: expiredRequest.id },
    });
    assert.strictEqual(removed, null, 'The expired claim should be removed');

    const keptStillThere = await getRepository(MediaRequest).findOne({
      where: { id: keptRequest.id },
    });
    assert.ok(keptStillThere, 'The indefinitely-kept request should remain');

    const mediaAfter = await getRepository(Media).findOneOrFail({
      where: { id: media.id },
    });
    assert.strictEqual(
      mediaAfter.status,
      MediaStatus.AVAILABLE,
      'Media must not be deleted while another requester still wants it'
    );
  });

  it('only applies to media types with retention enabled', async () => {
    disableRetention();
    getSettings().main.mediaRetention.tv = { enabled: true };

    const media = await createMedia();
    const request = await createRequest(media, {
      retentionDays: 1,
      availableSince: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    });

    await mediaRetention.run();

    const stillThere = await getRepository(MediaRequest).findOne({
      where: { id: request.id },
    });
    assert.ok(
      stillThere,
      'Movie request should be untouched when only TV retention is enabled'
    );
  });
});
