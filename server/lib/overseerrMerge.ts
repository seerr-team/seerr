import { MediaServerType } from '@server/constants/server';
import dataSource, { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import Settings from '@server/lib/settings';
import logger from '@server/logger';
import type { MigrationInterface, MixedList, QueryRunner } from 'typeorm';

const checkOverseerrMerge = async (): Promise<boolean> => {
  // Load settings without running migrations
  const settings = await new Settings().load(undefined, true);

  if (settings.main.mediaServerType) {
    return false; // The application has already been migrated
  }

  // Open the database connection to get the migrations
  const dbConnection = await dataSource.initialize();
  const migrations = dbConnection.migrations;
  await dbConnection.destroy();
  // We have to replace a migration not working with Overseerr with a custom one
  try {
    // Apply a filter to replace the specific migration
    // eslint-disable-next-line @typescript-eslint/ban-types
    const newMigrations: MixedList<string | Function> = migrations?.map(
      (migration) =>
        migration.name === 'AddUserAvatarCacheFields1743107645301'
          ? AddUserAvatarCacheFields1743107645301
          : migration.constructor
    );
    dataSource.setOptions({
      ...dataSource.options,
      migrations: newMigrations,
    });
  } catch (error) {
    logger.error('Failed to load migrations for Overseerr merge', {
      label: 'Seerr Migration',
      error: error.message,
    });
    process.exit(1);
  }
  // Reopen the database connection with the updated migrations
  await dataSource.initialize();

  // Add fake migration record to prevent running the already existing Overseerr migration again
  try {
    await dbConnection.query(
      `INSERT INTO migrations (timestamp,name) VALUES (1743023610704, 'UpdateWebPush1743023610704')`
    );
  } catch (error) {
    logger.error(
      'Failed to insert migration record for UpdateWebPush1743023610704',
      {
        label: 'Seerr Migration',
        error: error.message,
      }
    );
    process.exit(1);
  }

  // Manually run the migration to update the database schema
  if (process.env.NODE_ENV === 'production') {
    await dbConnection.query('PRAGMA foreign_keys=OFF');
    await dbConnection.runMigrations();
    await dbConnection.query('PRAGMA foreign_keys=ON');
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
      error: error.message,
    });
    process.exit(1);
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

  // Save the updated settings
  try {
    await settings.save();
  } catch (error) {
    logger.error('Failed to save updated settings for Overseerr merge', {
      label: 'Seerr Migration',
      error: error.message,
    });
    process.exit(1);
  }

  logger.info('Yeah! Overseerr to Seerr migration completed successfully!', {
    label: 'Seerr Migration',
  });

  return true;
};

class AddUserAvatarCacheFields1743107645301 implements MigrationInterface {
  name = 'AddUserAvatarCacheFields1743107645301';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "avatarETag" varchar`);
    await queryRunner.query(`ALTER TABLE "user" ADD "avatarVersion" varchar`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async down(queryRunner: QueryRunner): Promise<void> {
    return;
  }
}

export default checkOverseerrMerge;
