import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { MediaRequest } from '@server/entity/MediaRequest';
import OverrideRule from '@server/entity/OverrideRule';
import { User } from '@server/entity/User';
import type { OverrideRuleResultsResponse } from '@server/interfaces/api/overrideRuleInterfaces';
import overrideRules, {
  type OverrideRulesResult,
} from '@server/lib/overrideRules';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';

const overrideRuleRoutes = Router();

overrideRuleRoutes.get(
  '/',
  isAuthenticated(Permission.ADMIN),
  async (req, res, next) => {
    const overrideRuleRepository = getRepository(OverrideRule);

    try {
      const rules = await overrideRuleRepository.find({});

      return res.status(200).json(rules as OverrideRuleResultsResponse);
    } catch (e) {
      next({ status: 404, message: e.message });
    }
  }
);

overrideRuleRoutes.post<
  Record<string, string>,
  OverrideRule,
  {
    users?: string;
    genre?: string;
    language?: string;
    keywords?: string;
    profileId?: number;
    rootFolder?: string;
    tags?: string;
    radarrServiceId?: number;
    sonarrServiceId?: number;
  }
>('/', isAuthenticated(Permission.ADMIN), async (req, res, next) => {
  const overrideRuleRepository = getRepository(OverrideRule);

  try {
    const rule = new OverrideRule({
      users: req.body.users,
      genre: req.body.genre,
      language: req.body.language,
      keywords: req.body.keywords,
      profileId: req.body.profileId,
      rootFolder: req.body.rootFolder,
      tags: req.body.tags,
      radarrServiceId: req.body.radarrServiceId,
      sonarrServiceId: req.body.sonarrServiceId,
    });

    const newRule = await overrideRuleRepository.save(rule);

    return res.status(200).json(newRule);
  } catch (e) {
    next({ status: 404, message: e.message });
  }
});

overrideRuleRoutes.post<
  Record<string, string>,
  OverrideRulesResult,
  {
    mediaType: MediaType;
    is4k: boolean;
    tmdbId: number;
    requestUser: number;
    requestId: number | null;
    tags?: number[] | null;
    serviceId?: number;
  }
>(
  '/advancedRequest',
  isAuthenticated([Permission.REQUEST_ADVANCED, Permission.MANAGE_REQUESTS], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const tmdb = new TheMovieDb();
      let tmdbMedia: TmdbMovieDetails | TmdbTvDetails;
      try {
        tmdbMedia =
          req.body.mediaType === MediaType.MOVIE
            ? await tmdb.getMovie({ movieId: req.body.tmdbId })
            : await tmdb.getTvShow({ tvId: req.body.tmdbId });
      } catch {
        return next({ status: 404, message: 'Media not found' });
      }

      const userRepository = getRepository(User);
      const requestRepository = getRepository(MediaRequest);

      let ruleUser: User | null = req.user || null;

      if (req.body.requestId) {
        const request = await requestRepository.findOne({
          where: {
            id: Number(req.body.requestId),
          },
        });

        if (!request) {
          return next({ status: 404, message: 'Request not found.' });
        }

        if (
          (request.requestedBy.id !== req.user?.id ||
            (req.body.mediaType !== MediaType.TV &&
              !req.user?.hasPermission(Permission.REQUEST_ADVANCED))) &&
          !req.user?.hasPermission(Permission.MANAGE_REQUESTS)
        ) {
          return next({
            status: 403,
            message: 'You do not have permission to modify this request.',
          });
        }

        ruleUser = request.requestedBy;

        if (
          req.body.requestUser &&
          req.body.requestUser !== request.requestedBy.id &&
          !req.user?.hasPermission([
            Permission.MANAGE_USERS,
            Permission.MANAGE_REQUESTS,
          ])
        ) {
          return next({
            status: 403,
            message: 'You do not have permission to modify the request user.',
          });
        } else if (req.body.requestUser) {
          ruleUser = await userRepository.findOneOrFail({
            where: { id: req.body.requestUser },
          });
        }
      } else if (req.body.requestUser !== req.user?.id) {
        if (
          req.body.requestUser &&
          !req.user?.hasPermission([
            Permission.MANAGE_USERS,
            Permission.MANAGE_REQUESTS,
          ])
        ) {
          return next({
            status: 403,
            message: 'You do not have permission to modify the request user.',
          });
        } else if (req.body.requestUser) {
          ruleUser = await userRepository.findOneOrFail({
            where: { id: req.body.requestUser },
          });
        }
      }

      if (!ruleUser) {
        return next({ status: 404, message: 'User not found.' });
      }

      const overrideRulesResult: OverrideRulesResult = await overrideRules({
        mediaType: req.body.mediaType,
        is4k: req.body.is4k,
        tmdbMedia,
        requestUser: ruleUser,
        tags: req.body.tags,
        serviceId: req.body.serviceId,
      });

      res.status(200).json(overrideRulesResult);
    } catch (e) {
      logger.error('Something went wrong evaluating override rules', {
        label: 'API',
        errorMessage: e.message,
        tmdbId: req.body.tmdbId,
      });
      next({ status: 500, message: 'Unable to evaluate override rules.' });
    }
  }
);

overrideRuleRoutes.put<
  { ruleId: string },
  OverrideRule,
  {
    users?: string;
    genre?: string;
    language?: string;
    keywords?: string;
    profileId?: number;
    rootFolder?: string;
    tags?: string;
    radarrServiceId?: number;
    sonarrServiceId?: number;
  }
>('/:ruleId', isAuthenticated(Permission.ADMIN), async (req, res, next) => {
  const overrideRuleRepository = getRepository(OverrideRule);

  try {
    const rule = await overrideRuleRepository.findOne({
      where: {
        id: Number(req.params.ruleId),
      },
    });

    if (!rule) {
      return next({ status: 404, message: 'Override Rule not found.' });
    }

    rule.users = req.body.users;
    rule.genre = req.body.genre;
    rule.language = req.body.language;
    rule.keywords = req.body.keywords;
    rule.profileId = req.body.profileId;
    rule.rootFolder = req.body.rootFolder;
    rule.tags = req.body.tags;
    rule.radarrServiceId = req.body.radarrServiceId;
    rule.sonarrServiceId = req.body.sonarrServiceId;

    const newRule = await overrideRuleRepository.save(rule);

    return res.status(200).json(newRule);
  } catch (e) {
    next({ status: 404, message: e.message });
  }
});

overrideRuleRoutes.delete<{ ruleId: string }, OverrideRule>(
  '/:ruleId',
  isAuthenticated(Permission.ADMIN),
  async (req, res, next) => {
    const overrideRuleRepository = getRepository(OverrideRule);

    try {
      const rule = await overrideRuleRepository.findOne({
        where: {
          id: Number(req.params.ruleId),
        },
      });

      if (!rule) {
        return next({ status: 404, message: 'Override Rule not found.' });
      }

      await overrideRuleRepository.remove(rule);

      return res.status(200).json(rule);
    } catch (e) {
      next({ status: 404, message: e.message });
    }
  }
);

export default overrideRuleRoutes;
