import { getRepository } from '@server/datasource';
import OverrideRule from '@server/entity/OverrideRule';
import type { OverrideRuleResultsResponse } from '@server/interfaces/api/overrideRuleInterfaces';
import { Permission } from '@server/lib/permissions';
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
    metadataProfileId?: number;
    rootFolder?: string;
    tags?: string;
    radarrServiceId?: number;
    sonarrServiceId?: number;
    readarrServiceId?: number;
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
      metadataProfileId: req.body.metadataProfileId,
      rootFolder: req.body.rootFolder,
      tags: req.body.tags,
      radarrServiceId: req.body.radarrServiceId,
      sonarrServiceId: req.body.sonarrServiceId,
      readarrServiceId: req.body.readarrServiceId,
    });

    const newRule = await overrideRuleRepository.save(rule);

    return res.status(200).json(newRule);
  } catch (e) {
    next({ status: 404, message: e.message });
  }
});

overrideRuleRoutes.put<
  { ruleId: string },
  OverrideRule,
  {
    users?: string;
    genre?: string;
    language?: string;
    keywords?: string;
    profileId?: number;
    metadataProfileId?: number;
    rootFolder?: string;
    tags?: string;
    radarrServiceId?: number;
    sonarrServiceId?: number;
    readarrServiceId?: number;
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
    rule.metadataProfileId = req.body.metadataProfileId;
    rule.rootFolder = req.body.rootFolder;
    rule.tags = req.body.tags;
    rule.radarrServiceId = req.body.radarrServiceId;
    rule.sonarrServiceId = req.body.sonarrServiceId;
    rule.readarrServiceId = req.body.readarrServiceId;

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
