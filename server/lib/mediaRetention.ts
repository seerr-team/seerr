import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import MediaRequest from '@server/entity/MediaRequest';
import { removeMediaRequest } from '@server/lib/mediaDeletion';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

class MediaRetention {
  public running = false;

  public async run(): Promise<void> {
    const { movie, tv } = getSettings().main.mediaRetention;

    if (!movie.enabled && !tv.enabled) {
      return;
    }

    this.running = true;

    const enabledTypes = [
      ...(movie.enabled ? [MediaType.MOVIE] : []),
      ...(tv.enabled ? [MediaType.TV] : []),
    ];

    try {
      logger.info('Starting media retention check...', {
        label: 'MediaRetention',
      });

      const requestRepository = getRepository(MediaRequest);
      const pageSize = 50;
      let lastId = 0;
      let page: MediaRequest[];

      do {
        if (!this.running) {
          throw new Error('Job aborted');
        }

        // Cursor by id, not skip/offset, since processing removes rows.
        page = await requestRepository
          .createQueryBuilder('request')
          .leftJoinAndSelect('request.media', 'media')
          .where('request.id > :lastId', { lastId })
          .andWhere('request.status IN (:...statuses)', {
            statuses: [
              MediaRequestStatus.APPROVED,
              MediaRequestStatus.COMPLETED,
            ],
          })
          .andWhere('request.type IN (:...types)', { types: enabledTypes })
          // null retentionDays means kept indefinitely - never processed here.
          .andWhere('request.retentionDays IS NOT NULL')
          .andWhere(
            '((request.is4k = false AND media.status IN (:...availableStatuses)) OR (request.is4k = true AND media.status4k IN (:...availableStatuses)))',
            {
              availableStatuses: [
                MediaStatus.AVAILABLE,
                MediaStatus.PARTIALLY_AVAILABLE,
              ],
            }
          )
          .orderBy('request.id', 'ASC')
          .take(pageSize)
          .getMany();

        for (const request of page) {
          if (!this.running) {
            throw new Error('Job aborted');
          }
          await this.processRequest(request);
        }

        if (page.length > 0) {
          lastId = page[page.length - 1].id;
        }
      } while (page.length === pageSize);
    } catch (ex) {
      logger.error('Failed to complete media retention check.', {
        errorMessage: ex.message,
        label: 'MediaRetention',
      });
    } finally {
      logger.info('Media retention check complete.', {
        label: 'MediaRetention',
      });
      this.running = false;
    }
  }

  public cancel(): void {
    this.running = false;
  }

  private async processRequest(request: MediaRequest): Promise<void> {
    const requestRepository = getRepository(MediaRequest);

    try {
      // Start the retention clock on first observed availability.
      if (!request.availableSince) {
        request.availableSince = new Date();
        await requestRepository.save(request);
        return;
      }

      const expiresAt = new Date(request.availableSince);
      expiresAt.setDate(expiresAt.getDate() + (request.retentionDays ?? 0));

      if (expiresAt > new Date()) {
        return;
      }

      logger.info(
        `Retention period expired for the ${
          request.is4k ? '4K ' : ''
        }${request.type === MediaType.MOVIE ? 'movie' : 'show'} [TMDB ID ${
          request.media.tmdbId
        }]. Removing.`,
        { label: 'MediaRetention', requestId: request.id }
      );

      await removeMediaRequest(request);
    } catch (ex) {
      logger.error('Failed to process media retention for request.', {
        errorMessage: ex.message,
        label: 'MediaRetention',
        requestId: request.id,
      });
    }
  }
}

const mediaRetention = new MediaRetention();

export default mediaRetention;
