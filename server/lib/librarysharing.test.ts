import { MediaServerType } from '@server/constants/server';
import type Media from '@server/entity/Media';
import { getMediaServerItemIds } from '@server/lib/librarysharing';
import { getSettings } from '@server/lib/settings';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const asMedia = (fields: Partial<Media>): Media => fields as Media;

const withMediaServer = (type: MediaServerType) => {
  getSettings().main.mediaServerType = type;
};

describe('getMediaServerItemIds', () => {
  const initialType = getSettings().main.mediaServerType;

  afterEach(() => {
    getSettings().main.mediaServerType = initialType;
  });

  it('returns Plex rating keys when the server is Plex', () => {
    withMediaServer(MediaServerType.PLEX);

    assert.deepEqual(
      getMediaServerItemIds(
        asMedia({
          ratingKey: '51',
          ratingKey4k: '52',
          jellyfinMediaId: 'abc',
          jellyfinMediaId4k: 'def',
        })
      ),
      { id: '51', id4k: '52' }
    );
  });

  it('returns Jellyfin item ids when the server is Jellyfin', () => {
    withMediaServer(MediaServerType.JELLYFIN);

    assert.deepEqual(
      getMediaServerItemIds(
        asMedia({
          ratingKey: '51',
          ratingKey4k: '52',
          jellyfinMediaId: 'abc',
          jellyfinMediaId4k: 'def',
        })
      ),
      { id: 'abc', id4k: 'def' }
    );
  });

  it('reuses the Jellyfin columns for Emby', () => {
    withMediaServer(MediaServerType.EMBY);

    assert.deepEqual(
      getMediaServerItemIds(asMedia({ jellyfinMediaId: 'abc' })),
      { id: 'abc', id4k: undefined }
    );
  });

  it('tolerates media that carries no identifier yet', () => {
    withMediaServer(MediaServerType.PLEX);

    assert.deepEqual(getMediaServerItemIds(asMedia({})), {
      id: undefined,
      id4k: undefined,
    });
  });
});
