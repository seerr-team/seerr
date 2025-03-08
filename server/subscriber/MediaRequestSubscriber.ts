import CoverArtArchive from '@server/api/coverartarchive';
import ListenBrainzAPI from '@server/api/listenbrainz';
import MusicBrainz from '@server/api/musicbrainz';
import LidarrAPI from '@server/api/servarr/lidarr';
import type { RadarrMovieOptions } from '@server/api/servarr/radarr';
import RadarrAPI from '@server/api/servarr/radarr';
import type {
  AddSeriesOptions,
  SonarrSeries,
} from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import SeasonRequest from '@server/entity/SeasonRequest';
import notificationManager, { Notification } from '@server/lib/notifications';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isEqual, truncate } from 'lodash';
import type {
  EntityManager,
  EntitySubscriberInterface,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { EventSubscriber } from 'typeorm';

@EventSubscriber()
export class MediaRequestSubscriber
  implements EntitySubscriberInterface<MediaRequest>
{
  private async notifyAvailableMovie(
    entity: MediaRequest,
    event?: UpdateEvent<MediaRequest>
  ) {
    // Get fresh media state using event manager
    let latestMedia: Media | null = null;
    if (event?.manager) {
      latestMedia = await event.manager.findOne(Media, {
        where: { id: entity.media.id },
      });
    }
    if (!latestMedia) {
      const mediaRepository = getRepository(Media);
      latestMedia = await mediaRepository.findOne({
        where: { id: entity.media.id },
      });
    }

    // Check availability using fresh media state
    if (
      !latestMedia ||
      latestMedia[entity.is4k ? 'status4k' : 'status'] !== MediaStatus.AVAILABLE
    ) {
      return;
    }

    const tmdb = new TheMovieDb();

    try {
      const movie = await tmdb.getMovie({
        movieId: entity.media.tmdbId,
      });

      notificationManager.sendNotification(Notification.MEDIA_AVAILABLE, {
        event: `${entity.is4k ? '4K ' : ''}Movie Request Now Available`,
        notifyAdmin: false,
        notifySystem: true,
        notifyUser: entity.requestedBy,
        subject: `${movie.title}${
          movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ''
        }`,
        message: truncate(movie.overview, {
          length: 500,
          separator: /\s/,
          omission: '…',
        }),
        media: latestMedia,
        image: `https://image.tmdb.org/t/p/w600_and_h900_bestv2${movie.poster_path}`,
        request: entity,
      });
    } catch (e) {
      logger.error('Something went wrong sending media notification(s)', {
        label: 'Notifications',
        errorMessage: e.message,
        mediaId: entity.id,
      });
    }
  }

  private async notifyAvailableSeries(
    entity: MediaRequest,
    event?: UpdateEvent<MediaRequest>
  ) {
    // Get fresh media state with seasons using event manager
    let latestMedia: Media | null = null;
    if (event?.manager) {
      latestMedia = await event.manager.findOne(Media, {
        where: { id: entity.media.id },
        relations: { seasons: true },
      });
    }
    if (!latestMedia) {
      const mediaRepository = getRepository(Media);
      latestMedia = await mediaRepository.findOne({
        where: { id: entity.media.id },
        relations: { seasons: true },
      });
    }

    if (!latestMedia) {
      return;
    }

    // Check availability using fresh media state
    const requestedSeasons =
      entity.seasons?.map((entitySeason) => entitySeason.seasonNumber) ?? [];
    const availableSeasons = latestMedia.seasons.filter(
      (season) =>
        season[entity.is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE &&
        requestedSeasons.includes(season.seasonNumber)
    );
    const isMediaAvailable =
      availableSeasons.length > 0 &&
      availableSeasons.length === requestedSeasons.length;

    if (!isMediaAvailable) {
      return;
    }

    const tmdb = new TheMovieDb();

    try {
      const tv = await tmdb.getTvShow({ tvId: entity.media.tmdbId });

      notificationManager.sendNotification(Notification.MEDIA_AVAILABLE, {
        event: `${entity.is4k ? '4K ' : ''}Series Request Now Available`,
        subject: `${tv.name}${
          tv.first_air_date ? ` (${tv.first_air_date.slice(0, 4)})` : ''
        }`,
        message: truncate(tv.overview, {
          length: 500,
          separator: /\s/,
          omission: '…',
        }),
        notifyAdmin: false,
        notifySystem: true,
        notifyUser: entity.requestedBy,
        image: `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tv.poster_path}`,
        media: latestMedia,
        extra: [
          {
            name: 'Requested Seasons',
            value: entity.seasons
              .map((season) => season.seasonNumber)
              .join(', '),
          },
        ],
        request: entity,
      });
    } catch (e) {
      logger.error('Something went wrong sending media notification(s)', {
        label: 'Notifications',
        errorMessage: e.message,
        mediaId: entity.id,
      });
    }
  }

  private async notifyAvailableMusic(
    entity: MediaRequest,
    event?: UpdateEvent<MediaRequest>
  ) {
    // Get fresh media state using event manager
    let latestMedia: Media | null = null;
    if (event?.manager) {
      latestMedia = await event.manager.findOne(Media, {
        where: { id: entity.media.id },
      });
    }
    if (!latestMedia) {
      const mediaRepository = getRepository(Media);
      latestMedia = await mediaRepository.findOne({
        where: { id: entity.media.id },
      });

      if (
        !latestMedia ||
        latestMedia.mediaType !== MediaType.MUSIC ||
        latestMedia['status'] != MediaStatus.AVAILABLE
      ) {
        return;
      }

      const listenbrainz = new ListenBrainzAPI();
      const coverArt = CoverArtArchive.getInstance();
      const musicbrainz = new MusicBrainz();

      try {
        const album = await listenbrainz.getAlbum(latestMedia.mbId ?? '');
        const coverArtResponse = await coverArt.getCoverArt(
          latestMedia.mbId ?? ''
        );
        const coverArtUrl =
          coverArtResponse.images[0]?.thumbnails?.['250'] ?? '';
        const artistId =
          album.release_group_metadata?.artist?.artists[0]?.artist_mbid;
        const artistWiki = artistId
          ? await musicbrainz.getArtistWikipediaExtract({
              artistMbid: artistId,
            })
          : null;

        notificationManager.sendNotification(Notification.MEDIA_AVAILABLE, {
          event: 'Album Request Now Available',
          notifyAdmin: false,
          notifySystem: true,
          notifyUser: entity.requestedBy,
          subject: `${album.release_group_metadata.release_group.name} by ${album.release_group_metadata.artist.name}`,
          message: truncate(artistWiki?.content ?? '', {
            length: 500,
            separator: /\s/,
            omission: '…',
          }),
          media: latestMedia,
          image: coverArtUrl,
          request: entity,
        });
      } catch (e) {
        logger.error('Something went wrong sending media notification(s)', {
          label: 'Notifications',
          errorMessage: e.message,
          mediaId: entity.id,
        });
      }
    }
  }

  public async sendToRadarr(entity: MediaRequest): Promise<void> {
    if (
      entity.status === MediaRequestStatus.APPROVED &&
      entity.type === MediaType.MOVIE
    ) {
      try {
        const mediaRepository = getRepository(Media);
        const settings = getSettings();
        if (settings.radarr.length === 0 && !settings.radarr[0]) {
          logger.info(
            'No Radarr server configured, skipping request processing',
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
          return;
        }

        let radarrSettings = settings.radarr.find(
          (radarr) => radarr.isDefault && radarr.is4k === entity.is4k
        );

        if (
          entity.serverId !== null &&
          entity.serverId >= 0 &&
          radarrSettings?.id !== entity.serverId
        ) {
          radarrSettings = settings.radarr.find(
            (radarr) => radarr.id === entity.serverId
          );
          logger.info(
            `Request has an override server: ${radarrSettings?.name}`,
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
        }

        if (!radarrSettings) {
          logger.warn(
            `There is no default ${
              entity.is4k ? '4K ' : ''
            }Radarr server configured. Did you set any of your ${
              entity.is4k ? '4K ' : ''
            }Radarr servers as default?`,
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
          return;
        }

        let rootFolder = radarrSettings.activeDirectory;
        let qualityProfile = radarrSettings.activeProfileId;
        let tags = radarrSettings.tags ? [...radarrSettings.tags] : [];

        if (
          entity.rootFolder &&
          entity.rootFolder !== '' &&
          entity.rootFolder !== radarrSettings.activeDirectory
        ) {
          rootFolder = entity.rootFolder;
          logger.info(`Request has an override root folder: ${rootFolder}`, {
            label: 'Media Request',
            requestId: entity.id,
            mediaId: entity.media.id,
          });
        }

        if (
          entity.profileId &&
          entity.profileId !== radarrSettings.activeProfileId
        ) {
          qualityProfile = entity.profileId;
          logger.info(
            `Request has an override quality profile ID: ${qualityProfile}`,
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
        }

        if (entity.tags && !isEqual(entity.tags, radarrSettings.tags)) {
          tags = entity.tags;
          logger.info(`Request has override tags`, {
            label: 'Media Request',
            requestId: entity.id,
            mediaId: entity.media.id,
            tagIds: tags,
          });
        }

        const tmdb = new TheMovieDb();
        const radarr = new RadarrAPI({
          apiKey: radarrSettings.apiKey,
          url: RadarrAPI.buildUrl(radarrSettings, '/api/v3'),
        });
        const movie = await tmdb.getMovie({ movieId: entity.media.tmdbId });

        const media = await mediaRepository.findOne({
          where: { id: entity.media.id },
        });

        if (!media) {
          logger.error('Media data not found', {
            label: 'Media Request',
            requestId: entity.id,
            mediaId: entity.media.id,
          });
          return;
        }

        if (radarrSettings.tagRequests) {
          const radarrTags = await radarr.getTags();
          // old tags had space around the hyphen
          let userTag = radarrTags.find((v) =>
            v.label.startsWith(entity.requestedBy.id + ' - ')
          );
          // new tags do not have spaces around the hyphen, since spaces are not allowed anymore
          if (!userTag) {
            userTag = radarrTags.find((v) =>
              v.label.startsWith(entity.requestedBy.id + '-')
            );
          }
          if (!userTag) {
            logger.info(`Requester has no active tag. Creating new`, {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
              userId: entity.requestedBy.id,
              newTag:
                entity.requestedBy.id + '-' + entity.requestedBy.displayName,
            });
            userTag = await radarr.createTag({
              label:
                entity.requestedBy.id + '-' + entity.requestedBy.displayName,
            });
          }
          if (userTag.id) {
            if (!tags?.find((v) => v === userTag?.id)) {
              tags?.push(userTag.id);
            }
          } else {
            logger.warn(`Requester has no tag and failed to add one`, {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
              userId: entity.requestedBy.id,
              radarrServer: radarrSettings.hostname + ':' + radarrSettings.port,
            });
          }
        }

        if (
          media[entity.is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE
        ) {
          logger.warn('Media already exists, marking request as APPROVED', {
            label: 'Media Request',
            requestId: entity.id,
            mediaId: entity.media.id,
          });

          if (entity.status !== MediaRequestStatus.APPROVED) {
            const requestRepository = getRepository(MediaRequest);
            entity.status = MediaRequestStatus.APPROVED;
            await requestRepository.save(entity);
          }
          return;
        }

        const radarrMovieOptions: RadarrMovieOptions = {
          profileId: qualityProfile,
          qualityProfileId: qualityProfile,
          rootFolderPath: rootFolder,
          minimumAvailability: radarrSettings.minimumAvailability,
          title: movie.title,
          tmdbId: movie.id,
          year: Number(movie.release_date.slice(0, 4)),
          monitored: true,
          tags,
          searchNow: !radarrSettings.preventSearch,
        };

        // Run entity asynchronously so we don't wait for it on the UI side
        radarr
          .addMovie(radarrMovieOptions)
          .then(async (radarrMovie) => {
            // We grab media again here to make sure we have the latest version of it
            const media = await mediaRepository.findOne({
              where: { id: entity.media.id },
            });

            if (!media) {
              throw new Error('Media data not found');
            }

            media[entity.is4k ? 'externalServiceId4k' : 'externalServiceId'] =
              radarrMovie.id;
            media[
              entity.is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'
            ] = radarrMovie.titleSlug;
            media[entity.is4k ? 'serviceId4k' : 'serviceId'] =
              radarrSettings?.id;
            await mediaRepository.save(media);
          })
          .catch(async () => {
            const requestRepository = getRepository(MediaRequest);

            entity.status = MediaRequestStatus.FAILED;
            requestRepository.save(entity);

            logger.warn(
              'Something went wrong sending movie request to Radarr, marking status as FAILED',
              {
                label: 'Media Request',
                requestId: entity.id,
                mediaId: entity.media.id,
                radarrMovieOptions,
              }
            );

            MediaRequest.sendNotification(
              entity,
              media,
              Notification.MEDIA_FAILED
            );
          })
          .finally(() => {
            radarr.clearCache({
              tmdbId: movie.id,
              externalId: entity.is4k
                ? media.externalServiceId4k
                : media.externalServiceId,
            });
          });
        logger.info('Sent request to Radarr', {
          label: 'Media Request',
          requestId: entity.id,
          mediaId: entity.media.id,
        });
      } catch (e) {
        logger.error('Something went wrong sending request to Radarr', {
          label: 'Media Request',
          errorMessage: e.message,
          requestId: entity.id,
          mediaId: entity.media.id,
        });
        throw new Error(e.message);
      }
    }
  }

  public async sendToSonarr(entity: MediaRequest): Promise<void> {
    if (
      entity.status === MediaRequestStatus.APPROVED &&
      entity.type === MediaType.TV
    ) {
      try {
        const mediaRepository = getRepository(Media);
        const settings = getSettings();
        if (settings.sonarr.length === 0 && !settings.sonarr[0]) {
          logger.warn(
            'No Sonarr server configured, skipping request processing',
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
          return;
        }

        let sonarrSettings = settings.sonarr.find(
          (sonarr) => sonarr.isDefault && sonarr.is4k === entity.is4k
        );

        if (
          entity.serverId !== null &&
          entity.serverId >= 0 &&
          sonarrSettings?.id !== entity.serverId
        ) {
          sonarrSettings = settings.sonarr.find(
            (sonarr) => sonarr.id === entity.serverId
          );
          logger.info(
            `Request has an override server: ${sonarrSettings?.name}`,
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
        }

        if (!sonarrSettings) {
          logger.warn(
            `There is no default ${
              entity.is4k ? '4K ' : ''
            }Sonarr server configured. Did you set any of your ${
              entity.is4k ? '4K ' : ''
            }Sonarr servers as default?`,
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
          return;
        }

        const media = await mediaRepository.findOne({
          where: { id: entity.media.id },
          relations: { requests: true },
        });

        if (!media) {
          throw new Error('Media data not found');
        }

        if (
          media[entity.is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE
        ) {
          logger.warn('Media already exists, marking request as APPROVED', {
            label: 'Media Request',
            requestId: entity.id,
            mediaId: entity.media.id,
          });

          if (entity.status !== MediaRequestStatus.APPROVED) {
            const requestRepository = getRepository(MediaRequest);
            entity.status = MediaRequestStatus.APPROVED;
            await requestRepository.save(entity);
          }
          return;
        }

        const tmdb = new TheMovieDb();
        const sonarr = new SonarrAPI({
          apiKey: sonarrSettings.apiKey,
          url: SonarrAPI.buildUrl(sonarrSettings, '/api/v3'),
        });
        const series = await tmdb.getTvShow({ tvId: media.tmdbId });
        const tvdbId = series.external_ids.tvdb_id ?? media.tvdbId;

        if (!tvdbId) {
          const requestRepository = getRepository(MediaRequest);
          await mediaRepository.remove(media);
          await requestRepository.remove(entity);
          throw new Error('TVDB ID not found');
        }

        let seriesType: SonarrSeries['seriesType'] = 'standard';

        // Change series type to anime if the anime keyword is present on tmdb
        if (
          series.keywords.results.some(
            (keyword) => keyword.id === ANIME_KEYWORD_ID
          )
        ) {
          seriesType = sonarrSettings.animeSeriesType ?? 'anime';
        }

        let rootFolder =
          seriesType === 'anime' && sonarrSettings.activeAnimeDirectory
            ? sonarrSettings.activeAnimeDirectory
            : sonarrSettings.activeDirectory;
        let qualityProfile =
          seriesType === 'anime' && sonarrSettings.activeAnimeProfileId
            ? sonarrSettings.activeAnimeProfileId
            : sonarrSettings.activeProfileId;
        let languageProfile =
          seriesType === 'anime' && sonarrSettings.activeAnimeLanguageProfileId
            ? sonarrSettings.activeAnimeLanguageProfileId
            : sonarrSettings.activeLanguageProfileId;
        let tags =
          seriesType === 'anime'
            ? sonarrSettings.animeTags
              ? [...sonarrSettings.animeTags]
              : []
            : sonarrSettings.tags
            ? [...sonarrSettings.tags]
            : [];

        if (
          entity.rootFolder &&
          entity.rootFolder !== '' &&
          entity.rootFolder !== rootFolder
        ) {
          rootFolder = entity.rootFolder;
          logger.info(`Request has an override root folder: ${rootFolder}`, {
            label: 'Media Request',
            requestId: entity.id,
            mediaId: entity.media.id,
          });
        }

        if (entity.profileId && entity.profileId !== qualityProfile) {
          qualityProfile = entity.profileId;
          logger.info(
            `Request has an override quality profile ID: ${qualityProfile}`,
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
        }

        if (
          entity.languageProfileId &&
          entity.languageProfileId !== languageProfile
        ) {
          languageProfile = entity.languageProfileId;
          logger.info(
            `Request has an override language profile ID: ${languageProfile}`,
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
        }

        if (entity.tags && !isEqual(entity.tags, tags)) {
          tags = entity.tags;
          logger.info(`Request has override tags`, {
            label: 'Media Request',
            requestId: entity.id,
            mediaId: entity.media.id,
            tagIds: tags,
          });
        }

        if (sonarrSettings.tagRequests) {
          const sonarrTags = await sonarr.getTags();
          // old tags had space around the hyphen
          let userTag = sonarrTags.find((v) =>
            v.label.startsWith(entity.requestedBy.id + ' - ')
          );
          // new tags do not have spaces around the hyphen, since spaces are not allowed anymore
          if (!userTag) {
            userTag = sonarrTags.find((v) =>
              v.label.startsWith(entity.requestedBy.id + '-')
            );
          }
          if (!userTag) {
            logger.info(`Requester has no active tag. Creating new`, {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
              userId: entity.requestedBy.id,
              newTag:
                entity.requestedBy.id + '-' + entity.requestedBy.displayName,
            });
            userTag = await sonarr.createTag({
              label:
                entity.requestedBy.id + '-' + entity.requestedBy.displayName,
            });
          }
          if (userTag.id) {
            if (!tags?.find((v) => v === userTag?.id)) {
              tags?.push(userTag.id);
            }
          } else {
            logger.warn(`Requester has no tag and failed to add one`, {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
              userId: entity.requestedBy.id,
              sonarrServer: sonarrSettings.hostname + ':' + sonarrSettings.port,
            });
          }
        }

        const sonarrSeriesOptions: AddSeriesOptions = {
          profileId: qualityProfile,
          languageProfileId: languageProfile,
          rootFolderPath: rootFolder,
          title: series.name,
          tvdbid: tvdbId,
          seasons: entity.seasons.map((season) => season.seasonNumber),
          seasonFolder: sonarrSettings.enableSeasonFolders,
          seriesType,
          tags,
          monitored: true,
          searchNow: !sonarrSettings.preventSearch,
        };

        // Run entity asynchronously so we don't wait for it on the UI side
        sonarr
          .addSeries(sonarrSeriesOptions)
          .then(async (sonarrSeries) => {
            // We grab media again here to make sure we have the latest version of it
            const media = await mediaRepository.findOne({
              where: { id: entity.media.id },
              relations: { requests: true },
            });

            if (!media) {
              throw new Error('Media data not found');
            }

            media[entity.is4k ? 'externalServiceId4k' : 'externalServiceId'] =
              sonarrSeries.id;
            media[
              entity.is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'
            ] = sonarrSeries.titleSlug;
            media[entity.is4k ? 'serviceId4k' : 'serviceId'] =
              sonarrSettings?.id;
            await mediaRepository.save(media);
          })
          .catch(async () => {
            const requestRepository = getRepository(MediaRequest);

            entity.status = MediaRequestStatus.FAILED;
            requestRepository.save(entity);

            logger.warn(
              'Something went wrong sending series request to Sonarr, marking status as FAILED',
              {
                label: 'Media Request',
                requestId: entity.id,
                mediaId: entity.media.id,
                sonarrSeriesOptions,
              }
            );

            MediaRequest.sendNotification(
              entity,
              media,
              Notification.MEDIA_FAILED
            );
          })
          .finally(() => {
            sonarr.clearCache({
              tvdbId,
              externalId: entity.is4k
                ? media.externalServiceId4k
                : media.externalServiceId,
              title: series.name,
            });
          });
        logger.info('Sent request to Sonarr', {
          label: 'Media Request',
          requestId: entity.id,
          mediaId: entity.media.id,
        });
      } catch (e) {
        logger.error('Something went wrong sending request to Sonarr', {
          label: 'Media Request',
          errorMessage: e.message,
          requestId: entity.id,
          mediaId: entity.media.id,
        });
        throw new Error(e.message);
      }
    }
  }

  public async sendToLidarr(entity: MediaRequest): Promise<void> {
    if (
      entity.status === MediaRequestStatus.APPROVED &&
      entity.type === MediaType.MUSIC
    ) {
      try {
        const mediaRepository = getRepository(Media);
        const settings = getSettings();

        if (settings.lidarr.length === 0 && !settings.lidarr[0]) {
          logger.info(
            'No Lidarr server configured, skipping request processing',
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
          return;
        }

        let lidarrSettings = settings.lidarr.find((lidarr) => lidarr.isDefault);

        if (
          entity.serverId !== null &&
          entity.serverId >= 0 &&
          lidarrSettings?.id !== entity.serverId
        ) {
          lidarrSettings = settings.lidarr.find(
            (lidarr) => lidarr.id === entity.serverId
          );
          logger.info(
            `Request has an override server: ${lidarrSettings?.name}`,
            {
              label: 'Media Request',
              requestId: entity.id,
              mediaId: entity.media.id,
            }
          );
        }

        if (!lidarrSettings) {
          logger.warn('There is no default Lidarr server configured.', {
            label: 'Media Request',
            requestId: entity.id,
            mediaId: entity.media.id,
          });
          return;
        }

        const media = await mediaRepository.findOne({
          where: { id: entity.media.id },
        });

        if (!media) {
          throw new Error('Media data not found');
        }

        if (media.status === MediaStatus.AVAILABLE) {
          logger.warn('Media already exists, marking request as APPROVED', {
            label: 'Media Request',
            requestId: entity.id,
            mediaId: entity.media.id,
          });

          const requestRepository = getRepository(MediaRequest);
          entity.status = MediaRequestStatus.APPROVED;
          await requestRepository.save(entity);
          return;
        }

        const lidarr = new LidarrAPI({
          apiKey: lidarrSettings.apiKey,
          url: LidarrAPI.buildUrl(lidarrSettings, '/api/v1'),
        });

        if (!media.mbId) {
          throw new Error('media.mbId is required but is undefined');
        }
        const searchResults = await lidarr.searchAlbumByMusicBrainzId(
          media.mbId
        );

        if (!searchResults?.length) {
          throw new Error('Album not found in Lidarr search');
        }

        const albumInfo = searchResults[0].album;

        let rootFolder = lidarrSettings.activeDirectory;

        if (
          entity.rootFolder &&
          entity.rootFolder !== '' &&
          entity.rootFolder !== rootFolder
        ) {
          rootFolder = entity.rootFolder;
          logger.info(`Request has an override root folder: ${rootFolder}`, {
            label: 'Media Request',
            requestId: entity.id,
            mediaId: entity.media.id,
          });
        }

        const artistPath = `${rootFolder}/${albumInfo.artist.artistName}`;

        const addAlbumPayload: LidarrAlbumOptions = {
          title: albumInfo.title,
          disambiguation: albumInfo.disambiguation || '',
          overview: albumInfo.overview,
          artistId: albumInfo.artist.id,
          foreignAlbumId: albumInfo.foreignAlbumId,
          monitored: true,
          anyReleaseOk: true,
          profileId: 1,
          duration: albumInfo.duration || 0,
          albumType: albumInfo.albumType,
          secondaryTypes: [],
          mediumCount: albumInfo.mediumCount || 0,
          ratings: albumInfo.ratings,
          releaseDate: albumInfo.releaseDate,
          releases: [],
          genres: albumInfo.genres,
          media: [],
          artist: {
            status: albumInfo.artist.status,
            ended: albumInfo.artist.ended,
            artistName: albumInfo.artist.artistName,
            foreignArtistId: albumInfo.artist.foreignArtistId,
            tadbId: albumInfo.artist.tadbId || 0,
            discogsId: albumInfo.artist.discogsId || 0,
            overview: albumInfo.artist.overview,
            artistType: albumInfo.artist.artistType,
            disambiguation: albumInfo.artist.disambiguation,
            links: albumInfo.artist.links || [],
            images: albumInfo.artist.images || [],
            path: artistPath,
            qualityProfileId: 1,
            metadataProfileId: 2,
            monitored: true,
            monitorNewItems: 'none',
            rootFolderPath: rootFolder,
            genres: albumInfo.artist.genres || [],
            cleanName: albumInfo.artist.cleanName,
            sortName: albumInfo.artist.sortName,
            tags: albumInfo.artist.tags || [],
            added: albumInfo.artist.added || new Date().toISOString(),
            ratings: albumInfo.artist.ratings,
            id: albumInfo.artist.id,
          },
          images: albumInfo.images || [],
          links: albumInfo.links || [],
          addOptions: {
            searchForNewAlbum: true,
          },
        };

        lidarr
          .addAlbum(addAlbumPayload)
          .then(async (result) => {
            const updateFields = {
              externalServiceId: result.id,
              externalServiceSlug: result.titleSlug,
              serviceId: lidarrSettings?.id,
            };

            await mediaRepository.update({ id: entity.media.id }, updateFields);

            if (addAlbumPayload.addOptions.searchForNewAlbum) {
              await lidarr.searchOnAdd(result.id);
            }
          })
          .catch(async (error) => {
            const requestRepository = getRepository(MediaRequest);

            entity.status = MediaRequestStatus.FAILED;
            await requestRepository.update(
              { id: entity.id },
              { status: MediaRequestStatus.FAILED }
            );

            logger.warn(
              'Something went wrong sending album request to Lidarr, marking status as FAILED',
              {
                label: 'Media Request',
                requestId: entity.id,
                mediaId: entity.media.id,
                error: error.message,
              }
            );

            MediaRequest.sendNotification(
              entity,
              media,
              Notification.MEDIA_FAILED
            );
          });

        logger.info('Sent request to Lidarr', {
          label: 'Media Request',
          requestId: entity.id,
          mediaId: entity.media.id,
        });
      } catch (e) {
        logger.error('Something went wrong sending request to Lidarr', {
          label: 'Media Request',
          errorMessage: e.message,
          requestId: entity.id,
          mediaId: entity.media.id,
        });
        throw new Error(e.message);
      }
    }
  }

  public async updateParentStatus(entity: MediaRequest): Promise<void> {
    const mediaRepository = getRepository(Media);
    const media = await mediaRepository.findOne({
      where: { id: entity.media.id },
      relations: { requests: true },
    });
    if (!media) {
      logger.error('Media data not found', {
        label: 'Media Request',
        requestId: entity.id,
        mediaId: entity.media.id,
      });
      return;
    }
    const seasonRequestRepository = getRepository(SeasonRequest);
    if (
      entity.status === MediaRequestStatus.APPROVED &&
      // Do not update the status if the item is already partially available or available
      media[entity.is4k ? 'status4k' : 'status'] !== MediaStatus.AVAILABLE &&
      media[entity.is4k ? 'status4k' : 'status'] !==
        MediaStatus.PARTIALLY_AVAILABLE &&
      media[entity.is4k ? 'status4k' : 'status'] !== MediaStatus.PROCESSING
    ) {
      media[entity.is4k ? 'status4k' : 'status'] = MediaStatus.PROCESSING;
      mediaRepository.save(media);
    }

    if (
      media.mediaType === MediaType.MOVIE &&
      entity.status === MediaRequestStatus.DECLINED &&
      media[entity.is4k ? 'status4k' : 'status'] !== MediaStatus.DELETED
    ) {
      media[entity.is4k ? 'status4k' : 'status'] = MediaStatus.UNKNOWN;
      mediaRepository.save(media);
    }

    /**
     * If the media type is TV, and we are declining a request,
     * we must check if its the only pending request and that
     * there the current media status is just pending (meaning no
     * other requests have yet to be approved)
     */
    if (
      media.mediaType === MediaType.TV &&
      entity.status === MediaRequestStatus.DECLINED &&
      media.requests.filter(
        (request) => request.status === MediaRequestStatus.PENDING
      ).length === 0 &&
      media[entity.is4k ? 'status4k' : 'status'] === MediaStatus.PENDING &&
      media[entity.is4k ? 'status4k' : 'status'] !== MediaStatus.DELETED
    ) {
      media[entity.is4k ? 'status4k' : 'status'] = MediaStatus.UNKNOWN;
      mediaRepository.save(media);
    }

    // Approve child seasons if parent is approved
    if (
      media.mediaType === MediaType.TV &&
      entity.status === MediaRequestStatus.APPROVED
    ) {
      entity.seasons.forEach((season) => {
        season.status = MediaRequestStatus.APPROVED;
        seasonRequestRepository.save(season);
      });
    }
  }

  public async handleRemoveParentUpdate(
    manager: EntityManager,
    entity: MediaRequest
  ): Promise<void> {
    const fullMedia = await manager.findOneOrFail(Media, {
      where: { id: entity.media.id },
      relations: { requests: true },
    });

    if (!fullMedia) return;

    if (
      !fullMedia.requests.some((request) => !request.is4k) &&
      fullMedia.status !== MediaStatus.AVAILABLE
    ) {
      fullMedia.status = MediaStatus.UNKNOWN;
    }

    if (
      !fullMedia.requests.some((request) => request.is4k) &&
      fullMedia.status4k !== MediaStatus.AVAILABLE
    ) {
      fullMedia.status4k = MediaStatus.UNKNOWN;
    }

    await manager.save(fullMedia);
  }

  public afterUpdate(event: UpdateEvent<MediaRequest>): void {
    if (!event.entity) {
      return;
    }

    this.sendToRadarr(event.entity as MediaRequest);
    this.sendToSonarr(event.entity as MediaRequest);
    this.sendToLidarr(event.entity as MediaRequest);

    this.updateParentStatus(event.entity as MediaRequest);

    if (event.entity.status === MediaRequestStatus.COMPLETED) {
      if (event.entity.media.mediaType === MediaType.MOVIE) {
        this.notifyAvailableMovie(event.entity as MediaRequest, event);
      }
      if (event.entity.media.mediaType === MediaType.TV) {
        this.notifyAvailableSeries(event.entity as MediaRequest, event);
      }
      if (event.entity.media.mediaType === MediaType.MUSIC) {
        this.notifyAvailableMusic(event.entity as MediaRequest, event);
      }
    }
  }

  public afterInsert(event: InsertEvent<MediaRequest>): void {
    if (!event.entity) {
      return;
    }

    this.sendToRadarr(event.entity as MediaRequest);
    this.sendToSonarr(event.entity as MediaRequest);
    this.sendToLidarr(event.entity as MediaRequest);

    this.updateParentStatus(event.entity as MediaRequest);
  }

  public async afterRemove(event: RemoveEvent<MediaRequest>): Promise<void> {
    if (!event.entity) {
      return;
    }

    await this.handleRemoveParentUpdate(
      event.manager as EntityManager,
      event.entity as MediaRequest
    );
  }

  public listenTo(): typeof MediaRequest {
    return MediaRequest;
  }
}
