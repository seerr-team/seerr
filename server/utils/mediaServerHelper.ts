import { MediaServerType } from '@server/constants/server';

/**
 * Returns the display name of the media server being used in the seerr installation
 * If neither Emby nor Plex is detected it falls back to Jellyfin
 * @param currentMediaServer The currently configured media server type from settings
 * @returns Human readable media server name
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
 * This function returns the URL of the media directly in the media server
 * Used later on in the email as a button to send directly to
 * @param payload Notification payload containing media and request information
 * @returns Media server URL or undefined if it's unavailable
 */
export function getAvailableMediaServerUrl(payload: {
  request?: { is4k?: boolean };
  media?: {
    mediaUrl?: string;
    mediaUrl4k?: string;
  };
}): string | undefined {
  const wants4k = payload.request?.is4k;
  const url4k = (payload.media as any)?.mediaUrl4k as string | undefined;
  const url = (payload.media as any)?.mediaUrl as string | undefined;

  return (wants4k ? (url4k ?? url) : (url ?? url4k)) || undefined;
}
