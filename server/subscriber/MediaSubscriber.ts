import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import SeasonRequest from '@server/entity/SeasonRequest';
import type { EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { EventSubscriber } from 'typeorm';

@EventSubscriber()
export class MediaSubscriber implements EntitySubscriberInterface<Media> {
  private async updateChildRequestStatus(event: Media, isAlt: boolean) {
    const requestRepository = getRepository(MediaRequest);

    const requests = await requestRepository.find({
      where: { media: { id: event.id } },
    });

    for (const request of requests) {
      if (
        request.isAlt === isAlt &&
        request.status === MediaRequestStatus.PENDING
      ) {
        request.status = MediaRequestStatus.APPROVED;
        await requestRepository.save(request);
      }
    }
  }

  private async updateRelatedMediaRequest(
    event: Media,
    databaseEvent: Media,
    isAlt: boolean
  ) {
    const requestRepository = getRepository(MediaRequest);
    const seasonRequestRepository = getRepository(SeasonRequest);

    const relatedRequests = await requestRepository.find({
      relations: {
        media: true,
      },
      where: {
        media: { id: event.id },
        status: MediaRequestStatus.APPROVED,
        isAlt,
      },
    });

    // Check the media entity status and if available
    // or deleted, set the related request to completed
    if (relatedRequests.length > 0) {
      const completedRequests: MediaRequest[] = [];

      for (const request of relatedRequests) {
        let shouldComplete = false;

        if (
          (event[request.isAlt ? 'statusAlt' : 'status'] ===
            MediaStatus.AVAILABLE ||
            event[request.isAlt ? 'statusAlt' : 'status'] ===
              MediaStatus.DELETED) &&
          (event.mediaType === MediaType.MOVIE ||
            event.mediaType === MediaType.BOOK)
        ) {
          shouldComplete = true;
        } else if (event.mediaType === 'tv') {
          const allSeasonResults = await Promise.all(
            request.seasons.map(async (requestSeason) => {
              const matchingSeason = event.seasons.find(
                (mediaSeason) =>
                  mediaSeason.seasonNumber === requestSeason.seasonNumber
              );
              const matchingOldSeason = databaseEvent.seasons.find(
                (oldSeason) =>
                  oldSeason.seasonNumber === requestSeason.seasonNumber
              );

              if (!matchingSeason) {
                return false;
              }

              const currentSeasonStatus =
                matchingSeason[request.isAlt ? 'status4k' : 'status'];
              const previousSeasonStatus =
                matchingOldSeason?.[request.isAlt ? 'status4k' : 'status'];

              const hasStatusChanged =
                currentSeasonStatus !== previousSeasonStatus;

              const shouldUpdate =
                (hasStatusChanged ||
                  requestSeason.status === MediaRequestStatus.COMPLETED) &&
                (currentSeasonStatus === MediaStatus.AVAILABLE ||
                  currentSeasonStatus === MediaStatus.DELETED);

              if (shouldUpdate) {
                requestSeason.status = MediaRequestStatus.COMPLETED;
                await seasonRequestRepository.save(requestSeason);

                return true;
              }

              return false;
            })
          );

          const allSeasonsReady = allSeasonResults.every((result) => result);
          shouldComplete = allSeasonsReady;
        }

        if (shouldComplete) {
          request.status = MediaRequestStatus.COMPLETED;
          completedRequests.push(request);
        }
      }

      await requestRepository.save(completedRequests);
    }
  }

  public async beforeUpdate(event: UpdateEvent<Media>): Promise<void> {
    if (!event.entity) {
      return;
    }

    if (
      event.entity.status === MediaStatus.AVAILABLE &&
      event.databaseEntity.status === MediaStatus.PENDING
    ) {
      this.updateChildRequestStatus(event.entity as Media, false);
    }

    if (
      event.entity.statusAlt === MediaStatus.AVAILABLE &&
      event.databaseEntity.statusAlt === MediaStatus.PENDING
    ) {
      this.updateChildRequestStatus(event.entity as Media, true);
    }

    // Manually load related seasons into databaseEntity
    // for seasonStatusCheck in afterUpdate
    const seasons = await event.manager
      .getRepository(Season)
      .createQueryBuilder('season')
      .leftJoin('season.media', 'media')
      .where('media.id = :id', { id: event.databaseEntity.id })
      .getMany();

    event.databaseEntity.seasons = seasons;
  }

  public async afterUpdate(event: UpdateEvent<Media>): Promise<void> {
    if (!event.entity) {
      return;
    }

    const validStatuses = [
      MediaStatus.PARTIALLY_AVAILABLE,
      MediaStatus.AVAILABLE,
      MediaStatus.DELETED,
    ];

    const seasonStatusCheck = (is4k: boolean) => {
      return event.entity?.seasons?.some((season: Season, index: number) => {
        const previousSeason = event.databaseEntity.seasons[index];

        return (
          season[is4k ? 'status4k' : 'status'] !==
          previousSeason?.[is4k ? 'status4k' : 'status']
        );
      });
    };

    if (
      (event.entity.status !== event.databaseEntity?.status ||
        (event.entity.mediaType === MediaType.TV &&
          seasonStatusCheck(false))) &&
      validStatuses.includes(event.entity.status)
    ) {
      this.updateRelatedMediaRequest(
        event.entity as Media,
        event.databaseEntity as Media,
        false
      );
    }

    if (
      (event.entity.statusAlt !== event.databaseEntity?.statusAlt ||
        (event.entity.mediaType === MediaType.TV && seasonStatusCheck(true))) &&
      validStatuses.includes(event.entity.statusAlt)
    ) {
      this.updateRelatedMediaRequest(
        event.entity as Media,
        event.databaseEntity as Media,
        true
      );
    }
  }

  public listenTo(): typeof Media {
    return Media;
  }
}
