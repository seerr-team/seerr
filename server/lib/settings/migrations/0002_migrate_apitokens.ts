import JellyfinMainAPI from '@server/api/jellyfinMain';
import { MediaServerType } from '@server/constants/server';
import type { AllSettings } from '@server/lib/settings';
import { getHostname } from '@server/utils/getHostname';
import { getMediaServerAdmin } from '@server/utils/getMediaServerAdmin';

const migrateApiTokens = async (settings: any): Promise<AllSettings> => {
  const mediaServerType = settings.main.mediaServerType;
  if (
    !settings.jellyfin?.apiKey &&
    (mediaServerType === MediaServerType.JELLYFIN ||
      mediaServerType === MediaServerType.EMBY)
  ) {
    const admin = await getMediaServerAdmin(MediaServerType.JELLYFIN);
    if (!admin) {
      return settings;
    }
    const jellyfinClient = new JellyfinMainAPI(
      getHostname(settings.jellyfin),
      admin.jellyfinAuthToken,
      admin.jellyfinDeviceId
    );
    jellyfinClient.setUserId(admin.jellyfinUserId ?? '');
    try {
      const apiKey = await jellyfinClient.createApiToken('Seerr');
      settings.jellyfin.apiKey = apiKey;
    } catch {
      throw new Error(
        "Failed to create Jellyfin API token from admin account. Please check your network configuration or edit your settings.json by adding an 'apiKey' field inside of the 'jellyfin' section to fix this issue."
      );
    }
  }
  return settings;
};

export default migrateApiTokens;
