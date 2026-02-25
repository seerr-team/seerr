import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import Media from '@server/entity/Media';
import type { BlocklistResultsResponse } from '@server/interfaces/api/blocklistInterfaces';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { z } from 'zod';

const blocklistRoutes = Router();

export const blocklistAdd = z.object({
  tmdbId: z.coerce.number(),
  mediaType: z.nativeEnum(MediaType),
  title: z.coerce.string().optional(),
  user: z.coerce.number(),
});

const blocklistGet = z.object({
  take: z.coerce.number().int().positive().default(25),
  skip: z.coerce.number().int().nonnegative().default(0),
  search: z.string().optional(),
  filter: z.enum(['all', 'manual', 'blocklistedTags']).optional(),
});

blocklistRoutes.get(
  '/',
  isAuthenticated([Permission.MANAGE_BLOCKLIST, Permission.VIEW_BLOCKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    const { take, skip, search, filter } = blocklistGet.parse(req.query);

    try {
      let query = getRepository(Blocklist)
        .createQueryBuilder('blocklist')
        .leftJoinAndSelect('blocklist.user', 'user')
        .where('1 = 1'); // Allow use of andWhere later

      switch (filter) {
        case 'manual':
          query = query.andWhere('blocklist.blocklistedTags IS NULL');
          break;
        case 'blocklistedTags':
          query = query.andWhere('blocklist.blocklistedTags IS NOT NULL');
          break;
      }

      if (search) {
        query = query.andWhere('blocklist.title like :title', {
          title: `%${search}%`,
        });
      }

      const [blocklistedItems, itemsCount] = await query
        .orderBy('blocklist.createdAt', 'DESC')
        .take(take)
        .skip(skip)
        .getManyAndCount();

      return res.status(200).json({
        pageInfo: {
          pages: Math.ceil(itemsCount / take),
          pageSize: take,
          results: itemsCount,
          page: Math.ceil(skip / take) + 1,
        },
        results: blocklistedItems,
      } as BlocklistResultsResponse);
    } catch (error) {
      logger.error('Something went wrong while retrieving blocklisted items', {
        label: 'Blocklist',
        errorMessage: error.message,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve blocklisted items.',
      });
    }
  }
);

blocklistRoutes.get(
  '/:id',
  isAuthenticated([Permission.MANAGE_BLOCKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    const mediaType = req.query.mediaType;
    if (mediaType !== MediaType.MOVIE && mediaType !== MediaType.TV) {
      return next({
        status: 400,
        message: 'Invalid or missing mediaType query parameter.',
      });
    }

    try {
      const blocklisteRepository = getRepository(Blocklist);

      const blocklistItem = await blocklisteRepository.findOneOrFail({
        where: {
          tmdbId: Number(req.params.id),
          mediaType,
        },
      });

      return res.status(200).send(blocklistItem);
    } catch (e) {
      if (e instanceof EntityNotFoundError) {
        return next({
          status: 401,
          message: e.message,
        });
      }
      return next({ status: 500, message: e.message });
    }
  }
);

blocklistRoutes.post(
  '/',
  isAuthenticated([Permission.MANAGE_BLOCKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const values = blocklistAdd.parse(req.body);

      await Blocklist.addToBlocklist({
        blocklistRequest: values,
      });

      return res.status(201).send();
    } catch (error) {
      if (!(error instanceof Error)) {
        return;
      }

      if (error instanceof QueryFailedError) {
        switch (error.driverError.errno) {
          case 19:
            return next({ status: 412, message: 'Item already blocklisted' });
          default:
            logger.warn('Something wrong with data blocklist', {
              tmdbId: req.body.tmdbId,
              mediaType: req.body.mediaType,
              label: 'Blocklist',
            });
            return next({ status: 409, message: 'Something wrong' });
        }
      }

      return next({ status: 500, message: error.message });
    }
  }
);

blocklistRoutes.delete(
  '/:id',
  isAuthenticated([Permission.MANAGE_BLOCKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    const mediaType = req.query.mediaType;
    if (mediaType !== MediaType.MOVIE && mediaType !== MediaType.TV) {
      return next({
        status: 400,
        message: 'Invalid or missing mediaType query parameter.',
      });
    }

    try {
      const blocklisteRepository = getRepository(Blocklist);

      const blocklistItem = await blocklisteRepository.findOneOrFail({
        where: {
          tmdbId: Number(req.params.id),
          mediaType,
        },
      });

      await blocklisteRepository.remove(blocklistItem);

      const mediaRepository = getRepository(Media);

      const mediaItem = await mediaRepository.findOneOrFail({
        where: {
          tmdbId: Number(req.params.id),
          mediaType: req.query.mediaType as MediaType,
        },
      });

      await mediaRepository.remove(mediaItem);

      return res.status(204).send();
    } catch (e) {
      if (e instanceof EntityNotFoundError) {
        return next({
          status: 404,
          message: e.message,
        });
      }
      return next({ status: 500, message: e.message });
    }
  }
);

export default blocklistRoutes;
