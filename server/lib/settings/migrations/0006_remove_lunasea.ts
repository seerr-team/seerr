import type { AllSettings } from '@server/lib/settings';

const removeLunaSeaSetting = (settings: any): AllSettings => {
  if (
    settings.notifications &&
    settings.notifications.agents &&
    settings.notifications.agents.lunasea
  ) {
    delete settings.notifications.agents.lunasea;
  }
  return settings;
};

export default removeLunaSeaSetting;
