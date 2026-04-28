import { getRepository } from '@server/datasource';
import { UserSettings } from '@server/entity/UserSettings';
import type { AllSettings } from '@server/lib/settings';

const migrateDiscordIdToDiscordIds = async (
  settings: any
): Promise<AllSettings> => {
  if (
    Array.isArray(settings.migrations) &&
    settings.migrations.includes('0009_migrate_discordId_to_discordIds')
  ) {
    return settings;
  }

  const userSettingsRepository = getRepository(UserSettings);
  const allUserSettings = await userSettingsRepository.find();

  const migratedUserSettings = allUserSettings.filter(
    (userSettings) =>
      userSettings.discordId &&
      userSettings.discordId !== '' &&
      (!userSettings.discordIds || userSettings.discordIds.length === 0)
  );

  // we are not actually removing the discordId field in this change,
  // but will not be writing to it anymore
  for (const userSettings of migratedUserSettings) {
    userSettings.discordIds = [userSettings.discordId as string];
    await userSettingsRepository.save(userSettings);
  }

  if (!Array.isArray(settings.migrations)) {
    settings.migrations = [];
  }
  settings.migrations.push('0009_migrate_discordId_to_discordIds');

  return settings;
};

export default migrateDiscordIdToDiscordIds;
