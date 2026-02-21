import { getRepository } from '@server/datasource';
import OverrideRule from '@server/entity/OverrideRule';
import RoutingRule from '@server/entity/RoutingRule';
import type { AllSettings } from '@server/lib/settings';

const ANIME_KEYWORD_ID = '210024';

const migrateToRoutingRules = async (settings: any): Promise<AllSettings> => {
  if (
    Array.isArray(settings.migrations) &&
    settings.migrations.includes('0009_migrate_to_routing_rules')
  ) {
    return settings;
  }

  const routingRuleRepo = getRepository(RoutingRule);
  let errorOccurred = false;

  for (const radarr of settings.radarr || []) {
    if (!radarr.isDefault) continue;

    try {
      await routingRuleRepo.save(
        new RoutingRule({
          name: `${radarr.name} Default Route`,
          serviceType: 'radarr',
          targetServiceId: radarr.id,
          is4k: radarr.is4k,
          isFallback: true,
          priority: 0,
          activeProfileId: radarr.activeProfileId || undefined,
          rootFolder: radarr.activeDirectory || undefined,
          minimumAvailability: radarr.minimumAvailability || 'released',
          tags:
            radarr.tags && radarr.tags.length > 0
              ? radarr.tags.join(',')
              : undefined,
        })
      );
    } catch (error) {
      console.error(
        `Failed to create Radarr fallback routing rule for "${radarr.name}".`,
        error.message
      );
      errorOccurred = true;
    }
  }

  for (const sonarr of settings.sonarr || []) {
    if (!sonarr.isDefault) continue;

    try {
      await routingRuleRepo.save(
        new RoutingRule({
          name: `${sonarr.name} Default Route`,
          serviceType: 'sonarr',
          targetServiceId: sonarr.id,
          is4k: sonarr.is4k,
          isFallback: true,
          priority: 0,
          activeProfileId: sonarr.activeProfileId || undefined,
          rootFolder: sonarr.activeDirectory || undefined,
          seriesType: sonarr.seriesType || 'standard',
          tags:
            sonarr.tags && sonarr.tags.length > 0
              ? sonarr.tags.join(',')
              : undefined,
        })
      );
    } catch (error) {
      console.error(
        `Failed to create Sonarr fallback routing rule for "${sonarr.name}".`,
        error.message
      );
      errorOccurred = true;
    }

    const hasAnimeOverrides =
      sonarr.activeAnimeProfileId ||
      sonarr.activeAnimeDirectory ||
      (sonarr.animeTags && sonarr.animeTags.length > 0);

    if (hasAnimeOverrides) {
      try {
        await routingRuleRepo.save(
          new RoutingRule({
            name: 'Anime',
            serviceType: 'sonarr',
            targetServiceId: sonarr.id,
            is4k: sonarr.is4k,
            isFallback: false,
            priority: 10,
            keywords: ANIME_KEYWORD_ID,
            activeProfileId:
              sonarr.activeAnimeProfileId ||
              sonarr.activeProfileId ||
              undefined,
            rootFolder:
              sonarr.activeAnimeDirectory ||
              sonarr.activeDirectory ||
              undefined,
            seriesType: sonarr.animeSeriesType || 'anime',
            tags:
              sonarr.animeTags && sonarr.animeTags.length > 0
                ? sonarr.animeTags.join(',')
                : undefined,
          })
        );
      } catch (error) {
        console.error(
          `Failed to create Sonarr anime routing rule for "${sonarr.name}".`,
          error.message
        );
        errorOccurred = true;
      }
    }
  }

  let overrideRules: OverrideRule[] = [];
  try {
    const overrideRuleRepo = getRepository(OverrideRule);
    overrideRules = await overrideRuleRepo.find();
  } catch {
    // If the OverrideRule table doesn't exist or can't be queried, we can skip this step.
  }

  let priority = 20;

  for (const rule of overrideRules) {
    const isRadarr = rule.radarrServiceId != null;
    const serviceType: 'radarr' | 'sonarr' = isRadarr ? 'radarr' : 'sonarr';

    const serviceIndex = isRadarr
      ? rule.radarrServiceId!
      : rule.sonarrServiceId!;
    const services =
      serviceType === 'radarr' ? settings.radarr || [] : settings.sonarr || [];
    const targetService = services[serviceIndex];

    if (!targetService) {
      console.error(
        `Skipping override rule #${rule.id}: ${serviceType} instance at index ${serviceIndex} not found in settings.`
      );
      errorOccurred = true;
      continue;
    }

    try {
      await routingRuleRepo.save(
        new RoutingRule({
          name: `Migrated Rule #${rule.id}`,
          serviceType,
          targetServiceId: targetService.id,
          is4k: targetService.is4k,
          isFallback: false,
          priority,
          users: rule.users || undefined,
          genres: rule.genre || undefined,
          languages: rule.language || undefined,
          keywords: rule.keywords || undefined,
          activeProfileId: rule.profileId || undefined,
          rootFolder: rule.rootFolder || undefined,
          tags: rule.tags || undefined,
        })
      );

      priority += 10;
    } catch (error) {
      console.error(
        `Failed to migrate override rule #${rule.id} to routing rule.`,
        error.message
      );
      errorOccurred = true;
    }
  }

  if (!errorOccurred) {
    if (!Array.isArray(settings.migrations)) {
      settings.migrations = [];
    }
    settings.migrations.push('0009_migrate_to_routing_rules');
  }

  return settings;
};

export default migrateToRoutingRules;
