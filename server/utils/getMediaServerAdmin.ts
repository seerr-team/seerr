import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';

export const getMediaServerAdmin = async (
  mediaServerType?: MediaServerType
): Promise<User | undefined> => {
  let admin: User | null = null;

  if (!mediaServerType) {
    mediaServerType = getSettings().main.mediaServerType;
  }

  const userRepository = getRepository(User);

  // If it is plex admin is selected using plexToken if jellyfin admin is selected using jellyfinUserID
  if (mediaServerType === MediaServerType.PLEX) {
    admin = await userRepository.findOne({
      select: ['id', 'plexToken'],
      where: { id: 1 },
    });
  } else if (
    mediaServerType === MediaServerType.JELLYFIN ||
    mediaServerType === MediaServerType.EMBY
  ) {
    admin = await userRepository.findOne({
      select: ['id', 'jellyfinUserId', 'jellyfinDeviceId'],
      where: { id: 1 },
    });
  }

  return admin ?? undefined;
};
