import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaType } from '@server/constants/media';
import {
  DownloadTracker,
  type DownloadingItem,
} from '@server/lib/downloadtracker';
import {
  getSettings,
  type RadarrSettings,
  type SonarrSettings,
} from '@server/lib/settings';

const buildRadarrSettings = ({
  id,
  hostname = 'radarr',
  syncEnabled = true,
  downloadQueueSize,
}: {
  id: number;
  hostname?: string;
  syncEnabled?: boolean;
  downloadQueueSize?: number;
}): RadarrSettings =>
  ({
    id,
    name: `Radarr ${id}`,
    hostname,
    port: 7878,
    syncEnabled,
    downloadQueueSize,
  }) as RadarrSettings;

const buildRadarrQueue = (
  count: number
): Awaited<ReturnType<RadarrAPI['getQueue']>> =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    movieId: 100,
    size: 100,
    title: `Movie ${index + 1}`,
    sizeleft: 50,
    timeleft: '00:10:00',
    estimatedCompletionTime: '2026-01-01T00:00:00Z',
    status: 'downloading',
    trackedDownloadStatus: 'ok',
    trackedDownloadState: 'downloading',
    downloadId: `download-${index + 1}`,
    protocol: 'torrent',
    downloadClient: 'client',
    indexer: 'indexer',
  }));

const buildTrackedDownloads = (count: number): DownloadingItem[] =>
  Array.from({ length: count }, (_, index) => ({
    externalId: 100,
    estimatedCompletionTime: new Date('2026-01-01T00:00:00Z'),
    mediaType: MediaType.MOVIE,
    size: 100,
    sizeLeft: 50,
    status: 'downloading',
    timeLeft: '00:10:00',
    title: `Movie ${index + 1}`,
    downloadId: `download-${index + 1}`,
  }));

describe('DownloadTracker updateDownloads', () => {
  const settings = getSettings();
  const originalRadarr = settings.radarr;
  const originalSonarr = settings.sonarr;

  afterEach(() => {
    settings.radarr = originalRadarr;
    settings.sonarr = originalSonarr;
    mock.restoreAll();
  });

  it('shares one active refresh between concurrent callers', async () => {
    const tracker = new DownloadTracker();
    let resolveRefresh: (() => void) | undefined;
    const refresh = mock.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        })
    );
    (
      tracker as unknown as {
        performUpdateDownloads: () => Promise<void>;
      }
    ).performUpdateDownloads = refresh;

    const first = tracker.updateDownloads();
    const second = tracker.updateDownloads();

    assert.strictEqual(first, second);
    assert.strictEqual(refresh.mock.callCount(), 1);

    resolveRefresh?.();
    await first;

    const third = tracker.updateDownloads();
    assert.notStrictEqual(third, first);
    assert.strictEqual(refresh.mock.callCount(), 2);
    resolveRefresh?.();
    await third;
  });

  it('passes configured queue limits and defaults missing values to 10', async () => {
    settings.radarr = [
      {
        id: 1,
        name: 'Radarr',
        hostname: 'radarr',
        port: 7878,
        syncEnabled: true,
        downloadQueueSize: 25,
      } as RadarrSettings,
    ];
    settings.sonarr = [
      {
        id: 2,
        name: 'Sonarr',
        hostname: 'sonarr',
        port: 8989,
        syncEnabled: true,
      } as SonarrSettings,
    ];
    mock.method(RadarrAPI.prototype, 'refreshMonitoredDownloads', async () =>
      Promise.resolve()
    );
    mock.method(SonarrAPI.prototype, 'refreshMonitoredDownloads', async () =>
      Promise.resolve()
    );
    const radarrQueue = mock.method(
      RadarrAPI.prototype,
      'getQueue',
      async () => []
    );
    const sonarrQueue = mock.method(
      SonarrAPI.prototype,
      'getQueue',
      async () => []
    );

    await new DownloadTracker().updateDownloads();

    assert.strictEqual(radarrQueue.mock.calls[0].arguments[0], 25);
    assert.strictEqual(sonarrQueue.mock.calls[0].arguments[0], 10);
  });

  it('starts Radarr and Sonarr updates in parallel', async () => {
    settings.radarr = [buildRadarrSettings({ id: 1 })];
    settings.sonarr = [
      {
        id: 2,
        name: 'Sonarr',
        hostname: 'sonarr',
        port: 8989,
        syncEnabled: true,
      } as SonarrSettings,
    ];
    let releaseRadarr: (() => void) | undefined;
    mock.method(
      RadarrAPI.prototype,
      'refreshMonitoredDownloads',
      () =>
        new Promise<void>((resolve) => {
          releaseRadarr = resolve;
        })
    );
    const sonarrRefresh = mock.method(
      SonarrAPI.prototype,
      'refreshMonitoredDownloads',
      async () => Promise.resolve()
    );
    mock.method(RadarrAPI.prototype, 'getQueue', async () => []);
    mock.method(SonarrAPI.prototype, 'getQueue', async () => []);

    const update = new DownloadTracker().updateDownloads();
    assert.strictEqual(sonarrRefresh.mock.callCount(), 1);
    releaseRadarr?.();
    await update;
  });

  it('fetches duplicate aliases once at the maximum and slices each snapshot', async () => {
    settings.radarr = [
      buildRadarrSettings({ id: 1, downloadQueueSize: 10 }),
      buildRadarrSettings({ id: 2, downloadQueueSize: 25 }),
    ];
    settings.sonarr = [];
    mock.method(RadarrAPI.prototype, 'refreshMonitoredDownloads', async () =>
      Promise.resolve()
    );
    const getQueue = mock.method(RadarrAPI.prototype, 'getQueue', async () =>
      buildRadarrQueue(25)
    );
    const tracker = new DownloadTracker();

    await tracker.updateDownloads();

    assert.strictEqual(getQueue.mock.callCount(), 1);
    assert.strictEqual(getQueue.mock.calls[0].arguments[0], 25);
    assert.strictEqual(tracker.getMovieProgress(1, 100).length, 10);
    assert.strictEqual(tracker.getMovieProgress(2, 100).length, 25);
  });

  it('retains each duplicate alias snapshot independently after failure', async () => {
    settings.radarr = [
      buildRadarrSettings({ id: 1, downloadQueueSize: 10 }),
      buildRadarrSettings({ id: 2, downloadQueueSize: 25 }),
    ];
    settings.sonarr = [];
    mock.method(RadarrAPI.prototype, 'refreshMonitoredDownloads', async () => {
      throw new Error('refresh failed');
    });
    const tracker = new DownloadTracker();
    (
      tracker as unknown as {
        radarrServers: Record<number, DownloadingItem[]>;
      }
    ).radarrServers = {
      1: buildTrackedDownloads(10),
      2: buildTrackedDownloads(25),
    };

    await tracker.updateDownloads();

    assert.strictEqual(tracker.getMovieProgress(1, 100).length, 10);
    assert.strictEqual(tracker.getMovieProgress(2, 100).length, 25);
  });

  it('uses an enabled alias when the first duplicate is disabled', async () => {
    settings.radarr = [
      buildRadarrSettings({
        id: 1,
        syncEnabled: false,
        downloadQueueSize: 1000,
      }),
      buildRadarrSettings({ id: 2, downloadQueueSize: 15 }),
    ];
    settings.sonarr = [];
    mock.method(RadarrAPI.prototype, 'refreshMonitoredDownloads', async () =>
      Promise.resolve()
    );
    const getQueue = mock.method(RadarrAPI.prototype, 'getQueue', async () =>
      buildRadarrQueue(15)
    );
    const tracker = new DownloadTracker();

    await tracker.updateDownloads();

    assert.strictEqual(getQueue.mock.callCount(), 1);
    assert.strictEqual(getQueue.mock.calls[0].arguments[0], 15);
    assert.strictEqual(tracker.getMovieProgress(1, 100).length, 0);
    assert.strictEqual(tracker.getMovieProgress(2, 100).length, 15);
  });

  for (const invalidLimit of ['10', true, false]) {
    it(`rejects malformed runtime queue limit ${String(invalidLimit)}`, async () => {
      settings.radarr = [
        buildRadarrSettings({
          id: 1,
          downloadQueueSize: invalidLimit as unknown as number,
        }),
      ];
      settings.sonarr = [];
      const refresh = mock.method(
        RadarrAPI.prototype,
        'refreshMonitoredDownloads',
        async () => Promise.resolve()
      );
      const getQueue = mock.method(
        RadarrAPI.prototype,
        'getQueue',
        async () => []
      );

      await new DownloadTracker().updateDownloads();

      assert.strictEqual(refresh.mock.callCount(), 0);
      assert.strictEqual(getQueue.mock.callCount(), 0);
    });
  }
});
