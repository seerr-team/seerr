import type { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import type { Repository } from 'typeorm';

const getCandidatePriority = (user: User, serverId?: string): number => {
  if (user.id === 1) {
    return 0;
  }

  if (serverId && user.jellyfinServerId === serverId) {
    return 1;
  }

  if (user.hasPermission(Permission.ADMIN)) {
    return 2;
  }

  if (!user.jellyfinServerId) {
    return 3;
  }

  return 4;
};

export const findJellyfinUser = async ({
  userRepository,
  jellyfinUserId,
  serverId,
}: {
  userRepository: Repository<User>;
  jellyfinUserId: string;
  serverId?: string;
}): Promise<User | undefined> => {
  const users = await userRepository
    .createQueryBuilder('user')
    .where('user.jellyfinUserId = :jellyfinUserId', {
      jellyfinUserId,
    })
    .andWhere(
      serverId
        ? "(user.jellyfinServerId = :serverId OR user.jellyfinServerId IS NULL OR user.jellyfinServerId = '')"
        : '1=1',
      serverId ? { serverId } : {}
    )
    .orderBy('user.id', 'ASC')
    .getMany();

  return users.sort((left, right) => {
    const priorityDelta =
      getCandidatePriority(left, serverId) -
      getCandidatePriority(right, serverId);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return left.id - right.id;
  })[0];
};
