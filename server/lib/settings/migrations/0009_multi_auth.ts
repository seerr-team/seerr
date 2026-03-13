import { MediaServerType } from '@server/constants/server';
import type { AllSettings } from '@server/lib/settings';

const migrateMultiAuth = (settings: any): AllSettings => {
  if (
    Array.isArray(settings.migrations) &&
    settings.migrations.includes('0009_multi_auth')
  ) {
    return settings;
  }

  // Rename mediaServerType -> primaryMediaServer
  if (settings.main && 'mediaServerType' in settings.main) {
    settings.main.primaryMediaServer = settings.main.mediaServerType;
    delete settings.main.mediaServerType;
  }

  // Seed enabledAuthMethods from existing config
  if (settings.main && !settings.main.enabledAuthMethods) {
    const primaryServer = settings.main.primaryMediaServer;
    const wasEnabled = settings.main.mediaServerLogin !== false;

    if (
      primaryServer &&
      primaryServer !== MediaServerType.NOT_CONFIGURED &&
      wasEnabled
    ) {
      settings.main.enabledAuthMethods = [primaryServer];
    } else {
      settings.main.enabledAuthMethods = [];
    }
  }

  // Rename newPlexLogin -> newUserLogin
  if (settings.main && 'newPlexLogin' in settings.main) {
    settings.main.newUserLogin = settings.main.newPlexLogin;
    delete settings.main.newPlexLogin;
  }

  // Remove deprecated mediaServerLogin
  if (settings.main) {
    delete settings.main.mediaServerLogin;
  }

  if (!Array.isArray(settings.migrations)) {
    settings.migrations = [];
  }
  settings.migrations.push('0009_multi_auth');

  return settings;
};

export default migrateMultiAuth;
