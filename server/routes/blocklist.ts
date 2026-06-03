import TheMovieDb from '@server/api/themoviedb';
import { MediaStatus, MediaType } from '@server/constants/media';
import dataSource, { getRepository } from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import Media from '@server/entity/Media';
import type { BlocklistResultsResponse } from '@server/interfaces/api/blocklistInterfaces';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';
import { EntityNotFoundError, In, QueryFailedError } from 'typeorm';
import { z } from 'zod';

const blocklistRoutes = Router();

export const blocklistAdd = z.object({
  tmdbId: z.coerce.number(),
  mediaType: z.nativeEnum(MediaType),
  title: z.coerce.string().optional(),
  user: z.coerce.number(),
  blocklistedTags: z.string().optional(),
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
          status: 404,
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

blocklistRoutes.post(
  '/collection/:id',
  isAuthenticated([Permission.MANAGE_BLOCKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const tmdb = new TheMovieDb();
      const collection = await tmdb.getCollection({
        collectionId: Number(req.params.id),
        language: req.locale,
      });

      const uniqueParts = [
        ...new Map(collection.parts.map((p) => [p.id, p])).values(),
      ];
      const partIds = uniqueParts.map((p) => p.id);
      if (partIds.length === 0) {
        return res.status(201).send();
      }

      await dataSource.transaction(async (em) => {
        const blocklistRepository = em.getRepository(Blocklist);
        const mediaRepository = em.getRepository(Media);

        const [existingBlocklists, existingMedia] = await Promise.all([
          blocklistRepository.find({
            where: { tmdbId: In(partIds), mediaType: MediaType.MOVIE },
          }),
          mediaRepository.find({
            where: { tmdbId: In(partIds), mediaType: MediaType.MOVIE },
          }),
        ]);
        const blocklistByTmdbId = new Map(
          existingBlocklists.map((b) => [b.tmdbId, b])
        );
        const mediaByTmdbId = new Map(existingMedia.map((m) => [m.tmdbId, m]));

        await Promise.all(
          uniqueParts.map(async (part) => {
            if (blocklistByTmdbId.has(part.id)) {
              return;
            }

            let blocklist = new Blocklist({
              tmdbId: part.id,
              mediaType: MediaType.MOVIE,
              title: part.title,
              user: req.user,
            });

            try {
              await blocklistRepository.save(blocklist);
            } catch (error) {
              if (
                !(error instanceof QueryFailedError) ||
                error.driverError.errno !== 19
              ) {
                throw error;
              }
              const row = await blocklistRepository.findOne({
                where: { tmdbId: part.id, mediaType: MediaType.MOVIE },
              });
              if (!row) {
                throw error;
              }
              blocklist = row;
            }

            let media = mediaByTmdbId.get(part.id);
            if (!media) {
              media = new Media({
                tmdbId: part.id,
                status: MediaStatus.BLOCKLISTED,
                status4k: MediaStatus.BLOCKLISTED,
                mediaType: MediaType.MOVIE,
                blocklist: Promise.resolve(blocklist),
              });
            } else {
              media.status = MediaStatus.BLOCKLISTED;
              media.status4k = MediaStatus.BLOCKLISTED;
              media.blocklist = Promise.resolve(blocklist);
            }

            await mediaRepository.save(media);
          })
        );
      });

      return res.status(201).send();
    } catch (e) {
      logger.error('Error blocklisting collection', {
        label: 'Blocklist',
        errorMessage: e.message,
        collectionId: req.params.id,
      });
      return next({ status: 500, message: e.message });
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

blocklistRoutes.delete(
  '/collection/:id',
  isAuthenticated([Permission.MANAGE_BLOCKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const tmdb = new TheMovieDb();
      const collection = await tmdb.getCollection({
        collectionId: Number(req.params.id),
        language: req.locale,
      });

      await dataSource.transaction(async (em) => {
        const blocklistRepository = em.getRepository(Blocklist);
        const mediaRepository = em.getRepository(Media);

        await Promise.all(
          collection.parts.map(async (part) => {
            const blocklistItem = await blocklistRepository.findOne({
              where: { tmdbId: part.id, mediaType: MediaType.MOVIE },
            });

            if (blocklistItem) {
              await blocklistRepository.remove(blocklistItem);

              const mediaItem = await mediaRepository.findOne({
                where: { tmdbId: part.id, mediaType: MediaType.MOVIE },
              });

              if (mediaItem) {
                await mediaRepository.remove(mediaItem);
              }
            }
          })
        );
      });

      return res.status(204).send();
    } catch (e) {
      logger.error('Error unblocklisting collection', {
        label: 'Blocklist',
        errorMessage: e.message,
        collectionId: req.params.id,
      });
      return next({ status: 500, message: e.message });
    }
  }
);

export default blocklistRoutes;
