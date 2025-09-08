import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { Blacklist } from '@server/entity/Blacklist';
import Media from '@server/entity/Media';
import type { BlacklistResultsResponse } from '@server/interfaces/api/blacklistInterfaces';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { z } from 'zod';

const blacklistRoutes = Router();

export const blacklistAdd = z.object({
  tmdbId: z.coerce.number(),
  mediaType: z.nativeEnum(MediaType),
  title: z.coerce.string().optional(),
  user: z.coerce.number(),
});

const blacklistGet = z.object({
  take: z.coerce.number().int().positive().default(25),
  skip: z.coerce.number().int().nonnegative().default(0),
  search: z.string().optional(),
  filter: z.enum(['all', 'manual', 'blacklistedTags']).optional(),
});

blacklistRoutes.get(
  '/',
  isAuthenticated([Permission.MANAGE_BLACKLIST, Permission.VIEW_BLACKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    const { take, skip, search, filter } = blacklistGet.parse(req.query);

    try {
      let query = getRepository(Blacklist)
        .createQueryBuilder('blacklist')
        .leftJoinAndSelect('blacklist.user', 'user')
        .where('1 = 1'); // Allow use of andWhere later

      switch (filter) {
        case 'manual':
          query = query.andWhere('blacklist.blacklistedTags IS NULL');
          break;
        case 'blacklistedTags':
          query = query.andWhere('blacklist.blacklistedTags IS NOT NULL');
          break;
      }

      if (search) {
        query = query.andWhere('blacklist.title like :title', {
          title: `%${search}%`,
        });
      }

      const [blacklistedItems, itemsCount] = await query
        .orderBy('blacklist.createdAt', 'DESC')
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
        results: blacklistedItems,
      } as BlacklistResultsResponse);
    } catch (error) {
      logger.error('Something went wrong while retrieving blacklisted items', {
        label: 'Blacklist',
        errorMessage: error.message,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve blacklisted items.',
      });
    }
  }
);

blacklistRoutes.get(
  '/:id',
  isAuthenticated([Permission.MANAGE_BLACKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const blacklisteRepository = getRepository(Blacklist);

      const blacklistItem = await blacklisteRepository.findOneOrFail({
        where: { tmdbId: Number(req.params.id) },
      });

      return res.status(200).send(blacklistItem);
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

blacklistRoutes.post(
  '/',
  isAuthenticated([Permission.MANAGE_BLACKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const values = blacklistAdd.parse(req.body);

      await Blacklist.addToBlacklist({
        blacklistRequest: values,
      });

      return res.status(201).send();
    } catch (error) {
      if (!(error instanceof Error)) {
        return;
      }

      if (error instanceof QueryFailedError) {
        switch (error.driverError.errno) {
          case 19:
            return next({ status: 412, message: 'Item already blacklisted' });
          default:
            logger.warn('Something wrong with data blacklist', {
              tmdbId: req.body.tmdbId,
              mediaType: req.body.mediaType,
              label: 'Blacklist',
            });
            return next({ status: 409, message: 'Something wrong' });
        }
      }

      return next({ status: 500, message: error.message });
    }
  }
);

blacklistRoutes.delete(
  '/:id',
  isAuthenticated([Permission.MANAGE_BLACKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const blacklisteRepository = getRepository(Blacklist);

      const blacklistItem = await blacklisteRepository.findOneOrFail({
        where: { tmdbId: Number(req.params.id) },
      });

      await blacklisteRepository.remove(blacklistItem);

      const mediaRepository = getRepository(Media);

      const mediaItem = await mediaRepository.findOneOrFail({
        where: { tmdbId: Number(req.params.id) },
      });

      await mediaRepository.remove(mediaItem);

      return res.status(204).send();
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

export default blacklistRoutes;
