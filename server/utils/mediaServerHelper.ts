import { MediaServerType } from '@server/constants/server';

/**
 * Selects the human-readable name for the configured media server.
 *
 * @param currentMediaServer - The media server type configured in settings
 * @returns `'Emby'`, `'Plex'`, or `'Jellyfin'` representing the active media server
 */
export function getAvailableMediaServerName(
  currentMediaServer: MediaServerType
): string {
  if (currentMediaServer === MediaServerType.EMBY) {
    return 'Emby';
  }

  if (currentMediaServer === MediaServerType.PLEX) {
    return 'Plex';
  }

  return 'Jellyfin';
}

/**
 * Selects the most appropriate media server URL from a notification payload, preferring the 4K URL when requested.
 *
 * @returns The chosen media server URL, or `undefined` if none is available.
 */
export function getAvailableMediaServerUrl(payload: {
  request?: { is4k?: boolean };
  media?: {
    mediaUrl?: string;
    mediaUrl4k?: string;
  };
}): string | undefined {
  const wants4k = payload.request?.is4k;
  const url4k = payload.media?.mediaUrl4k;
  const url = payload.media?.mediaUrl;

  return (wants4k ? (url4k ?? url) : (url ?? url4k)) || undefined;
}