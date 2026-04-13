import TheMovieDb from '@server/api/themoviedb';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Episode from '@server/entity/Episode';
import { MediaRequest } from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import notificationManager, { Notification } from '@server/lib/notifications';
import logger from '@server/logger';
import { truncate } from 'lodash';
import type {
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { EventSubscriber, In } from 'typeorm';

/**
 * Watches Episode entity saves and fires MEDIA_AIRED_EPISODE_AVAILABLE
 * notifications when an episode's availability status transitions
 * to AVAILABLE.
 *
 * Spam prevention: only notifies for episodes that aired AFTER the
 * user's request was created. This naturally filters out:
 * - Bulk library imports (all episodes pre-date the request)
 * - Re-scans of existing libraries
 * - Backfills of old seasons
 * While still allowing notifications for newly released episodes,
 * even if the download took days or weeks.
 */
@EventSubscriber()
export class EpisodeSubscriber implements EntitySubscriberInterface<Episode> {
  public listenTo(): typeof Episode {
    return Episode;
  }

  /**
   * Sends a per-episode availability notification to users who
   * requested the series containing this episode.
   */
  private async sendEpisodeNotification(
    episode: Episode,
    is4k: boolean
  ): Promise<void> {
    // Walk up the entity chain: Episode → Season → Media
    const season = await episode.season;
    if (!season) {
      return;
    }

    const seasonRepository = getRepository(Season);
    const fullSeason = await seasonRepository.findOne({
      where: { id: season.id },
      relations: { media: true },
    });
    if (!fullSeason) {
      return;
    }

    const media = await fullSeason.media;
    if (!media) {
      return;
    }

    // Find users who requested this series and whose request covers
    // this season. Only notify for approved/completed requests — not
    // pending or declined ones.
    const requestRepository = getRepository(MediaRequest);
    const requests = await requestRepository.find({
      relations: {
        media: true,
        seasons: true,
        requestedBy: {
          settings: true,
        },
      },
      where: {
        media: { id: media.id },
        is4k,
        status: In([MediaRequestStatus.APPROVED, MediaRequestStatus.COMPLETED]),
      },
    });

    // Filter to requests that include this specific season
    const relevantRequests = requests.filter((request) =>
      request.seasons.some((sr) => sr.seasonNumber === fullSeason.seasonNumber)
    );

    if (relevantRequests.length === 0) {
      return;
    }

    const tmdb = new TheMovieDb();

    try {
      const tv = await tmdb.getTvShow({ tvId: media.tmdbId });

      // Fetch episode metadata from TMDB — we need the air date to
      // determine if this is a newly released episode, the episode
      // title for the notification message, and the season's air date
      // distribution to detect batch drops.
      let episodeTitle = '';
      let episodeAirDate: Date | null = null;
      let seasonEpisodes: {
        episode_number: number;
        name: string;
        air_date: string | null;
      }[] = [];
      try {
        const tmdbSeason = await tmdb.getTvSeason({
          tvId: media.tmdbId,
          seasonNumber: fullSeason.seasonNumber,
        });
        seasonEpisodes = tmdbSeason.episodes ?? [];
        const tmdbEpisode = seasonEpisodes.find(
          (ep) => ep.episode_number === episode.episodeNumber
        );
        if (tmdbEpisode) {
          episodeTitle = tmdbEpisode.name ?? '';
          if (tmdbEpisode.air_date) {
            episodeAirDate = new Date(tmdbEpisode.air_date);
          }
        }
      } catch {
        // TMDB season/episode lookup is best-effort; if it fails we
        // skip the notification since we can't verify the air date
        logger.warn(
          'Could not fetch episode metadata from TMDB, skipping notification',
          {
            label: 'Notifications',
            tmdbId: media.tmdbId,
            seasonNumber: fullSeason.seasonNumber,
            episodeNumber: episode.episodeNumber,
          }
        );
        return;
      }

      // If we couldn't determine the air date, skip — we can't tell
      // whether this is a new release or a backfill/import
      if (!episodeAirDate) {
        return;
      }

      // Detect batch-drop seasons (e.g., Netflix releasing all episodes
      // on the same day). If every episode in the season shares the same
      // air date, this is a batch drop — skip per-episode notifications
      // and let the existing MEDIA_AVAILABLE notification handle it.
      // Staggered releases (weekly shows, split-cour, premiere batches
      // followed by weekly) will have multiple distinct air dates and
      // are not suppressed.
      const uniqueAirDates = new Set(
        seasonEpisodes.filter((ep) => ep.air_date).map((ep) => ep.air_date)
      );
      if (uniqueAirDates.size <= 1) {
        return;
      }

      const showTitle = `${tv.name}${
        tv.first_air_date ? ` (${tv.first_air_date.slice(0, 4)})` : ''
      }`;

      // Format episode identifier: "S02E05" or "S02E05 - Episode Title"
      const episodeId = `S${String(fullSeason.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`;
      const episodeLabel = episodeTitle
        ? `${episodeId} - ${episodeTitle}`
        : episodeId;

      // Only notify users whose request was created BEFORE the episode
      // aired. This filters out bulk imports of existing libraries
      // (all episodes pre-date the request) while allowing notifications
      // for newly released episodes, even if the download was slow.
      //
      // TMDB air_date is date-only (resolves to midnight UTC), while
      // request.createdAt has full time precision. To avoid filtering
      // out episodes that air the same day as the request, we compare
      // at date granularity by truncating createdAt to midnight UTC.
      for (const request of relevantRequests) {
        const requestDate = new Date(request.createdAt);
        requestDate.setUTCHours(0, 0, 0, 0);

        if (episodeAirDate < requestDate) {
          continue;
        }

        notificationManager.sendNotification(
          Notification.MEDIA_AIRED_EPISODE_AVAILABLE,
          {
            event: `${is4k ? '4K ' : ''}Episode Now Available`,
            subject: showTitle,
            message: truncate(tv.overview, {
              length: 500,
              separator: /\s/,
              omission: '…',
            }),
            notifyAdmin: false,
            notifySystem: true,
            notifyUser: request.requestedBy,
            image: `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tv.poster_path}`,
            media,
            extra: [
              {
                name: 'Episode',
                value: episodeLabel,
              },
            ],
            request,
          }
        );
      }
    } catch (e) {
      logger.error(
        'Something went wrong sending episode availability notification(s)',
        {
          label: 'Notifications',
          errorMessage: e.message,
          episodeId: episode.id,
        }
      );
    }
  }

  /**
   * Fires when a new Episode row is inserted (first time the episode
   * is tracked). If it's immediately AVAILABLE, notify.
   */
  public async afterInsert(event: InsertEvent<Episode>): Promise<void> {
    if (!event.entity) {
      return;
    }

    if (event.entity.status === MediaStatus.AVAILABLE) {
      await this.sendEpisodeNotification(event.entity, false);
    }

    if (event.entity.status4k === MediaStatus.AVAILABLE) {
      await this.sendEpisodeNotification(event.entity, true);
    }
  }

  /**
   * Fires when an existing Episode is updated. Only notify if the
   * status actually transitioned to AVAILABLE (wasn't already).
   */
  public async afterUpdate(event: UpdateEvent<Episode>): Promise<void> {
    if (!event.entity || !event.databaseEntity) {
      return;
    }

    if (
      event.entity.status === MediaStatus.AVAILABLE &&
      event.databaseEntity.status !== MediaStatus.AVAILABLE
    ) {
      await this.sendEpisodeNotification(event.entity as Episode, false);
    }

    if (
      event.entity.status4k === MediaStatus.AVAILABLE &&
      event.databaseEntity.status4k !== MediaStatus.AVAILABLE
    ) {
      await this.sendEpisodeNotification(event.entity as Episode, true);
    }
  }
}
