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

  // MediaStatus.Blacklisted was added before MediaStatus.Deleted in Jellyseerr
  const mediaRepository = getRepository(Media);
  const mediaToUpdate = await mediaRepository.find({ where: { status: 6 } });

  for (const media of mediaToUpdate) {
    media.status = 7;
    await mediaRepository.save(media);
  }

  return newSettings;
};

export default overseerrMerge;
