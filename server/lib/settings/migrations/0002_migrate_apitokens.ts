import JellyfinAPI from '@server/api/jellyfin';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import type { AllSettings } from '@server/lib/settings';
import { getHostname } from '@server/utils/getHostname';
import type { LegacySettings } from './types';

const migrateApiTokens = async (
  settings: LegacySettings
): Promise<AllSettings> => {
  const mediaServerType = settings.main.mediaServerType;
  if (
    !settings.jellyfin?.apiKey &&
    (mediaServerType === MediaServerType.JELLYFIN ||
      mediaServerType === MediaServerType.EMBY)
  ) {
    const jellyfinSettings = settings.jellyfin;

    if (!jellyfinSettings) {
      return settings as AllSettings;
    }

    const userRepository = getRepository(User);
    const admin = await userRepository.findOne({
      where: { id: 1 },
      select: ['id', 'jellyfinAuthToken', 'jellyfinUserId', 'jellyfinDeviceId'],
      order: { id: 'ASC' },
    });
    if (!admin) {
      return settings as AllSettings;
    }
    const jellyfinClient = new JellyfinAPI(
      getHostname(jellyfinSettings),
      admin.jellyfinAuthToken,
      admin.jellyfinDeviceId
    );
    jellyfinClient.setUserId(admin.jellyfinUserId ?? '');
    try {
      const apiKey = await jellyfinClient.createApiToken('Seerr');
      jellyfinSettings.apiKey = apiKey;
    } catch {
      throw new Error(
        "Failed to create Jellyfin API token from admin account. Please check your network configuration or edit your settings.json by adding an 'apiKey' field inside of the 'jellyfin' section to fix this issue."
      );
    }
  }
  return settings as AllSettings;
};

export default migrateApiTokens;
