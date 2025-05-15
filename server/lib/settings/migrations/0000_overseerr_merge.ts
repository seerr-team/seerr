import { MediaServerType } from '@server/constants/server';
import type { AllSettings } from '@server/lib/settings';

import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';

const overseerrMerge = async (settings: any): Promise<AllSettings> => {
  if (settings.main.mediaServerType) {
    return settings; // already migrated
  }
  const newSettings = { ...settings };
  newSettings.main.mediaServerType = MediaServerType.PLEX;

  // New name
  newSettings.main.applicationTitle = 'Seerr';
  newSettings.notifications.agents.email.options.senderName = 'Seerr';

  // MediaStatus.Blacklisted was added before MediaStatus. Deleted in Jellyseerr
  const mediaRepository = getRepository(Media);
  await mediaRepository
    .createQueryBuilder()
    .update(Media)
    .set({ status: 7 })
    .where('status = :status', { status: 6 })
    .execute();

  return newSettings;
};

export default overseerrMerge;
