import type { AllSettings } from '@server/lib/settings';

const migrateNetworkSettings = (settings: any): AllSettings => {
  if (settings.network) {
    return settings;
  }
  const newSettings = { ...settings };
  const legacyProxy = settings.main.proxy;
  newSettings.network = {
    ...(settings.network ?? {}),
    csrfProtection: settings.main.csrfProtection ?? false,
    trustProxy: settings.main.trustProxy ?? false,
    forceIpv4First: settings.main.forceIpv4First ?? false,
    proxy: {
      enabled: legacyProxy?.enabled ?? false,
      hostname: legacyProxy?.hostname ?? '',
      port: legacyProxy?.port ?? 8080,
      useSsl: legacyProxy?.useSsl ?? false,
      user: legacyProxy?.user ?? '',
      password: legacyProxy?.password ?? '',
      bypassFilter: legacyProxy?.bypassFilter ?? '',
      bypassLocalAddresses: legacyProxy?.bypassLocalAddresses ?? true,
    },
  };
  delete settings.main.csrfProtection;
  delete settings.main.trustProxy;
  delete settings.main.forceIpv4First;
  delete settings.main.proxy;
  return newSettings;
};

export default migrateNetworkSettings;
