import type { AllSettings } from '@server/interfaces/settings';

const migrateNetworkSettings = (settings: any): AllSettings => {
  if (settings.network) {
    return settings;
  }
  const newSettings = { ...settings };
  newSettings.network = {
    ...settings.network,
    csrfProtection: settings.main.csrfProtection ?? false,
    trustProxy: settings.main.trustProxy ?? false,
    forceIpv4First: settings.main.forceIpv4First ?? false,
    proxy: settings.main.proxy ?? {
      enabled: false,
      hostname: '',
      port: 8080,
      useSsl: false,
      user: '',
      password: '',
      bypassFilter: '',
      bypassLocalAddresses: true,
    },
  };
  delete settings.main.csrfProtection;
  delete settings.main.trustProxy;
  delete settings.main.forceIpv4First;
  delete settings.main.proxy;
  return newSettings;
};

export default migrateNetworkSettings;
