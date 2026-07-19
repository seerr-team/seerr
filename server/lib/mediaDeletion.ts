import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaRequest from '@server/entity/MediaRequest';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

/**
 * Resolves the Radarr/Sonarr server responsible for this media/version and
 * asks it to remove the movie/series (and its files). If no server is
 * configured for this version, this is a no-op (there's nothing to remove).
 */
export async function removeMediaFiles(
  media: Media,
  is4k: boolean
): Promise<void> {
  const settings = getSettings();
  const isMovie = media.mediaType === MediaType.MOVIE;

  let serviceSettings = isMovie
    ? settings.radarr.find((radarr) => radarr.isDefault && radarr.is4k === is4k)
    : settings.sonarr.find(
        (sonarr) => sonarr.isDefault && sonarr.is4k === is4k
      );

  const specificServiceId = is4k ? media.serviceId4k : media.serviceId;
  if (
    specificServiceId != null &&
    specificServiceId >= 0 &&
    serviceSettings?.id !== specificServiceId
  ) {
    serviceSettings = isMovie
      ? settings.radarr.find((radarr) => radarr.id === specificServiceId)
      : settings.sonarr.find((sonarr) => sonarr.id === specificServiceId);
  }

  if (!serviceSettings) {
    logger.warn(
      `There is no default ${is4k ? '4K ' : ''}${
        isMovie ? 'Radarr' : 'Sonarr'
      } server configured. Did you set any of your ${is4k ? '4K ' : ''}${
        isMovie ? 'Radarr' : 'Sonarr'
      } servers as default?`,
      {
        label: 'Media Deletion',
        mediaId: media.id,
      }
    );
    return;
  }

  if (isMovie) {
    const service = new RadarrAPI({
      apiKey: serviceSettings.apiKey,
      url: RadarrAPI.buildUrl(serviceSettings, '/api/v3'),
    });
    await service.removeMovie(media.tmdbId);
  } else {
    const service = new SonarrAPI({
      apiKey: serviceSettings.apiKey,
      url: SonarrAPI.buildUrl(serviceSettings, '/api/v3'),
    });
    const tmdb = new TheMovieDb();
    const series = await tmdb.getTvShow({ tvId: media.tmdbId });
    const tvdbId = series.external_ids.tvdb_id ?? media.tvdbId;
    if (!tvdbId) {
      throw new Error('TVDB ID not found');
    }
    await service.removeSeries(tvdbId);
  }
}

const isRequestStillActive = (request: MediaRequest, now: Date): boolean => {
  if (request.status === MediaRequestStatus.DECLINED) {
    return false;
  }
  // Kept indefinitely
  if (request.retentionDays == null) {
    return true;
  }
  // Retention clock hasn't started yet (media not yet observed as available)
  if (!request.availableSince) {
    return true;
  }
  const expiresAt = new Date(request.availableSince);
  expiresAt.setDate(expiresAt.getDate() + request.retentionDays);
  return expiresAt > now;
};

/**
 * Removes a single user's claim on a piece of media ("checking it back in").
 *
 * If no other non-declined request for the same media/version still wants
 * to keep it (kept indefinitely, or not yet expired), the underlying files
 * are actually removed via Radarr/Sonarr and the media is marked deleted.
 * Otherwise, only this request is removed and the shared media is left
 * untouched for the remaining requester(s).
 */
export async function removeMediaRequest(request: MediaRequest): Promise<void> {
  const mediaRepository = getRepository(Media);
  const requestRepository = getRepository(MediaRequest);

  const media = await mediaRepository.findOneOrFail({
    where: { id: request.media.id },
    relations: { requests: true },
  });

  // There's only real, physical media to clean up if this version is
  // actually (partially) available. Otherwise there's nothing to remove and
  // the existing MediaRequestSubscriber's own post-removal bookkeeping
  // (resetting status to DELETED/UNKNOWN based on request history) should be
  // left to run unopposed.
  const currentStatus = media[request.is4k ? 'status4k' : 'status'];
  const isCurrentlyAvailable =
    currentStatus === MediaStatus.AVAILABLE ||
    currentStatus === MediaStatus.PARTIALLY_AVAILABLE;

  const now = new Date();
  const otherActiveRequests = media.requests.filter(
    (r) => r.id !== request.id && r.is4k === request.is4k
  );
  const anyoneElseWantsIt = otherActiveRequests.some((r) =>
    isRequestStillActive(r, now)
  );

  const shouldRemoveFiles = isCurrentlyAvailable && !anyoneElseWantsIt;

  if (shouldRemoveFiles) {
    await removeMediaFiles(media, request.is4k);
  }

  // Remove the request first so the existing subscriber-driven status
  // bookkeeping runs against a fully up-to-date request list; our own
  // authoritative "files are actually gone" write (below) then takes
  // precedence over whatever it computed.
  await requestRepository.remove(request);

  if (shouldRemoveFiles) {
    const freshMedia = await mediaRepository.findOneOrFail({
      where: { id: media.id },
    });

    freshMedia[request.is4k ? 'status4k' : 'status'] = MediaStatus.DELETED;
    freshMedia[request.is4k ? 'serviceId4k' : 'serviceId'] = null;
    freshMedia[request.is4k ? 'externalServiceId4k' : 'externalServiceId'] =
      null;
    freshMedia[request.is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'] =
      null;
    freshMedia[request.is4k ? 'ratingKey4k' : 'ratingKey'] = null;
    freshMedia[request.is4k ? 'jellyfinMediaId4k' : 'jellyfinMediaId'] = null;

    await mediaRepository.save(freshMedia);

    logger.info(
      `Removed the ${request.is4k ? '4K' : 'non-4K'} ${
        media.mediaType === 'movie' ? 'movie' : 'show'
      } [TMDB ID ${media.tmdbId}] and its files.`,
      { label: 'Media Deletion' }
    );
  }
}
