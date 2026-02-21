import { getRepository } from '@server/datasource';
import RoutingRule from '@server/entity/RoutingRule';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

export interface ResolvedRoute {
  serviceId: number;
  profileId?: number;
  rootFolder?: string;
  seriesType?: string;
  tags?: number[];
  minimumAvailability?: string;
}

interface RouteParams {
  serviceType: 'radarr' | 'sonarr';
  is4k: boolean;
  userId: number;
  genres: number[];
  language: string;
  keywords: number[];
}

/**
 * Evaluates routing rules top-to-bottom (by priority DESC).
 * First match wins. Falls back to the default instance if no rules match.
 */
export async function resolveRoute(
  params: RouteParams
): Promise<ResolvedRoute> {
  const routingRuleRepository = getRepository(RoutingRule);
  const settings = getSettings();

  const rules = await routingRuleRepository.find({
    where: {
      serviceType: params.serviceType,
      is4k: params.is4k,
    },
    order: { priority: 'DESC' },
  });

  for (const rule of rules) {
    if (matchesAllConditions(rule, params)) {
      logger.debug('Routing rule matched', {
        label: 'Routing',
        ruleId: rule.id,
        ruleName: rule.name,
        targetServiceId: rule.targetServiceId,
      });

      return {
        serviceId: rule.targetServiceId,
        profileId: rule.activeProfileId ?? undefined,
        rootFolder: rule.rootFolder ?? undefined,
        seriesType: rule.seriesType ?? undefined,
        tags: rule.tags ? rule.tags.split(',').map(Number) : undefined,
        minimumAvailability: rule.minimumAvailability ?? undefined,
      };
    }
  }

  logger.warn(
    'No routing rules matched (including fallback rules). Falling back to settings default.',
    {
      label: 'Routing',
      serviceType: params.serviceType,
      is4k: params.is4k,
    }
  );

  const services =
    params.serviceType === 'radarr' ? settings.radarr : settings.sonarr;
  const defaultServiceIdx = services.findIndex(
    (s) => (params.is4k ? s.is4k : !s.is4k) && s.isDefault
  );

  if (defaultServiceIdx === -1) {
    throw new Error(
      `No default ${params.serviceType} instance configured for ${
        params.is4k ? '4K' : 'non-4K'
      } content.`
    );
  }

  return { serviceId: services[defaultServiceIdx].id };
}

/**
 * Check if a rule's conditions all match the request parameters.
 *
 * - No conditions (fallback) = always matches
 * - AND between condition types (all populated conditions must pass)
 * - OR within a condition type (any value can match)
 */
function matchesAllConditions(rule: RoutingRule, params: RouteParams): boolean {
  if (rule.isFallback) {
    return true;
  }

  const hasConditions =
    rule.users || rule.genres || rule.languages || rule.keywords;

  if (!hasConditions) {
    return true;
  }

  if (rule.users) {
    const ruleUserIds = rule.users.split(',').map(Number);
    if (!ruleUserIds.includes(params.userId)) {
      return false;
    }
  }

  if (rule.genres) {
    const ruleGenreIds = rule.genres.split(',').map(Number);
    if (!ruleGenreIds.some((g) => params.genres.includes(g))) {
      return false;
    }
  }

  if (rule.languages) {
    const ruleLangs = rule.languages.split('|');
    if (!ruleLangs.includes(params.language)) {
      return false;
    }
  }

  if (rule.keywords) {
    const ruleKeywordIds = rule.keywords.split(',').map(Number);
    if (!ruleKeywordIds.some((k) => params.keywords.includes(k))) {
      return false;
    }
  }

  return true;
}
