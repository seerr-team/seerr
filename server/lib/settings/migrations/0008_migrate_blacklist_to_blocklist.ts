import type { AllSettings } from '@server/lib/settings';
import type { LegacySettings } from './types';

const migrateBlacklistToBlocklist = (settings: LegacySettings): AllSettings => {
  if (
    Array.isArray(settings.migrations) &&
    settings.migrations.includes('0008_migrate_blacklist_to_blocklist')
  ) {
    return settings as AllSettings;
  }

  if (settings.main?.hideBlacklisted !== undefined) {
    settings.main.hideBlocklisted = settings.main.hideBlacklisted;
    delete settings.main.hideBlacklisted;
  }

  if (settings.main?.blacklistedTags !== undefined) {
    settings.main.blocklistedTags = settings.main.blacklistedTags;
    delete settings.main.blacklistedTags;
  }

  if (settings.main?.blacklistedTagsLimit !== undefined) {
    settings.main.blocklistedTagsLimit = settings.main.blacklistedTagsLimit;
    delete settings.main.blacklistedTagsLimit;
  }

  if (settings.jobs?.['process-blacklisted-tags']) {
    settings.jobs['process-blocklisted-tags'] =
      settings.jobs['process-blacklisted-tags'];
    delete settings.jobs['process-blacklisted-tags'];
  }

  if (!Array.isArray(settings.migrations)) {
    settings.migrations = [];
  }
  settings.migrations.push('0008_migrate_blacklist_to_blocklist');

  return settings as AllSettings;
};

export default migrateBlacklistToBlocklist;
