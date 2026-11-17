import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';

export async function seedManagerAndAdmin() {
  const userRepository = getRepository(User);

  const manager = await userRepository.findOneOrFail({
    where: { email: 'demo@seerr.dev' },
  });
  manager.permissions = Permission.MANAGE_USERS;
  await userRepository.save(manager);

  const otherAdmin = await userRepository.save(
    new User({
      email: 'admin2@seerr.dev',
      username: 'admin2',
      permissions: Permission.ADMIN,
      userType: UserType.LOCAL,
      avatar: '',
    })
  );

  return { manager, otherAdmin };
}

export async function permissionsOf(id: number) {
  const user = await getRepository(User).findOneOrFail({ where: { id } });
  return user.permissions;
}
