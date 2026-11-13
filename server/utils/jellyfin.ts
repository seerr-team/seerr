import { getAppVersion } from '@server/utils/appVersion';

export function normalizeJellyfinGuid(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/-/g, '').toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function buildJellyfinAuthHeader(
  authToken?: string,
  deviceId?: string,
  version?: string
) {
  const safeDeviceId =
    deviceId && deviceId.length > 0
      ? deviceId
      : Buffer.from('BOT_seerr').toString('base64');

  if (!version) {
    version = getAppVersion();
  }

  let authHeaderVal = `MediaBrowser Client="Seerr", Device="Seerr", DeviceId="${safeDeviceId}", Version="${version}"`;
  if (authToken) {
    authHeaderVal += `, Token="${authToken}"`;
  }

  return authHeaderVal;
}
