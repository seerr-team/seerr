import JellyfinMainAPI from '@server/api/jellyfinMain';
import JellyfinPlaybackReportingAPI, {
  type JellyfinPlaybackActivityResponse,
} from '@server/api/jellyfinPlaybackReporting';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaPlayback } from '@server/entity/MediaPlayback';
import { User } from '@server/entity/User';
import type { StatusBase } from '@server/lib/scanners/baseScanner';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { getHostname } from '@server/utils/getHostname';
import { getMediaServerAdmin } from '@server/utils/getMediaServerAdmin';
import { randomUUID as uuid } from 'crypto';

const BUNDLE_SIZE = 20;
const UPDATE_RATE = 4 * 1000;

class JellyfinPlaybackReportingScanner {
  private sessionId: string;
  private jfClient: JellyfinMainAPI;
  private jfPrClient: JellyfinPlaybackReportingAPI;
  private items: JellyfinPlaybackActivityResponse[] = [];
  private progress = 0;
  private running = false;
  private isRecentOnly = false;

  constructor({ isRecentOnly }: { isRecentOnly?: boolean } = {}) {
    this.isRecentOnly = isRecentOnly ?? false;
  }

  private async processItems(slicedItems: JellyfinPlaybackActivityResponse[]) {
    await Promise.all(
      slicedItems.map(async (item) => {
        const mediaRepository = getRepository(Media);
        const media = await mediaRepository.findOne({
          where: { jellyfinMediaId: item.ItemId },
        });

        const userRepository = getRepository(User);
        const user = await userRepository.findOne({
          where: { jellyfinUserId: item.UserId },
        });

        if (media && user) {
          const mediaPlayback = new MediaPlayback();
          mediaPlayback.media = media;
          mediaPlayback.playedAt = new Date(item.DateCreated);
          mediaPlayback.playedBy = user;

          const mediaPlaybackRepository = getRepository(MediaPlayback);
          await mediaPlaybackRepository.save(mediaPlayback);
        }
      })
    );
  }

  private async loop({
    start = 0,
    end = BUNDLE_SIZE,
    sessionId,
  }: {
    start?: number;
    end?: number;
    sessionId?: string;
  } = {}) {
    const slicedItems = this.items.slice(start, end);

    if (!this.running) {
      throw new Error('Sync was aborted.');
    }

    if (this.sessionId !== sessionId) {
      throw new Error('New session was started. Old session aborted.');
    }

    if (start < this.items.length) {
      this.progress = start;
      await this.processItems(slicedItems);

      await new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          this.loop({
            start: start + BUNDLE_SIZE,
            end: end + BUNDLE_SIZE,
            sessionId,
          })
            .then(() => resolve())
            .catch((e) => reject(new Error(e.message)));
        }, UPDATE_RATE)
      );
    }
  }

  private log(
    message: string,
    level: 'info' | 'error' | 'debug' | 'warn' = 'debug',
    optional?: Record<string, unknown>
  ): void {
    logger[level](message, {
      label: 'Jellyfin Playback Reporting Sync',
      ...optional,
    });
  }

  public async run(): Promise<void> {
    const settings = getSettings();

    if (
      settings.main.mediaServerType != MediaServerType.JELLYFIN &&
      settings.main.mediaServerType != MediaServerType.EMBY
    ) {
      return;
    }

    const sessionId = uuid();
    this.sessionId = sessionId;
    logger.info('Jellyfin Playback Reporting Sync Starting', {
      sessionId,
      label: 'Jellyfin Playback Reporting Sync',
    });
    try {
      this.running = true;

      const admin = await getMediaServerAdmin();

      if (!admin) {
        return this.log(
          'No admin configured. Jellyfin Playback Reporting sync skipped.',
          'warn'
        );
      }

      this.jfClient = new JellyfinMainAPI(
        getHostname(),
        settings.jellyfin.apiKey,
        admin.jellyfinDeviceId
      );

      this.jfClient.setUserId(admin.jellyfinUserId ?? '');

      this.jfPrClient = new JellyfinPlaybackReportingAPI(
        getHostname(),
        settings.jellyfin.apiKey,
        admin.jellyfinDeviceId
      );

      this.jfPrClient.setUserId(admin.jellyfinUserId ?? '');

      if (this.isRecentOnly) {
        this.items = await this.jfPrClient.getPlaybackActivity();

        await this.loop({ sessionId });
      } else {
        const users = await this.jfClient.getUsers();

        for (const user of users.users) {
          const playedItems = await this.jfClient.getPlayedItems(user.Id);

          const userItems: JellyfinPlaybackActivityResponse[] =
            playedItems.flatMap((item) => {
              if (!item.UserData) {
                return [];
              }

              return {
                ItemId: item.Id,
                UserId: user.Id,
                DateCreated: item.UserData.LastPlayedDate,
              };
            });

          this.items = [...this.items, ...userItems];
        }

        await this.loop({ sessionId });
      }

      this.log(
        this.isRecentOnly
          ? 'Recently Added Scan Complete'
          : 'Full Scan Complete',
        'info'
      );
    } catch (e) {
      logger.error('Sync interrupted', {
        label: 'Jellyfin Playback Reporting Sync',
        errorMessage: e.message,
      });
    } finally {
      // If a new scanning session hasnt started, set running back to false
      if (this.sessionId === sessionId) {
        this.running = false;
      }
    }
  }

  public status(): StatusBase {
    return {
      running: this.running,
      progress: this.progress,
      total: this.items.length,
    };
  }

  public cancel(): void {
    this.running = false;
  }
}

export const jellyfinPlaybackReportingFullScanner =
  new JellyfinPlaybackReportingScanner();
export const jellyfinPlaybackReportingRecentScanner =
  new JellyfinPlaybackReportingScanner({
    isRecentOnly: true,
  });
