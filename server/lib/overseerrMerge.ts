import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import Settings from '@server/lib/settings';
import logger from '@server/logger';
import type { DataSource } from 'typeorm';

const checkOverseerrMerge = async (dbConnection: DataSource) => {
  // Load settings without running migrations
  const settings = await new Settings().load(undefined, true);

  if (settings.main.mediaServerType) {
    return; // The application has already been migrated
  }

  // Add fake migration record to prevent running migrations again
  try {
    await dbConnection.query(
      `INSERT INTO migrations (timestamp,name) VALUES (1743023610704, 'UpdateWebPush1743023610704')`
    );
  } catch (error) {
    logger.error(
      'Failed to insert migration record for UpdateWebPush1743023610704',
      {
        label: 'Seerr Migration',
        message: error.message,
      }
    );
  }

  // Set media server type to Plex (default for Overseerr)
  settings.main.mediaServerType = MediaServerType.PLEX;

  // Replace default Overseerr values with Seerr values
  if (settings.main.applicationTitle === 'Overseerr') {
    settings.main.applicationTitle = 'Seerr';
  }
  if (settings.notifications.agents.email.options.senderName === 'Overseerr') {
    settings.notifications.agents.email.options.senderName = 'Seerr';
  }

  // MediaStatus.Blacklisted was added before MediaStatus.Deleted in Jellyseerr
  try {
    const mediaRepository = getRepository(Media);
    const mediaToUpdate = await mediaRepository.find({ where: { status: 6 } });
    for (const media of mediaToUpdate) {
      media.status = 7;
      await mediaRepository.save(media);
    }
  } catch (error) {
    logger.error('Failed to update Media status from Blacklisted to Deleted', {
      label: 'Seerr Migration',
      message: error.message,
    });
  }

  // Save updated settings
  try {
    await settings.save();
    logger.info('Successfully migrated Overseerr to Seerr', {
      label: 'Seerr Migration',
    });
  } catch (error) {
    logger.error('Failed to save updated settings after Overseerr migration', {
      label: 'Seerr Migration',
      message: error.message,
    });
  }
};

export default checkOverseerrMerge;
