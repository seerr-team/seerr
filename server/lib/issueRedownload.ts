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
    this.name = 'RedownloadError';
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
      pageSize: 200,
    });
    const grabbed = history.find((h) => h.eventType === 'grabbed');
    if (grabbed) {
      await radarr.markGrabAsFailed(grabbed.id);
      logger.info('Marked Radarr grab as failed; release blocklisted.', {
        label: 'Issue Redownload',
        movieId: media.externalServiceId,
        historyId: grabbed.id,
      });
    } else {
      logger.info('No grabbed history found for movie.', {
        label: 'Issue Redownload',
        movieId: media.externalServiceId,
      });
    }
    // Delete the on-disk file so Radarr treats the movie as missing.
    // Blocklisting alone doesn't remove the file, and Radarr won't search
    // for a replacement while it still has the release.
    const movie = await radarr.getMovie({ id: media.externalServiceId });
    if (movie.movieFile) {
      await radarr.deleteMovieFile(movie.movieFile.id);
    }
    await radarr.searchMovie(media.externalServiceId);
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

  const allEpisodes = await sonarr.getEpisodes(media.externalServiceId);

  let targetEpisodeId: number | undefined;
  if (scope.seasonNumber !== undefined && scope.episodeNumber !== undefined) {
    const match = allEpisodes.find(
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

  // Collect the on-disk files that should be removed so Sonarr re-searches.
  // Scope: single episode, whole season, or whole series.
  const episodesInScope = allEpisodes.filter((e) => {
    if (targetEpisodeId !== undefined) return e.id === targetEpisodeId;
    if (scope.seasonNumber !== undefined)
      return e.seasonNumber === scope.seasonNumber;
    return true;
  });
  const episodeFileIdsToDelete = Array.from(
    new Set(
      episodesInScope
        .map((e) => e.episodeFileId)
        .filter((id): id is number => !!id && id > 0)
    )
  );

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
    logger.info('Marked Sonarr grab as failed; release blocklisted.', {
      label: 'Issue Redownload',
      seriesId: media.externalServiceId,
      historyId: grabbedId,
    });
  } else {
    logger.info('No grabbed history found for scope.', {
      label: 'Issue Redownload',
      seriesId: media.externalServiceId,
      scope,
    });
  }

  // Delete on-disk episode files in scope so Sonarr treats them as missing
  // and actually searches for replacements. Blocklisting alone leaves the
  // existing file, which prevents a re-search.
  for (const fileId of episodeFileIdsToDelete) {
    await sonarr.deleteEpisodeFile(fileId);
  }

  if (targetEpisodeId !== undefined) {
    await sonarr.searchEpisodes([targetEpisodeId]);
  } else if (scope.seasonNumber !== undefined) {
    await sonarr.searchSeason(media.externalServiceId, scope.seasonNumber);
  } else {
    await sonarr.searchSeries(media.externalServiceId);
  }
}
