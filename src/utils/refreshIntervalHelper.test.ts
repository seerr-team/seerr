import { MediaStatus, MediaType } from '@server/constants/media';
import type Media from '@server/entity/Media';
import type { DownloadingItem } from '@server/lib/downloadtracker';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getRequestDownloadStatus,
  mediaRefreshInterval,
} from './refreshIntervalHelper';

const createDownloadItem = (
  overrides: Partial<DownloadingItem> & Pick<DownloadingItem, 'downloadId'>
): DownloadingItem => ({
  mediaType: MediaType.TV,
  externalId: 1,
  size: 1000,
  sizeLeft: 500,
  status: 'downloading',
  timeLeft: '00:05:00',
  estimatedCompletionTime: new Date('2026-01-01T00:00:00Z'),
  title: 'Test Show',
  ...overrides,
});

const getRequestStatus = (
  downloadStatus: DownloadingItem[] | undefined,
  seasonNumbers: number[]
) => {
  const downloadItem = getRequestDownloadStatus(downloadStatus, seasonNumbers);

  return {
    downloadItem,
    inProgress: downloadItem.length > 0,
  };
};

describe('getRequestDownloadStatus', () => {
  it('returns an empty array when downloadStatus is undefined', () => {
    const status = getRequestStatus(undefined, [1]);

    assert.deepEqual(status.downloadItem, []);
    assert.equal(status.inProgress, false);
  });

  it('returns all items when seasonNumbers is empty', () => {
    const movieDownload = createDownloadItem({
      downloadId: 'movie-1',
      mediaType: MediaType.MOVIE,
    });
    const tvDownload = createDownloadItem({
      downloadId: 'tv-1',
      episode: {
        id: 1,
        seasonNumber: 2,
        episodeNumber: 3,
        absoluteEpisodeNumber: 3,
      },
    });
    const downloads = [movieDownload, tvDownload];

    const status = getRequestStatus(downloads, []);

    assert.deepEqual(status.downloadItem, downloads);
    assert.equal(status.inProgress, true);
  });

  it('returns only items whose episode season matches the request seasons', () => {
    const seasonOne = createDownloadItem({
      downloadId: 's1',
      episode: {
        id: 1,
        seasonNumber: 1,
        episodeNumber: 1,
        absoluteEpisodeNumber: 1,
      },
    });
    const seasonThree = createDownloadItem({
      downloadId: 's3',
      episode: {
        id: 3,
        seasonNumber: 3,
        episodeNumber: 1,
        absoluteEpisodeNumber: 10,
      },
    });
    const downloads = [seasonOne, seasonThree];

    const status = getRequestStatus(downloads, [3]);

    assert.deepEqual(status.downloadItem, [seasonThree]);
    assert.equal(status.inProgress, true);
  });

  it('returns an empty array when no items match the request seasons', () => {
    const seasonThree = createDownloadItem({
      downloadId: 's3',
      episode: {
        id: 3,
        seasonNumber: 3,
        episodeNumber: 1,
        absoluteEpisodeNumber: 10,
      },
    });

    const status = getRequestStatus([seasonThree], [1, 2]);

    assert.deepEqual(status.downloadItem, []);
    assert.equal(status.inProgress, false);
  });

  it('excludes items without episode metadata when filtering by season', () => {
    const withoutEpisode = createDownloadItem({
      downloadId: 'missing-episode',
    });
    const seasonTwo = createDownloadItem({
      downloadId: 's2',
      episode: {
        id: 2,
        seasonNumber: 2,
        episodeNumber: 4,
        absoluteEpisodeNumber: 4,
      },
    });
    const downloads = [withoutEpisode, seasonTwo];

    const status = getRequestStatus(downloads, [2]);

    assert.deepEqual(status.downloadItem, [seasonTwo]);
    assert.equal(status.inProgress, true);
  });
});

const createMedia = (overrides: Partial<Media> = {}): Media =>
  ({
    id: 1,
    status: MediaStatus.UNKNOWN,
    status4k: MediaStatus.UNKNOWN,
    seasons: [],
    downloadStatus: [],
    downloadStatus4k: [],
    ...overrides,
  }) as unknown as Media;

describe('mediaRefreshInterval', () => {
  it('keeps polling while the media is processing after its download leaves the queue', () => {
    const sawDownload = { current: false };

    mediaRefreshInterval(
      createMedia({
        status: MediaStatus.PROCESSING,
        downloadStatus: [createDownloadItem({ downloadId: 'movie-1' })],
      }),
      sawDownload,
      15000
    );

    assert.equal(
      mediaRefreshInterval(
        createMedia({ status: MediaStatus.PROCESSING }),
        sawDownload,
        15000
      ),
      15000
    );
  });

  it('does not poll processing media when no download was seen', () => {
    assert.equal(
      mediaRefreshInterval(
        createMedia({ status: MediaStatus.PROCESSING }),
        { current: false },
        15000
      ),
      0
    );
  });

  it('stops polling once the media is available', () => {
    assert.equal(
      mediaRefreshInterval(
        createMedia({ status: MediaStatus.AVAILABLE }),
        { current: true },
        15000
      ),
      0
    );
  });

  it('keeps polling while a season is processing on a partially available show', () => {
    assert.equal(
      mediaRefreshInterval(
        createMedia({
          status: MediaStatus.PARTIALLY_AVAILABLE,
          seasons: [
            { seasonNumber: 1, status: MediaStatus.AVAILABLE },
            { seasonNumber: 2, status: MediaStatus.PROCESSING },
          ] as Media['seasons'],
        }),
        { current: true },
        15000
      ),
      15000
    );
  });

  it('keeps polling while a 4K season is processing', () => {
    assert.equal(
      mediaRefreshInterval(
        createMedia({
          status: MediaStatus.AVAILABLE,
          status4k: MediaStatus.PARTIALLY_AVAILABLE,
          seasons: [
            {
              seasonNumber: 1,
              status: MediaStatus.AVAILABLE,
              status4k: MediaStatus.PROCESSING,
            },
          ] as Media['seasons'],
        }),
        { current: true },
        15000
      ),
      15000
    );
  });
});
