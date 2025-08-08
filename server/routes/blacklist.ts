import TheMovieDb from '@server/api/themoviedb';
import { MediaStatus, MediaType } from '@server/constants/media';
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

      const existingBlacklist = await getRepository(Blacklist).findOne({
        where: { tmdbId: values.tmdbId },
      });

      if (existingBlacklist) {
        return next({ status: 412, message: 'Item already blacklisted' });
      }

      await Blacklist.addToBlacklist({
        blacklistRequest: {
          tmdbId: values.tmdbId,
          mediaType: values.mediaType as MediaType,
          title: values.title,
        },
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

blacklistRoutes.post(
  '/collection/:id',
  isAuthenticated([Permission.MANAGE_BLACKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const tmdb = new TheMovieDb();
      const collection = await tmdb.getCollection({
        collectionId: Number(req.params.id),
        language: req.locale,
      });

      const blacklistRepository = getRepository(Blacklist);
      const mediaRepository = getRepository(Media);

      // Blacklist all movies in the collection
      await Promise.all(
        collection.parts.map(async (part) => {
          const existingBlacklist = await blacklistRepository.findOne({
            where: { tmdbId: part.id },
          });

          if (existingBlacklist) {
            return;
          }

          const blacklist = new Blacklist({
            tmdbId: part.id,
            mediaType: MediaType.MOVIE,
            title: part.title,
            user: req.user,
          });

          await blacklistRepository.save(blacklist);

          let media = await mediaRepository.findOne({
            where: { tmdbId: part.id },
          });

          if (!media) {
            media = new Media({
              tmdbId: part.id,
              status: MediaStatus.BLACKLISTED,
              status4k: MediaStatus.BLACKLISTED,
              mediaType: MediaType.MOVIE,
              blacklist: Promise.resolve(blacklist),
            });
          } else {
            media.status = MediaStatus.BLACKLISTED;
            media.status4k = MediaStatus.BLACKLISTED;
            media.blacklist = Promise.resolve(blacklist);
          }

          await mediaRepository.save(media);
        })
      );

      return res.status(201).send();
    } catch (e) {
      logger.error('Error blacklisting collection', {
        label: 'Blacklist',
        errorMessage: e.message,
        collectionId: req.params.id,
      });
      return next({ status: 500, message: e.message });
    }
  }
);

blacklistRoutes.delete(
  '/collection/:id',
  isAuthenticated([Permission.MANAGE_BLACKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const tmdb = new TheMovieDb();
      const collection = await tmdb.getCollection({
        collectionId: Number(req.params.id),
        language: req.locale,
      });

      const blacklistRepository = getRepository(Blacklist);
      const mediaRepository = getRepository(Media);

      // Remove all movies in the collection from blacklist
      await Promise.all(
        collection.parts.map(async (part) => {
          const blacklistItem = await blacklistRepository.findOne({
            where: { tmdbId: part.id },
          });

          if (blacklistItem) {
            await blacklistRepository.remove(blacklistItem);

            const mediaItem = await mediaRepository.findOne({
              where: { tmdbId: part.id },
            });

            if (mediaItem) {
              mediaItem.status = MediaStatus.UNKNOWN;
              mediaItem.status4k = MediaStatus.UNKNOWN;
              await mediaRepository.save(mediaItem);
            }
          }
        })
      );

      return res.status(204).send();
    } catch (e) {
      logger.error('Error unblacklisting collection', {
        label: 'Blacklist',
        errorMessage: e.message,
        collectionId: req.params.id,
      });
      return next({ status: 500, message: e.message });
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
      const blacklistRepository = getRepository(Blacklist);
      const mediaRepository = getRepository(Media);

      const blacklistItem = await blacklistRepository.findOne({
        where: { tmdbId: Number(req.params.id) },
      });

      if (!blacklistItem) {
        return res.status(204).send();
      }

      await blacklistRepository.remove(blacklistItem);

      try {
        const mediaItem = await mediaRepository.findOneOrFail({
          where: { tmdbId: Number(req.params.id) },
        });

        mediaItem.status = MediaStatus.UNKNOWN;
        mediaItem.status4k = MediaStatus.UNKNOWN;
        await mediaRepository.save(mediaItem);
      } catch (mediaError) {
        // Media entity doesn't exist, which is fine
      }

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
