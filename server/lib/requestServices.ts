import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import logger from '@server/logger';

export async function removeRequestServiceGrants(
  serviceType: 'radarr' | 'sonarr',
  serviceId: number
): Promise<void> {
  const identifier = `${serviceType}:${serviceId}`;
  const userRepository = getRepository(User);

  const users = await userRepository
    .createQueryBuilder('user')
    .where('user.requestServices LIKE :identifier', {
      identifier: `%"${identifier}"%`,
    })
    .getMany();

  for (const user of users) {
    user.requestServices = (user.requestServices ?? []).filter(
      (grant) => grant !== identifier
    );
    await userRepository.save(user);
  }

  if (users.length > 0) {
    logger.info(
      `Removed the ${identifier} request service grant from ${users.length} user(s)`,
      { label: 'Settings' }
    );
  }
}
