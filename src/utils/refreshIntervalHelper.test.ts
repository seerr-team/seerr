import { MediaType } from '@server/constants/media';
import type { DownloadingItem } from '@server/lib/downloadtracker';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getRequestDownloadStatus } from './refreshIntervalHelper';

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
