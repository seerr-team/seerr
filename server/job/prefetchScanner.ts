import JellyfinMainAPI from '@server/api/jellyfinMain';
import JellyfinPlaybackReportingAPI from '@server/api/jellyfinPlaybackReporting';
import { getMetadataProvider } from '@server/api/metadata';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import type {
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { SeasonWithEpisodes } from '@server/models/Tv';
import { getHostname } from '@server/utils/getHostname';
import { getMediaServerAdmin } from '@server/utils/getMediaServerAdmin';

class AbortPrefetchScan extends Error {}

class PrefetchScanner implements RunnableScanner<StatusBase> {
  private running = false;
  private progress = 0;

  private jfClient: JellyfinMainAPI;
  private jfPlaybackReportingClient: JellyfinPlaybackReportingAPI;
  private fullyPlayedEpisodes: SeasonWithEpisodes[] = [];

  public async run() {
    this.running = true;

    try {
      await this.queryPlaybackActivity();
    } catch (err) {
      if (err instanceof AbortPrefetchScan) {
        logger.info('Aborting job: Scan for Episodes to Prefetch', {
          label: 'Jobs',
        });
      } else {
        throw err;
      }
    } finally {
      this.reset();
    }
  }

  public status(): StatusBase {
    return {
      running: this.running,
      progress: this.progress,
      total: this.fullyPlayedEpisodes.length,
    };
  }

  public cancel() {
    this.running = false;
    this.progress = 0;
    this.fullyPlayedEpisodes = [];
  }

  private reset() {
    this.cancel();
  }

  private async queryPlaybackActivity() {
    const settings = getSettings();
    const admin = await getMediaServerAdmin();

    if (!admin) {
      logger.warn('No admin configured. Prefetch scan skipped.');
      return;
    }

    this.jfClient = new JellyfinMainAPI(
      getHostname(),
      settings.jellyfin.apiKey,
      admin.jellyfinDeviceId
    );
    this.jfPlaybackReportingClient = new JellyfinPlaybackReportingAPI(
      getHostname(),
      settings.jellyfin.apiKey,
      admin.jellyfinDeviceId
    );

    const playbackActivity =
      await this.jfPlaybackReportingClient.getPlaybackActivity({
        itemType: 'Episode',
      });

    const mediaRepository = getRepository(Media);
    const metadataProvider = await getMetadataProvider('tv');

    for (let i = 0; i < playbackActivity.length; ++i) {
      const activity = playbackActivity[i];

      const item = await this.jfClient.getItemData(activity.ItemId);
      if (
        !item ||
        !item.ParentIndexNumber ||
        !item.IndexNumber ||
        !item.RunTimeTicks
      ) {
        logger.debug(`Jellyfin Item with ID ${activity.ItemId} not found`);
        continue;
      }

      const media = await mediaRepository.findOne({
        where: { jellyfinMediaId: item.SeriesId },
      });
      if (!media) {
        logger.debug(`Media with Jellyfin ID ${item.SeriesId} not found`);
        continue;
      }

      const show = await metadataProvider.getTvShow({
        tvId: media.tmdbId,
      });
      const season = await metadataProvider.getTvSeason({
        tvId: media.tmdbId,
        seasonNumber: item.ParentIndexNumber,
      });
      const episode = season.episodes.find(
        (episode) => episode.episode_number === item.IndexNumber
      );
      if (!episode) {
        logger.debug(
          `Episode ${item.IndexNumber} not found at ${season.name} of ${show.name}`
        );
        continue;
      }

      // the runtime is in minutes while the PlayDuration is provided in seconds
      const activityPlayDurationMinutes = activity.PlayDuration / 60;
      if (episode.runtime * 0.9 > activityPlayDurationMinutes) {
        continue;
      }

      const prefetchEpisodeThreshold = media.prefetchEpisodeThreshold ?? 2;
      if (
        season.episodes.length >
        item.IndexNumber + prefetchEpisodeThreshold
      ) {
        continue;
      }

      console.log(`Threshold exceeded at ${season.name} of ${show.name}`);
      console.log(
        `Runtime: ${episode.runtime}, Jellyfin: ${
          item.RunTimeTicks / 10_000_000 / 60
        }`
      );
    }
  }
}

export const prefetchScanner = new PrefetchScanner();
