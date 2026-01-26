import type { AllSettings } from '@server/interfaces/settings';

const migrateHostname = (settings: any): AllSettings => {
  if (settings.jellyfin?.hostname) {
    const { hostname } = settings.jellyfin;
    const protocolMatch = hostname.match(/^(https?):\/\//i);
    const useSsl = protocolMatch && protocolMatch[1].toLowerCase() === 'https';
    const remainingUrl = hostname.replace(/^(https?):\/\//i, '');
    const urlMatch = remainingUrl.match(/^([^:]+)(:([0-9]+))?(\/.*)?$/);

    delete settings.jellyfin.hostname;
    if (urlMatch) {
      const [, ip, , port, urlBase] = urlMatch;
      settings.jellyfin = {
        ...settings.jellyfin,
        ip,
        port: port || (useSsl ? 443 : 80),
        useSsl,
        urlBase: urlBase ? urlBase.replace(/\/$/, '') : '',
      };
    }
  }

  return settings;
};

export default migrateHostname;
