import { MediaServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import dataSource, { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { getMediaServerAdmin } from '@server/utils/getMediaServerAdmin';
import { copyFileSync } from 'fs';
import gravatarUrl from 'gravatar-url';
import path from 'path';

const prepareDb = async () => {
  // Copy over test settings.json
  copyFileSync(
    path.join(__dirname, '../../cypress/config/settings.cypress.json'),
    path.join(__dirname, '../../config/settings.json')
  );

  // Connect to DB and seed test data
  const dbConnection = await dataSource.initialize();

  if (process.env.PRESERVE_DB !== 'true') {
    await dbConnection.dropDatabase();
  }

  // Run migrations in production
  if (process.env.WITH_MIGRATIONS === 'true') {
    await dbConnection.runMigrations();
  } else {
    await dbConnection.synchronize();
  }

  const userRepository = getRepository(User);

  const admin = await getMediaServerAdmin(MediaServerType.PLEX);

  // Create the admin user
  const user =
    (await userRepository.findOne({
      where: { email: 'admin@seerr.dev' },
    })) ?? new User();
  user.plexId = admin?.plexId ?? 1;
  user.plexToken = '1234';
  user.plexUsername = 'admin';
  user.username = 'admin';
  user.email = 'admin@seerr.dev';
  user.userType = UserType.PLEX;
  await user.setPassword('test1234');
  user.permissions = 2;
  user.avatar = gravatarUrl('admin@seerr.dev', { default: 'mm', size: 200 });
  await userRepository.save(user);

  // Create the other user
  const otherUser =
    (await userRepository.findOne({
      where: { email: 'friend@seerr.dev' },
    })) ?? new User();
  otherUser.plexId = admin?.plexId ?? 1;
  otherUser.plexToken = '1234';
  otherUser.plexUsername = 'friend';
  otherUser.username = 'friend';
  otherUser.email = 'friend@seerr.dev';
  otherUser.userType = UserType.PLEX;
  await otherUser.setPassword('test1234');
  otherUser.permissions = 32;
  otherUser.avatar = gravatarUrl('friend@seerr.dev', {
    default: 'mm',
    size: 200,
  });
  await userRepository.save(otherUser);
};

prepareDb();
