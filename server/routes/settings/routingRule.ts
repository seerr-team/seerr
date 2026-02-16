import { getRepository } from '@server/datasource';
import RoutingRule from '@server/entity/RoutingRule';
import { Permission } from '@server/lib/permissions';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';
import { In, Not } from 'typeorm';

const routingRuleRoutes = Router();

type ServiceType = 'radarr' | 'sonarr';

function resolveTargetService(
  serviceType: ServiceType,
  targetServiceId: number
): RadarrSettings | SonarrSettings | undefined {
  const settings = getSettings();
  const services = serviceType === 'radarr' ? settings.radarr : settings.sonarr;
  return services.find((s) => s.id === targetServiceId);
}

function hasAnyCondition(body: Record<string, unknown>): boolean {
  return !!(body.users || body.genres || body.languages || body.keywords);
}

function parseActiveProfileId(
  raw: string | number | null | undefined
): number | null {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

routingRuleRoutes.get(
  '/',
  isAuthenticated(Permission.ADMIN),
  async (_req, res, next) => {
    const routingRuleRepository = getRepository(RoutingRule);
    try {
      const rules = await routingRuleRepository.find({
        order: { isFallback: 'ASC', priority: 'DESC' },
      });
      return res.status(200).json(rules);
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

routingRuleRoutes.post(
  '/',
  isAuthenticated(Permission.ADMIN),
  async (req, res, next) => {
    const routingRuleRepository = getRepository(RoutingRule);
    try {
      const serviceType = req.body.serviceType as ServiceType;
      const targetServiceId = Number(req.body.targetServiceId);

      if (!serviceType || !['radarr', 'sonarr'].includes(serviceType)) {
        return next({ status: 400, message: 'Invalid serviceType.' });
      }
      if (!Number.isFinite(targetServiceId) || targetServiceId < 0) {
        return next({ status: 400, message: 'Invalid targetServiceId.' });
      }

      const target = resolveTargetService(serviceType, targetServiceId);
      if (!target) {
        return next({ status: 400, message: 'Target instance not found.' });
      }

      const derivedIs4k = !!target.is4k;
      const isFallback = !!req.body.isFallback;

      if (isFallback) {
        const existing = await routingRuleRepository.findOne({
          where: { serviceType, is4k: derivedIs4k, isFallback: true },
        });

        if (existing) {
          return next({
            status: 409,
            message: 'Fallback already exists for this serviceType/is4k.',
          });
        }

        if (!target.isDefault) {
          return next({
            status: 400,
            message: 'Fallback rules must target a default instance.',
          });
        }
      }

      if (!isFallback && !hasAnyCondition(req.body)) {
        return next({
          status: 400,
          message: 'Non-fallback rules must have at least one condition.',
        });
      }

      const activeProfileId = parseActiveProfileId(req.body.activeProfileId);

      if (isFallback) {
        if (!req.body.rootFolder) {
          return next({
            status: 400,
            message: 'Fallback requires rootFolder.',
          });
        }

        if (activeProfileId == null) {
          return next({
            status: 400,
            message: 'Fallback requires activeProfileId.',
          });
        }

        if (serviceType === 'radarr' && !req.body.minimumAvailability) {
          return next({
            status: 400,
            message: 'Fallback requires minimumAvailability for radarr.',
          });
        }
      }

      let priority = 0;
      if (!isFallback) {
        const highestRule = await routingRuleRepository.findOne({
          where: { serviceType, is4k: derivedIs4k, isFallback: false },
          order: { priority: 'DESC' },
        });
        priority = (highestRule?.priority ?? 0) + 10;
      }

      const rule = new RoutingRule({
        name: req.body.name,
        serviceType,
        targetServiceId,
        is4k: derivedIs4k,
        isFallback,
        priority,
        users: isFallback ? null : req.body.users,
        genres: isFallback ? null : req.body.genres,
        languages: isFallback ? null : req.body.languages,
        keywords: isFallback ? null : req.body.keywords,
        activeProfileId: activeProfileId ?? undefined,
        rootFolder: req.body.rootFolder,
        seriesType: req.body.seriesType,
        tags: req.body.tags,
        minimumAvailability: req.body.minimumAvailability ?? null,
      });

      const newRule = await routingRuleRepository.save(rule);
      return res.status(201).json(newRule);
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

routingRuleRoutes.put<{ ruleId: string }>(
  '/:ruleId',
  isAuthenticated(Permission.ADMIN),
  async (req, res, next) => {
    const routingRuleRepository = getRepository(RoutingRule);
    try {
      const rule = await routingRuleRepository.findOne({
        where: { id: Number(req.params.ruleId) },
      });

      if (!rule) {
        return next({ status: 404, message: 'Routing rule not found.' });
      }

      const nextServiceType = (req.body.serviceType ??
        rule.serviceType) as ServiceType;
      const nextTargetServiceId = Number(
        req.body.targetServiceId ?? rule.targetServiceId
      );

      const target = resolveTargetService(nextServiceType, nextTargetServiceId);
      if (!target) {
        return next({ status: 400, message: 'Target instance not found.' });
      }

      const derivedIs4k = !!target.is4k;
      const derivedIsDefault = !!target.isDefault;
      const nextIsFallback = !!(req.body.isFallback ?? rule.isFallback);

      if (nextIsFallback) {
        const existing = await routingRuleRepository.findOne({
          where: {
            serviceType: nextServiceType,
            is4k: derivedIs4k,
            isFallback: true,
            id: Not(rule.id),
          },
        });

        if (existing) {
          return next({
            status: 409,
            message: 'Fallback already exists for this serviceType/is4k.',
          });
        }
      }

      const mergedForConditionCheck = { ...rule, ...req.body };
      if (!nextIsFallback && !hasAnyCondition(mergedForConditionCheck)) {
        return next({
          status: 400,
          message: 'Non-fallback rules must have at least one condition.',
        });
      }

      if (nextIsFallback && !derivedIsDefault) {
        return next({
          status: 400,
          message: 'Fallback rules must target a default instance.',
        });
      }

      const nextActiveProfileId = parseActiveProfileId(
        req.body.activeProfileId ?? rule.activeProfileId
      );

      const nextRootFolder = (req.body.rootFolder ?? rule.rootFolder) as
        | string
        | undefined;

      const nextMinimumAvailability =
        nextServiceType === 'radarr'
          ? (req.body.minimumAvailability ?? rule.minimumAvailability)
          : null;

      if (nextIsFallback) {
        if (!nextRootFolder) {
          return next({
            status: 400,
            message: 'Fallback requires rootFolder.',
          });
        }
        if (nextActiveProfileId == null) {
          return next({
            status: 400,
            message: 'Fallback requires activeProfileId.',
          });
        }
        if (nextServiceType === 'radarr' && !nextMinimumAvailability) {
          return next({
            status: 400,
            message: 'Fallback requires minimumAvailability for radarr.',
          });
        }
      }

      if (nextIsFallback) {
        rule.priority = 0;
      } else if (typeof req.body.priority === 'number') {
        rule.priority = req.body.priority;
      } else {
        const groupChanged =
          rule.serviceType !== nextServiceType ||
          rule.is4k !== derivedIs4k ||
          rule.isFallback;

        if (groupChanged) {
          const highestRule = await routingRuleRepository.findOne({
            where: {
              serviceType: nextServiceType,
              is4k: derivedIs4k,
              isFallback: false,
            },
            order: { priority: 'DESC' },
          });
          rule.priority = (highestRule?.priority ?? 0) + 10;
        }
      }

      rule.name = req.body.name ?? rule.name;
      rule.serviceType = nextServiceType;
      rule.targetServiceId = nextTargetServiceId;
      rule.is4k = derivedIs4k;
      rule.isFallback = nextIsFallback;
      rule.users = nextIsFallback ? null : req.body.users;
      rule.genres = nextIsFallback ? null : req.body.genres;
      rule.languages = nextIsFallback ? null : req.body.languages;
      rule.keywords = nextIsFallback ? null : req.body.keywords;
      rule.activeProfileId = nextActiveProfileId ?? undefined;
      rule.rootFolder = nextRootFolder;
      rule.minimumAvailability = nextMinimumAvailability;
      rule.tags = req.body.tags;

      const updatedRule = await routingRuleRepository.save(rule);
      return res.status(200).json(updatedRule);
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

routingRuleRoutes.delete<{ ruleId: string }>(
  '/:ruleId',
  isAuthenticated(Permission.ADMIN),
  async (req, res, next) => {
    const routingRuleRepository = getRepository(RoutingRule);
    try {
      const rule = await routingRuleRepository.findOne({
        where: { id: Number(req.params.ruleId) },
      });

      if (!rule) {
        return next({ status: 404, message: 'Routing rule not found.' });
      }

      await routingRuleRepository.remove(rule);
      return res.status(200).json(rule);
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

routingRuleRoutes.post(
  '/reorder',
  isAuthenticated(Permission.ADMIN),
  async (req, res, next) => {
    const routingRuleRepository = getRepository(RoutingRule);

    try {
      const { ruleIds } = req.body as { ruleIds: number[] };

      const MAX_RULE_IDS = 1000;

      if (!Array.isArray(ruleIds)) {
        return next({ status: 400, message: 'ruleIds must be an array.' });
      }

      if (ruleIds.length > MAX_RULE_IDS) {
        return next({
          status: 400,
          message: `Too many ruleIds provided. Maximum allowed is ${MAX_RULE_IDS}.`,
        });
      }

      const rules = await routingRuleRepository.findBy({ id: In(ruleIds) });
      const fallbackIds = new Set(
        rules.filter((r) => r.isFallback).map((r) => r.id)
      );
      const orderedIds = ruleIds.filter((id) => !fallbackIds.has(id));

      for (let i = 0; i < orderedIds.length; i++) {
        await routingRuleRepository.update(orderedIds[i], {
          priority: (orderedIds.length - i) * 10,
        });
      }

      const refreshed = await routingRuleRepository.find({
        order: { isFallback: 'ASC', priority: 'DESC' },
      });

      return res.status(200).json(refreshed);
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

export default routingRuleRoutes;
