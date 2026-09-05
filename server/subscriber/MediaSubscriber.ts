import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import SeasonRequest from '@server/entity/SeasonRequest';
import { grantLibraryAccessForRequest } from '@server/lib/librarysharing';
import logger from '@server/logger';
import { withNestedTransaction } from '@server/utils/nestedTransaction';
import type {
  EntityManager,
  EntitySubscriberInterface,
  UpdateEvent,
} from 'typeorm';
import { EventSubscriber, In } from 'typeorm';

@EventSubscriber()
export class MediaSubscriber implements EntitySubscriberInterface<Media> {
  private async updateChildRequestStatus(
    manager: EntityManager,
    event: Media,
    is4k: boolean
  ) {
    const requestRepository = manager.getRepository(MediaRequest);

    const requests = await requestRepository.find({
      where: { media: { id: event.id } },
    });

    for (const request of requests) {
      if (
        request.is4k === is4k &&
        request.status === MediaRequestStatus.PENDING
      ) {
        request.status = MediaRequestStatus.APPROVED;
        await requestRepository.save(request);
      }
    }
  }

  private async updateRelatedMediaRequest(
    manager: EntityManager,
    event: Media,
    databaseEvent: Media,
    is4k: boolean
  ) {
    const requestRepository = manager.getRepository(MediaRequest);
    const seasonRequestRepository = manager.getRepository(SeasonRequest);

    const relatedRequests = await requestRepository.find({
      relations: {
        media: true,
      },
      where: {
        media: { id: event.id },
        status: In([MediaRequestStatus.APPROVED, MediaRequestStatus.FAILED]),
        is4k,
      },
    });

    // Check the media entity status and if available
    // or deleted, set the related request to completed
    if (relatedRequests.length > 0) {
      const completedRequests: MediaRequest[] = [];

      for (const request of relatedRequests) {
        let shouldComplete = false;

        if (
          (event[request.is4k ? 'status4k' : 'status'] ===
            MediaStatus.AVAILABLE ||
            event[request.is4k ? 'status4k' : 'status'] ===
              MediaStatus.DELETED) &&
          event.mediaType === MediaType.MOVIE
        ) {
          shouldComplete = true;
        } else if (event.mediaType === 'tv') {
          const allSeasonResults: boolean[] = [];

          // Sequential on purpose as these saves share the transaction's connection
          for (const requestSeason of request.seasons) {
            const matchingSeason = event.seasons.find(
              (mediaSeason) =>
                mediaSeason.seasonNumber === requestSeason.seasonNumber
            );
            const matchingOldSeason = databaseEvent.seasons.find(
              (oldSeason) =>
                oldSeason.seasonNumber === requestSeason.seasonNumber
            );

            if (!matchingSeason) {
              allSeasonResults.push(false);
              continue;
            }

            const currentSeasonStatus =
              matchingSeason[request.is4k ? 'status4k' : 'status'];
            const previousSeasonStatus =
              matchingOldSeason?.[request.is4k ? 'status4k' : 'status'];

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

              allSeasonResults.push(true);
              continue;
            }

            allSeasonResults.push(false);
          }

          const allSeasonsReady = allSeasonResults.every((result) => result);
          shouldComplete = allSeasonsReady;
        }

        if (shouldComplete) {
          request.status = MediaRequestStatus.COMPLETED;
          completedRequests.push(request);
        }
      }

      await requestRepository.save(completedRequests);

      return completedRequests;
    }

    return [];
  }

  /**
   * Grants the requester access to the media their request was just completed
   * by, when the owner opted into it.
   *
   * The other half of the grant done when the library already held the media:
   * most requests are downloaded rather than already present, and without this
   * a restricted user still cannot see what they requested.
   *
   * Deliberately run outside the transaction that completed the requests, since
   * granting talks to plex.tv and to the media server, which must not happen
   * with a write lock held.
   */
  private async grantLibraryAccessForCompleted(
    completedRequests: MediaRequest[],
    event: Media,
    databaseEvent: Media,
    is4k: boolean
  ): Promise<void> {
    // A request also completes when the media is marked deleted, and the rating
    // key survives that for as long as a request is still active, so that case
    // is skipped rather than left to fail against Plex.
    if ((is4k ? event.status4k : event.status) === MediaStatus.DELETED) {
      return;
    }

    // Read from the entity being saved, since the scanner sets the rating key
    // in the same write that makes the media available.
    const ratingKey = is4k
      ? (event.ratingKey4k ?? databaseEvent.ratingKey4k)
      : (event.ratingKey ?? databaseEvent.ratingKey);

    for (const request of completedRequests) {
      await grantLibraryAccessForRequest(
        request.requestedBy,
        ratingKey,
        request.type,
        request.id
      );
    }
  }

  public async beforeUpdate(event: UpdateEvent<Media>): Promise<void> {
    if (!event.entity || !event.databaseEntity) {
      return;
    }

    try {
      if (
        event.entity.status === MediaStatus.AVAILABLE &&
        event.databaseEntity?.status === MediaStatus.PENDING
      ) {
        await withNestedTransaction(event.manager, async (manager) => {
          await this.updateChildRequestStatus(
            manager,
            event.entity as Media,
            false
          );
        });
      }
    } catch (e) {
      logger.error(
        'Error while updating child request status in beforeUpdate subscriber',
        {
          label: 'Media',
          mediaId: event.entity.id,
          is4k: false,
          errorMessage: e instanceof Error ? e.message : String(e),
        }
      );
    }

    try {
      if (
        event.entity.status4k === MediaStatus.AVAILABLE &&
        event.databaseEntity?.status4k === MediaStatus.PENDING
      ) {
        await withNestedTransaction(event.manager, async (manager) => {
          await this.updateChildRequestStatus(
            manager,
            event.entity as Media,
            true
          );
        });
      }
    } catch (e) {
      logger.error(
        'Error while updating child request status in beforeUpdate subscriber',
        {
          label: 'Media',
          mediaId: event.entity.id,
          is4k: true,
          errorMessage: e instanceof Error ? e.message : String(e),
        }
      );
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
    if (!event.entity || !event.databaseEntity) {
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

    try {
      if (
        (event.entity.status !== event.databaseEntity?.status ||
          (event.entity.mediaType === MediaType.TV &&
            seasonStatusCheck(false))) &&
        validStatuses.includes(event.entity.status)
      ) {
        const completedRequests = await withNestedTransaction(
          event.manager,
          async (manager) =>
            this.updateRelatedMediaRequest(
              manager,
              event.entity as Media,
              event.databaseEntity as Media,
              false
            )
        );

        await this.grantLibraryAccessForCompleted(
          completedRequests,
          event.entity as Media,
          event.databaseEntity as Media,
          false
        );
      }
    } catch (e) {
      logger.error(
        'Error while updating related requests in afterUpdate subscriber',
        {
          label: 'Media',
          mediaId: event.entity.id,
          is4k: false,
          errorMessage: e instanceof Error ? e.message : String(e),
        }
      );
    }

    try {
      if (
        (event.entity.status4k !== event.databaseEntity?.status4k ||
          (event.entity.mediaType === MediaType.TV &&
            seasonStatusCheck(true))) &&
        validStatuses.includes(event.entity.status4k)
      ) {
        const completedRequests = await withNestedTransaction(
          event.manager,
          async (manager) =>
            this.updateRelatedMediaRequest(
              manager,
              event.entity as Media,
              event.databaseEntity as Media,
              true
            )
        );

        await this.grantLibraryAccessForCompleted(
          completedRequests,
          event.entity as Media,
          event.databaseEntity as Media,
          true
        );
      }
    } catch (e) {
      logger.error(
        'Error while updating related requests in afterUpdate subscriber',
        {
          label: 'Media',
          mediaId: event.entity.id,
          is4k: true,
          errorMessage: e instanceof Error ? e.message : String(e),
        }
      );
    }
  }

  public listenTo(): typeof Media {
    return Media;
  }
}
