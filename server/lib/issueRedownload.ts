import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaType } from '@server/constants/media';
import type Issue from '@server/entity/Issue';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

export class RedownloadError extends Error {
  public readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

interface Scope {
  seasonNumber?: number;
  episodeNumber?: number;
}

export async function triggerRedownload(issue: Issue): Promise<void> {
  const { media } = issue;
  if (media.serviceId === null || media.serviceId === undefined) {
    throw new RedownloadError(
      'Media is not linked to a Radarr/Sonarr service.',
      400
    );
  }
  if (
    media.externalServiceId === null ||
    media.externalServiceId === undefined
  ) {
    throw new RedownloadError(
      'Media does not have an external service ID; cannot locate it in Radarr/Sonarr.',
      400
    );
  }

  const settings = getSettings();
  const scope: Scope = {
    seasonNumber: issue.problemSeason > 0 ? issue.problemSeason : undefined,
    episodeNumber: issue.problemEpisode > 0 ? issue.problemEpisode : undefined,
  };

  if (media.mediaType === MediaType.MOVIE) {
    const server = settings.radarr.find((s) => s.id === media.serviceId);
    if (!server) {
      throw new RedownloadError(
        'Radarr server for this media is missing.',
        400
      );
    }
    const radarr = new RadarrAPI({
      url: RadarrAPI.buildUrl(server, '/api/v3'),
      apiKey: server.apiKey,
    });

    const history = await radarr.getHistory({
      movieId: media.externalServiceId,
    });
    const grabbed = history.find((h) => h.eventType === 'grabbed');
    if (grabbed) {
      await radarr.markGrabAsFailed(grabbed.id);
      logger.info(
        'Marked Radarr grab as failed; blocklist + re-search triggered.',
        {
          label: 'Issue Redownload',
          movieId: media.externalServiceId,
          historyId: grabbed.id,
        }
      );
    } else {
      logger.info('No grabbed history found; triggering fresh movie search.', {
        label: 'Issue Redownload',
        movieId: media.externalServiceId,
      });
      await radarr.searchMovie(media.externalServiceId);
    }
    return;
  }

  // TV
  const server = settings.sonarr.find((s) => s.id === media.serviceId);
  if (!server) {
    throw new RedownloadError('Sonarr server for this media is missing.', 400);
  }
  const sonarr = new SonarrAPI({
    url: SonarrAPI.buildUrl(server, '/api/v3'),
    apiKey: server.apiKey,
  });

  let targetEpisodeId: number | undefined;
  if (scope.seasonNumber !== undefined && scope.episodeNumber !== undefined) {
    const episodes = await sonarr.getEpisodes(media.externalServiceId);
    const match = episodes.find(
      (e) =>
        e.seasonNumber === scope.seasonNumber &&
        e.episodeNumber === scope.episodeNumber
    );
    if (!match) {
      throw new RedownloadError(
        `Episode S${scope.seasonNumber}E${scope.episodeNumber} not found in Sonarr.`,
        404
      );
    }
    targetEpisodeId = match.id;
  }

  let grabbedId: number | undefined;
  if (targetEpisodeId !== undefined) {
    const history = await sonarr.getHistory({ episodeId: targetEpisodeId });
    grabbedId = history.find((h) => h.eventType === 'grabbed')?.id;
  } else {
    const history = await sonarr.getHistory({
      seriesId: media.externalServiceId,
      pageSize: 200,
    });
    const inScope =
      scope.seasonNumber !== undefined
        ? history.filter(
            (h) =>
              h.eventType === 'grabbed' &&
              // Sonarr history records include seasonNumber under data for
              // season-pack grabs and under top-level for episode grabs.
              String(h.data?.seasonNumber ?? '') === String(scope.seasonNumber)
          )
        : history.filter((h) => h.eventType === 'grabbed');
    grabbedId = inScope[0]?.id;
  }

  if (grabbedId !== undefined) {
    await sonarr.markGrabAsFailed(grabbedId);
    logger.info(
      'Marked Sonarr grab as failed; blocklist + re-search triggered.',
      {
        label: 'Issue Redownload',
        seriesId: media.externalServiceId,
        historyId: grabbedId,
      }
    );
    return;
  }

  // Fallback: no prior grab found; just trigger a fresh search of the scope.
  logger.info('No grabbed history found; triggering fresh Sonarr search.', {
    label: 'Issue Redownload',
    seriesId: media.externalServiceId,
    scope,
  });
  if (targetEpisodeId !== undefined) {
    await sonarr.searchEpisodes([targetEpisodeId]);
  } else if (scope.seasonNumber !== undefined) {
    await sonarr.searchSeason(media.externalServiceId, scope.seasonNumber);
  } else {
    await sonarr.searchSeries(media.externalServiceId);
  }
}
