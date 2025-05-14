import { MediaServerType } from '@server/constants/server';
import type { AllSettings } from '@server/lib/settings';

const overseerrMerge = (settings: any): AllSettings => {
  if (settings.main.mediaServerType) {
    return settings; // already migrated
  }
  const newSettings = { ...settings };
  newSettings.main.mediaServerType = MediaServerType.PLEX;
  newSettings.main.applicationTitle = 'Seerr';
  newSettings.notifications.agents.email.options.senderName = 'Seerr';
  return newSettings;
};

export default overseerrMerge;
