import type { AllSettings } from '@server/lib/settings';
import type { LegacySettings } from './types';

const migrateRegionSetting = (settings: LegacySettings): AllSettings => {
  if (
    settings.main.discoverRegion !== undefined &&
    settings.main.streamingRegion !== undefined
  ) {
    return settings as AllSettings;
  }

  const oldRegion = settings.main.region;
  if (oldRegion) {
    settings.main.discoverRegion = oldRegion;
    settings.main.streamingRegion = oldRegion;
  } else {
    settings.main.discoverRegion = '';
    settings.main.streamingRegion = 'US';
  }
  delete settings.main.region;

  return settings as AllSettings;
};

export default migrateRegionSetting;
