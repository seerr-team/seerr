import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { UserSettings } from '@server/entity/UserSettings';
import assert from 'node:assert/strict';

const credentials = {
  pgpKey: 'test-pgp-key',
  discordIds: ['112233445566'],
  pushbulletAccessToken: 'test-pushbullet-token',
  pushoverApplicationToken: 'test-pushover-app-token',
  pushoverUserKey: 'test-pushover-user-key',
  telegramChatId: '-1001234567',
};

export const allowlistedSettings = {
  locale: 'de',
  discoverRegion: 'DE',
  streamingRegion: 'DE',
  originalLanguage: 'de',
  watchlistSyncMovies: true,
  watchlistSyncTv: false,
};

export async function seedUserSettings(email: string): Promise<User> {
  const userRepository = getRepository(User);
  const user = await userRepository.findOneOrFail({ where: { email } });

  user.settings = new UserSettings({
    ...credentials,
    ...allowlistedSettings,
    notificationTypes: {},
  });

  return userRepository.save(user);
}

export function assertNoCredentials(body: unknown): void {
  const serialized = JSON.stringify(body);

  const secrets = [
    credentials.pgpKey,
    ...credentials.discordIds,
    credentials.pushbulletAccessToken,
    credentials.pushoverApplicationToken,
    credentials.pushoverUserKey,
    credentials.telegramChatId,
  ];

  for (const secret of secrets) {
    assert.ok(!serialized.includes(secret), `${secret} was serialized`);
  }
}
