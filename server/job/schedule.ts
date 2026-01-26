import { MediaServerType } from '@server/constants/server';
import type { JobId } from '@server/interfaces/settings';
import blacklistedTagsProcessor from '@server/job/blacklistedTagsProcessor';
import availabilitySync from '@server/lib/availabilitySync';
import downloadTracker from '@server/lib/downloadtracker';
import ImageProxy from '@server/lib/imageproxy';
import refreshToken from '@server/lib/refreshToken';
import {
  jellyfinFullScanner,
  jellyfinRecentScanner,
} from '@server/lib/scanners/jellyfin';
import { plexFullScanner, plexRecentScanner } from '@server/lib/scanners/plex';
import { radarrScanner } from '@server/lib/scanners/radarr';
import { sonarrScanner } from '@server/lib/scanners/sonarr';
import { getSettings } from '@server/lib/settings';
import watchlistSync from '@server/lib/watchlistsync';
import logger from '@server/logger';
import schedule from 'node-schedule';

interface ScheduledJob {
  id: JobId;
  job: schedule.Job;
  name: string;
  type: 'process' | 'command';
  interval: 'seconds' | 'minutes' | 'hours' | 'days' | 'fixed';
  cronSchedule: string;
  running?: () => boolean;
  cancelFn?: () => void;
}

export const scheduledJobs: ScheduledJob[] = [];

export const startJobs = (): void => {
  const jobs = getSettings().jobs;
  const mediaServerType = getSettings().main.mediaServerType;

  if (mediaServerType === MediaServerType.PLEX) {
    // Run recently added plex scan every 5 minutes
    scheduledJobs.push({
      id: 'plex-recently-added-scan',
      name: 'Plex Recently Added Scan',
      type: 'process',
      interval: 'minutes',
      cronSchedule: jobs['plex-recently-added-scan'].schedule,
      job: schedule.scheduleJob(
        jobs['plex-recently-added-scan'].schedule,
        () => {
          logger.info('Starting scheduled job: Plex Recently Added Scan', {
            label: 'Jobs',
          });
          plexRecentScanner.run();
        }
      ),
      running: () => plexRecentScanner.status().running,
      cancelFn: () => plexRecentScanner.cancel(),
    });

    // Run full plex scan every 24 hours
    scheduledJobs.push({
      id: 'plex-full-scan',
      name: 'Plex Full Library Scan',
      type: 'process',
      interval: 'hours',
      cronSchedule: jobs['plex-full-scan'].schedule,
      job: schedule.scheduleJob(jobs['plex-full-scan'].schedule, () => {
        logger.info('Starting scheduled job: Plex Full Library Scan', {
          label: 'Jobs',
        });
        plexFullScanner.run();
      }),
      running: () => plexFullScanner.status().running,
      cancelFn: () => plexFullScanner.cancel(),
    });

    scheduledJobs.push({
      id: 'plex-refresh-token',
      name: 'Plex Refresh Token',
      type: 'process',
      interval: 'fixed',
      cronSchedule: jobs['plex-refresh-token'].schedule,
      job: schedule.scheduleJob(jobs['plex-refresh-token'].schedule, () => {
        logger.info('Starting scheduled job: Plex Refresh Token', {
          label: 'Jobs',
        });
        refreshToken.run();
      }),
    });

    // Watchlist Sync
    scheduledJobs.push({
      id: 'plex-watchlist-sync',
      name: 'Plex Watchlist Sync',
      type: 'process',
      interval: 'seconds',
      cronSchedule: jobs['plex-watchlist-sync'].schedule,
      job: schedule.scheduleJob(jobs['plex-watchlist-sync'].schedule, () => {
        logger.info('Starting scheduled job: Plex Watchlist Sync', {
          label: 'Jobs',
        });
        watchlistSync.syncWatchlist();
      }),
    });
  } else if (
    mediaServerType === MediaServerType.JELLYFIN ||
    mediaServerType === MediaServerType.EMBY
  ) {
    // Run recently added jellyfin sync every 5 minutes
    scheduledJobs.push({
      id: 'jellyfin-recently-added-scan',
      name: 'Jellyfin Recently Added Scan',
      type: 'process',
      interval: 'minutes',
      cronSchedule: jobs['jellyfin-recently-added-scan'].schedule,
      job: schedule.scheduleJob(
        jobs['jellyfin-recently-added-scan'].schedule,
        () => {
          logger.info('Starting scheduled job: Jellyfin Recently Added Scan', {
            label: 'Jobs',
          });
          jellyfinRecentScanner.run();
        }
      ),
      running: () => jellyfinRecentScanner.status().running,
      cancelFn: () => jellyfinRecentScanner.cancel(),
    });

    // Run full jellyfin sync every 24 hours
    scheduledJobs.push({
      id: 'jellyfin-full-scan',
      name: 'Jellyfin Full Library Scan',
      type: 'process',
      interval: 'hours',
      cronSchedule: jobs['jellyfin-full-scan'].schedule,
      job: schedule.scheduleJob(jobs['jellyfin-full-scan'].schedule, () => {
        logger.info('Starting scheduled job: Jellyfin Full Scan', {
          label: 'Jobs',
        });
        jellyfinFullScanner.run();
      }),
      running: () => jellyfinFullScanner.status().running,
      cancelFn: () => jellyfinFullScanner.cancel(),
    });
  }

  // Run full radarr scan every 24 hours
  scheduledJobs.push({
    id: 'radarr-scan',
    name: 'Radarr Scan',
    type: 'process',
    interval: 'hours',
    cronSchedule: jobs['radarr-scan'].schedule,
    job: schedule.scheduleJob(jobs['radarr-scan'].schedule, () => {
      logger.info('Starting scheduled job: Radarr Scan', { label: 'Jobs' });
      radarrScanner.run();
    }),
    running: () => radarrScanner.status().running,
    cancelFn: () => radarrScanner.cancel(),
  });

  // Run full sonarr scan every 24 hours
  scheduledJobs.push({
    id: 'sonarr-scan',
    name: 'Sonarr Scan',
    type: 'process',
    interval: 'hours',
    cronSchedule: jobs['sonarr-scan'].schedule,
    job: schedule.scheduleJob(jobs['sonarr-scan'].schedule, () => {
      logger.info('Starting scheduled job: Sonarr Scan', { label: 'Jobs' });
      sonarrScanner.run();
    }),
    running: () => sonarrScanner.status().running,
    cancelFn: () => sonarrScanner.cancel(),
  });

  // Checks if media is still available in plex/sonarr/radarr libs
  scheduledJobs.push({
    id: 'availability-sync',
    name: 'Media Availability Sync',
    type: 'process',
    interval: 'hours',
    cronSchedule: jobs['availability-sync'].schedule,
    job: schedule.scheduleJob(jobs['availability-sync'].schedule, () => {
      logger.info('Starting scheduled job: Media Availability Sync', {
        label: 'Jobs',
      });
      availabilitySync.run();
    }),
    running: () => availabilitySync.running,
    cancelFn: () => availabilitySync.cancel(),
  });

  // Run download sync every minute
  scheduledJobs.push({
    id: 'download-sync',
    name: 'Download Sync',
    type: 'command',
    interval: 'seconds',
    cronSchedule: jobs['download-sync'].schedule,
    job: schedule.scheduleJob(jobs['download-sync'].schedule, () => {
      logger.debug('Starting scheduled job: Download Sync', {
        label: 'Jobs',
      });
      downloadTracker.updateDownloads();
    }),
  });

  // Reset download sync everyday at 01:00 am
  scheduledJobs.push({
    id: 'download-sync-reset',
    name: 'Download Sync Reset',
    type: 'command',
    interval: 'hours',
    cronSchedule: jobs['download-sync-reset'].schedule,
    job: schedule.scheduleJob(jobs['download-sync-reset'].schedule, () => {
      logger.info('Starting scheduled job: Download Sync Reset', {
        label: 'Jobs',
      });
      downloadTracker.resetDownloadTracker();
    }),
  });

  // Run image cache cleanup every 24 hours
  scheduledJobs.push({
    id: 'image-cache-cleanup',
    name: 'Image Cache Cleanup',
    type: 'process',
    interval: 'hours',
    cronSchedule: jobs['image-cache-cleanup'].schedule,
    job: schedule.scheduleJob(jobs['image-cache-cleanup'].schedule, () => {
      logger.info('Starting scheduled job: Image Cache Cleanup', {
        label: 'Jobs',
      });
      // Clean TMDB image cache
      ImageProxy.clearCache('tmdb');

      // Clean users avatar image cache
      ImageProxy.clearCache('avatar');
    }),
  });

  scheduledJobs.push({
    id: 'process-blacklisted-tags',
    name: 'Process Blacklisted Tags',
    type: 'process',
    interval: 'days',
    cronSchedule: jobs['process-blacklisted-tags'].schedule,
    job: schedule.scheduleJob(jobs['process-blacklisted-tags'].schedule, () => {
      logger.info('Starting scheduled job: Process Blacklisted Tags', {
        label: 'Jobs',
      });
      blacklistedTagsProcessor.run();
    }),
    running: () => blacklistedTagsProcessor.status().running,
    cancelFn: () => blacklistedTagsProcessor.cancel(),
  });

  logger.info('Scheduled jobs loaded', { label: 'Jobs' });
};
