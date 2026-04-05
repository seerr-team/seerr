import { MediaRemovalRequestStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRemovalRequest } from '@server/entity/MediaRemovalRequest';
import { MediaRequest } from '@server/entity/MediaRequest';
import { Permission, hasPermission } from '@server/lib/permissions';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';

const MAX_REASON_LENGTH = 1000;
const MAX_PAGE_SIZE = 100;

const removalRequestRoutes = Router();

// GET /removal-request - List removal requests
removalRequestRoutes.get('/', async (req, res, next) => {
  try {
    const removalRequestRepository = getRepository(MediaRemovalRequest);
    const rawTake = Number(req.query.take);
    const rawSkip = Number(req.query.skip);
    const pageSize =
      Number.isFinite(rawTake) && rawTake > 0
        ? Math.min(Math.floor(rawTake), MAX_PAGE_SIZE)
        : 10;
    const skip =
      Number.isFinite(rawSkip) && rawSkip >= 0 ? Math.floor(rawSkip) : 0;

    let statusFilter: MediaRemovalRequestStatus[];

    switch (req.query.filter) {
      case 'pending':
        statusFilter = [MediaRemovalRequestStatus.PENDING];
        break;
      case 'approved':
        statusFilter = [MediaRemovalRequestStatus.APPROVED];
        break;
      case 'declined':
        statusFilter = [MediaRemovalRequestStatus.DECLINED];
        break;
      case 'failed':
        statusFilter = [MediaRemovalRequestStatus.FAILED];
        break;
      default:
        statusFilter = [
          MediaRemovalRequestStatus.PENDING,
          MediaRemovalRequestStatus.APPROVED,
          MediaRemovalRequestStatus.DECLINED,
          MediaRemovalRequestStatus.FAILED,
        ];
    }

    let query = removalRequestRepository
      .createQueryBuilder('removalRequest')
      .leftJoinAndSelect('removalRequest.media', 'media')
      .leftJoinAndSelect('removalRequest.requestedBy', 'requestedBy')
      .leftJoinAndSelect('removalRequest.modifiedBy', 'modifiedBy')
      .where('removalRequest.status IN (:...statusFilter)', { statusFilter });

    // Non-privileged users can only see their own removal requests
    if (
      !req.user?.hasPermission(
        [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
        { type: 'or' }
      )
    ) {
      query = query.andWhere('requestedBy.id = :userId', {
        userId: req.user?.id,
      });
    } else if (req.query.requestedBy) {
      query = query.andWhere('requestedBy.id = :userId', {
        userId: Number(req.query.requestedBy),
      });
    }

    const [results, totalCount] = await query
      .orderBy('removalRequest.id', 'DESC')
      .take(pageSize)
      .skip(skip)
      .getManyAndCount();

    return res.status(200).json({
      pageInfo: {
        pages: Math.ceil(totalCount / pageSize),
        pageSize,
        results: totalCount,
        page: Math.ceil(skip / pageSize) + 1,
      },
      results,
    });
  } catch (e) {
    logger.error('Failed to retrieve removal requests', {
      label: 'API',
      errorMessage: e.message,
    });
    next({ status: 500, message: e.message });
  }
});

// POST /removal-request - Create a new removal request
removalRequestRoutes.post(
  '/',
  isAuthenticated(Permission.REQUEST_REMOVAL),
  async (req, res, next) => {
    try {
      if (!req.user) {
        return next({ status: 401, message: 'Not authenticated.' });
      }

      const mediaRepository = getRepository(Media);
      const removalRequestRepository = getRepository(MediaRemovalRequest);

      const { mediaId, is4k, reason, seasons } = req.body as {
        mediaId: number;
        is4k?: boolean;
        reason?: string;
        seasons?: number[];
      };

      if (!mediaId) {
        return next({ status: 400, message: 'mediaId is required.' });
      }

      if (reason && reason.length > MAX_REASON_LENGTH) {
        return next({
          status: 400,
          message: `Reason must be ${MAX_REASON_LENGTH} characters or fewer.`,
        });
      }

      if (seasons) {
        if (
          !Array.isArray(seasons) ||
          seasons.some(
            (s) => typeof s !== 'number' || !Number.isInteger(s) || s < 1
          )
        ) {
          return next({
            status: 400,
            message: 'Seasons must be an array of positive integers.',
          });
        }
      }

      const media = await mediaRepository.findOne({
        where: { id: mediaId },
      });

      if (!media) {
        return next({ status: 404, message: 'Media not found.' });
      }

      // Reject seasons for movie media
      if (seasons?.length && media.mediaType === MediaType.MOVIE) {
        return next({
          status: 400,
          message: 'Season-level removal is not supported for movies.',
        });
      }

      // Unless user has REMOVAL_ALL, restrict to media they originally requested
      if (
        !hasPermission(Permission.REMOVAL_ALL, req.user!.permissions) &&
        !hasPermission(Permission.ADMIN, req.user!.permissions)
      ) {
        const mediaRequestRepository = getRepository(MediaRequest);
        const userRequest = await mediaRequestRepository.findOne({
          where: {
            media: { id: media.id },
            requestedBy: { id: req.user!.id },
          },
        });

        if (!userRequest) {
          return next({
            status: 403,
            message:
              'You can only request removal of media you originally requested.',
          });
        }
      }

      // Check for existing pending removal request for this media/is4k combo
      const existingRequests = await removalRequestRepository.find({
        where: {
          media: { id: media.id },
          is4k: is4k ?? false,
          status: MediaRemovalRequestStatus.PENDING,
        },
      });

      // Check for exact duplicate (full-media removal already pending)
      const hasFullPending = existingRequests.some((r) => !r.seasons?.length);
      if (hasFullPending) {
        return next({
          status: 409,
          message: 'A pending removal request already exists for this media.',
        });
      }

      // If this is a season request, check for overlap with existing season requests
      if (seasons?.length) {
        const alreadyPendingSeasons = new Set(
          existingRequests.flatMap((r) => r.seasons ?? [])
        );
        const overlapping = seasons.filter((s) => alreadyPendingSeasons.has(s));
        if (overlapping.length > 0) {
          return next({
            status: 409,
            message: `Seasons ${overlapping.join(', ')} already have pending removal requests.`,
          });
        }
      }

      // If this is a full removal but season requests exist, reject
      if (!seasons?.length && existingRequests.some((r) => r.seasons?.length)) {
        return next({
          status: 409,
          message:
            'There are pending season-level removal requests for this media. Resolve those first.',
        });
      }

      const autoApprove = MediaRemovalRequest.shouldAutoApprove(req.user);

      const removalRequest = new MediaRemovalRequest({
        media,
        requestedBy: req.user,
        is4k: is4k ?? false,
        seasons: seasons?.length ? seasons : undefined,
        reason: reason ?? undefined,
        status: autoApprove
          ? MediaRemovalRequestStatus.APPROVED
          : MediaRemovalRequestStatus.PENDING,
        modifiedBy: autoApprove ? req.user : undefined,
      });

      await removalRequestRepository.save(removalRequest);

      // If auto-approved, execute the removal immediately
      if (autoApprove) {
        try {
          await removalRequest.executeRemoval();
        } catch (e) {
          logger.error('Failed to execute auto-approved removal request', {
            label: 'MediaRemovalRequest',
            errorMessage: e.message,
            requestId: removalRequest.id,
          });
          removalRequest.status = MediaRemovalRequestStatus.FAILED;
          await removalRequestRepository.save(removalRequest);
        }
      }

      // Reload to get fresh state (media may have been deleted by executeRemoval)
      const saved = await removalRequestRepository.findOne({
        where: { id: removalRequest.id },
      });

      return res.status(201).json(saved ?? removalRequest);
    } catch (e) {
      logger.error('Failed to create removal request', {
        label: 'API',
        errorMessage: e.message,
      });
      next({ status: 500, message: e.message });
    }
  }
);

// POST /removal-request/:id/approve - Approve a removal request
removalRequestRoutes.post(
  '/:id/approve',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    try {
      const removalRequestRepository = getRepository(MediaRemovalRequest);

      const removalRequest = await removalRequestRepository.findOneOrFail({
        where: { id: Number(req.params.id) },
      });

      if (removalRequest.status !== MediaRemovalRequestStatus.PENDING) {
        return next({
          status: 400,
          message: 'This request is not pending.',
        });
      }

      removalRequest.status = MediaRemovalRequestStatus.APPROVED;
      removalRequest.modifiedBy = req.user;
      await removalRequestRepository.save(removalRequest);

      // Execute the removal
      try {
        await removalRequest.executeRemoval();
      } catch (e) {
        logger.error('Failed to execute approved removal request', {
          label: 'MediaRemovalRequest',
          errorMessage: e.message,
          requestId: removalRequest.id,
        });
        removalRequest.status = MediaRemovalRequestStatus.FAILED;
        await removalRequestRepository.save(removalRequest);
      }

      // Reload to get fresh state
      const saved = await removalRequestRepository.findOne({
        where: { id: removalRequest.id },
      });

      return res.status(200).json(saved ?? removalRequest);
    } catch (e) {
      logger.error('Failed to approve removal request', {
        label: 'API',
        errorMessage: e.message,
      });
      next({ status: 404, message: 'Removal request not found.' });
    }
  }
);

// POST /removal-request/:id/decline - Decline a removal request
removalRequestRoutes.post(
  '/:id/decline',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    try {
      const removalRequestRepository = getRepository(MediaRemovalRequest);

      const removalRequest = await removalRequestRepository.findOneOrFail({
        where: { id: Number(req.params.id) },
      });

      if (removalRequest.status !== MediaRemovalRequestStatus.PENDING) {
        return next({
          status: 400,
          message: 'This request is not pending.',
        });
      }

      removalRequest.status = MediaRemovalRequestStatus.DECLINED;
      removalRequest.modifiedBy = req.user;
      await removalRequestRepository.save(removalRequest);

      return res.status(200).json(removalRequest);
    } catch (e) {
      logger.error('Failed to decline removal request', {
        label: 'API',
        errorMessage: e.message,
      });
      next({ status: 404, message: 'Removal request not found.' });
    }
  }
);

// POST /removal-request/:id/retry - Retry a failed removal request
removalRequestRoutes.post(
  '/:id/retry',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    try {
      const removalRequestRepository = getRepository(MediaRemovalRequest);

      const removalRequest = await removalRequestRepository.findOneOrFail({
        where: { id: Number(req.params.id) },
      });

      if (removalRequest.status !== MediaRemovalRequestStatus.FAILED) {
        return next({
          status: 400,
          message: 'Only failed requests can be retried.',
        });
      }

      removalRequest.status = MediaRemovalRequestStatus.APPROVED;
      removalRequest.modifiedBy = req.user;
      await removalRequestRepository.save(removalRequest);

      try {
        await removalRequest.executeRemoval();
      } catch (e) {
        logger.error('Failed to execute retried removal request', {
          label: 'MediaRemovalRequest',
          errorMessage: e.message,
          requestId: removalRequest.id,
        });
        removalRequest.status = MediaRemovalRequestStatus.FAILED;
        await removalRequestRepository.save(removalRequest);
      }

      // Reload to get fresh state
      const saved = await removalRequestRepository.findOne({
        where: { id: removalRequest.id },
      });

      return res.status(200).json(saved ?? removalRequest);
    } catch (e) {
      logger.error('Failed to retry removal request', {
        label: 'API',
        errorMessage: e.message,
      });
      next({ status: 404, message: 'Removal request not found.' });
    }
  }
);

// DELETE /removal-request/:id - Delete a removal request
removalRequestRoutes.delete(
  '/:id',
  isAuthenticated(),
  async (req, res, next) => {
    try {
      const removalRequestRepository = getRepository(MediaRemovalRequest);

      const removalRequest = await removalRequestRepository.findOneOrFail({
        where: { id: Number(req.params.id) },
      });

      // Only the requester or an admin/manage-requests user can delete
      if (
        !req.user?.hasPermission(Permission.MANAGE_REQUESTS) &&
        removalRequest.requestedBy.id !== req.user?.id
      ) {
        return next({
          status: 403,
          message: 'You do not have permission to delete this removal request.',
        });
      }

      await removalRequestRepository.remove(removalRequest);

      return res.status(204).send();
    } catch (e) {
      logger.error('Failed to delete removal request', {
        label: 'API',
        errorMessage: e.message,
      });
      next({ status: 404, message: 'Removal request not found.' });
    }
  }
);

export default removalRequestRoutes;
