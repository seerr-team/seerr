import type { LidarrAlbum } from '@server/api/servarr/lidarr';
import LidarrAPI from '@server/api/servarr/lidarr';
import type {
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import BaseScanner from '@server/lib/scanners/baseScanner';
import type { LidarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { uniqWith } from 'lodash';

type SyncStatus = StatusBase & {
  currentServer: LidarrSettings;
  servers: LidarrSettings[];
};

class LidarrScanner
  extends BaseScanner<LidarrAlbum>
  implements RunnableScanner<SyncStatus>
{
  private servers: LidarrSettings[];
  private currentServer: LidarrSettings;
  private lidarrApi: LidarrAPI;

  constructor() {
    super('Lidarr Scan', { bundleSize: 50 });
  }

  public status(): SyncStatus {
    return {
      running: this.running,
      progress: this.progress,
      total: this.items.length,
      currentServer: this.currentServer,
      servers: this.servers,
    };
  }

  public async run(): Promise<void> {
    const settings = getSettings();
    const sessionId = this.startRun();

    try {
      // Filter out duplicate servers
      this.servers = uniqWith(settings.lidarr, (lidarrA, lidarrB) => {
        return (
          lidarrA.hostname === lidarrB.hostname &&
          lidarrA.port === lidarrB.port &&
          lidarrA.baseUrl === lidarrB.baseUrl
        );
      });

      for (const server of this.servers) {
        this.currentServer = server;
        if (server.syncEnabled) {
          this.log(
            `Beginning to process Lidarr server: ${server.name}`,
            'info'
          );

          this.lidarrApi = new LidarrAPI({
            apiKey: server.apiKey,
            url: LidarrAPI.buildUrl(server, '/api/v1'),
          });

          this.items = await this.lidarrApi.getAlbums();
          await this.loop(this.processLidarrAlbum.bind(this), { sessionId });
        } else {
          this.log(`Sync not enabled. Skipping Lidarr server: ${server.name}`);
        }
      }

      this.log('Lidarr scan complete', 'info');
    } catch (e) {
      this.log('Scan interrupted', 'error', { errorMessage: e.message });
    } finally {
      this.endRun(sessionId);
    }
  }

  private async processLidarrAlbum(lidarrAlbum: LidarrAlbum): Promise<void> {
    try {
      if (!lidarrAlbum.monitored) {
        this.log('Title is unmonitored. Skipping item.', 'debug', {
          title: lidarrAlbum.title,
        });
        return;
      }

      const mbId = lidarrAlbum.foreignAlbumId;

      if (!mbId) {
        this.log(
          'No MusicBrainz ID found for this title. Skipping item.',
          'debug',
          {
            title: lidarrAlbum.title,
          }
        );
        return;
      }

      await this.processMusic(mbId, {
        serviceId: this.currentServer.id,
        externalServiceId: lidarrAlbum.id,
        externalServiceSlug: lidarrAlbum.titleSlug,
        title: lidarrAlbum.title,
        processing:
          lidarrAlbum.monitored &&
          (!lidarrAlbum.statistics ||
            lidarrAlbum.statistics.trackFileCount <
              lidarrAlbum.statistics.totalTrackCount),
      });
    } catch (e) {
      this.log('Failed to process Lidarr media', 'error', {
        errorMessage: e.message,
        title: lidarrAlbum.title,
      });
    }
  }
}

export const lidarrScanner = new LidarrScanner();
