import { getRepository } from '@server/datasource';
import { Vote } from '@server/entity/Vote';
import type {
  VoteHistoryResponse,
  VoteLookupResponse,
  VoteUpsertResponse,
} from '@server/interfaces/api/voteInterfaces';
import {
  voteCreate,
  voteHistoryQuery,
  votePathParams,
} from '@server/interfaces/api/voteInterfaces';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';
import { ZodError } from 'zod';

const voteRoutes = Router();

voteRoutes.use((_req, res, next) => {
  if (!getSettings().main.enableVoting) {
    return next({
      status: 403,
      message: 'Voting is currently disabled.',
    });
  }

  return next();
});

voteRoutes.get<never, VoteHistoryResponse>(
  '/history',
  async (req, res, next) => {
    // Satisfy typescript here. User is set by router middleware.
    if (!req.user) {
      return next({ status: 500, message: 'User missing from request.' });
    }

    try {
      const { take, skip } = voteHistoryQuery.parse(req.query);
      const voteRepository = getRepository(Vote);
      const [votes, total] = await voteRepository.findAndCount({
        where: { user: { id: req.user.id } },
        order: { createdAt: 'DESC' },
        take,
        skip,
      });

      return res.status(200).json({
        pageInfo: {
          pages: Math.ceil(total / take),
          pageSize: take,
          results: total,
          page: Math.ceil(skip / take) + 1,
        },
        results: votes,
      });
    } catch (e) {
      if (e instanceof ZodError) {
        return next({ status: 400, message: 'Invalid vote history query.' });
      }
      logger.debug('Something went wrong retrieving vote history.', {
        label: 'API',
        errorMessage: e instanceof Error ? e.message : undefined,
      });

      return next({ status: 500, message: 'Unable to retrieve vote history.' });
    }
  }
);

voteRoutes.get<{ mediaType: string; tmdbId: string }, VoteLookupResponse>(
  '/:mediaType/:tmdbId',
  async (req, res, next) => {
    // Satisfy typescript here. User is set by router middleware.
    if (!req.user) {
      return next({ status: 500, message: 'User missing from request.' });
    }

    try {
      const { mediaType, tmdbId } = votePathParams.parse(req.params);
      const voteRepository = getRepository(Vote);
      const vote = await voteRepository.findOne({
        where: {
          user: { id: req.user.id },
          tmdbId,
          mediaType,
        },
      });

      return res.status(200).json({ vote });
    } catch (e) {
      if (e instanceof ZodError) {
        return next({
          status: 400,
          message: 'Invalid vote lookup parameters.',
        });
      }
      logger.debug('Something went wrong retrieving vote.', {
        label: 'API',
        errorMessage: e instanceof Error ? e.message : undefined,
      });

      return next({ status: 500, message: 'Unable to retrieve vote.' });
    }
  }
);

voteRoutes.post<never, VoteUpsertResponse>('/', async (req, res, next) => {
  // Satisfy typescript here. User is set by router middleware.
  if (!req.user) {
    return next({ status: 500, message: 'User missing from request.' });
  }

  try {
    const { tmdbId, mediaType, actionType } = voteCreate.parse(req.body);
    const voteRepository = getRepository(Vote);
    const existingVote = await voteRepository.findOne({
      where: {
        user: { id: req.user.id },
        tmdbId,
        mediaType,
      },
    });

    if (existingVote) {
      existingVote.actionType = actionType;
      const updatedVote = await voteRepository.save(existingVote);

      return res.status(200).json({
        ...updatedVote,
        created: false,
      });
    }

    const vote = await voteRepository.save(
      new Vote({
        user: req.user,
        tmdbId,
        mediaType,
        actionType,
      })
    );

    return res.status(201).json({
      ...vote,
      created: true,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      return next({ status: 400, message: 'Invalid vote payload.' });
    }
    logger.debug('Something went wrong creating or updating a vote.', {
      label: 'API',
      errorMessage: e instanceof Error ? e.message : undefined,
    });

    return next({ status: 500, message: 'Unable to submit vote.' });
  }
});

voteRoutes.delete<{ mediaType: string; tmdbId: string }>(
  '/:mediaType/:tmdbId',
  async (req, res, next) => {
    // Satisfy typescript here. User is set by router middleware.
    if (!req.user) {
      return next({ status: 500, message: 'User missing from request.' });
    }

    try {
      const { mediaType, tmdbId } = votePathParams.parse(req.params);
      const voteRepository = getRepository(Vote);
      const existingVote = await voteRepository.findOne({
        where: {
          user: { id: req.user.id },
          tmdbId,
          mediaType,
        },
      });

      if (!existingVote) {
        return next({ status: 404, message: 'Vote not found.' });
      }

      await voteRepository.remove(existingVote);
      return res.status(204).send();
    } catch (e) {
      if (e instanceof ZodError) {
        return next({
          status: 400,
          message: 'Invalid vote delete parameters.',
        });
      }
      logger.debug('Something went wrong deleting vote.', {
        label: 'API',
        errorMessage: e instanceof Error ? e.message : undefined,
      });

      return next({ status: 500, message: 'Unable to delete vote.' });
    }
  }
);

export default voteRoutes;
