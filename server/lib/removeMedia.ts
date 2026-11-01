import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import type Media from '@server/entity/Media';
import { getSettings } from '@server/lib/settings';

export class MediaServiceNotConfiguredError extends Error {}

const getServiceSettings = (media: Media, is4k: boolean) => {
  const settings = getSettings();
  const isMovie = media.mediaType === MediaType.MOVIE;
  const services = isMovie ? settings.radarr : settings.sonarr;
  const specificServiceId = is4k ? media.serviceId4k : media.serviceId;

  if (
    specificServiceId !== null &&
    specificServiceId !== undefined &&
    specificServiceId >= 0
  ) {
    return services.find((service) => service.id === specificServiceId);
  }

  return services.find((service) => service.isDefault && service.is4k === is4k);
};

export const isMediaServiceConfigured = (
  media: Media,
  is4k: boolean
): boolean => Boolean(getServiceSettings(media, is4k));

/**
 * Removes a title from its configured Radarr or Sonarr instance. The Servarr
 * clients always request deletion of the associated files as well.
 */
export const removeMediaFromService = async (
  media: Media,
  is4k: boolean
): Promise<void> => {
  const serviceSettings = getServiceSettings(media, is4k);
  const isMovie = media.mediaType === MediaType.MOVIE;
  const arrName = `${is4k ? '4K ' : ''}${isMovie ? 'Radarr' : 'Sonarr'}`;

  if (!serviceSettings) {
    throw new MediaServiceNotConfiguredError(
      `No ${arrName} server configured to delete media files`
    );
  }

  if (isMovie) {
    const radarr = new RadarrAPI({
      apiKey: serviceSettings.apiKey,
      url: RadarrAPI.buildUrl(serviceSettings, '/api/v3'),
    });
    await radarr.removeMovie(media.tmdbId);
    return;
  }

  let tvdbId = media.tvdbId;
  if (!tvdbId) {
    const tmdb = new TheMovieDb();
    const series = await tmdb.getTvShow({ tvId: media.tmdbId });
    tvdbId = series.external_ids.tvdb_id;
  }

  if (!tvdbId) {
    throw new Error('TVDB ID not found');
  }

  const sonarr = new SonarrAPI({
    apiKey: serviceSettings.apiKey,
    url: SonarrAPI.buildUrl(serviceSettings, '/api/v3'),
  });
  await sonarr.removeSeries(tvdbId);
};
