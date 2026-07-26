import JellyfinAPI from '@server/api/jellyfin';
import { MediaServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { getHostname } from '@server/utils/getHostname';

/**
 * Builds the set of Jellyfin or Emby item ids visible to a user.
 *
 * Unlike Plex, access is granted per library only, there is no label based
 * restriction, and the allowed libraries are taken from the user's policy:
 * `EnableAllFolders` means unrestricted, otherwise `EnabledFolders` lists the
 * library ids the user may browse. Both servers report those fields on the user
 * list, so a single request covers every user.
 *
 * Items are then listed with the owner's credentials, since neither server
 * honours a `userId` filter when queried with an administrator token: Jellyfin
 * answers 401 for a forbidden library, and Emby returns an empty list even for
 * an allowed one.
 *
 * Returns `null` when the user reaches every enabled library, which callers
 * must treat as "no filtering".
 */
export const resolveVisibleJellyfinItemIds = async (
  user: User
): Promise<Set<string> | null> => {
  const settings = getSettings();

  if (
    (settings.main.mediaServerType !== MediaServerType.JELLYFIN &&
      settings.main.mediaServerType !== MediaServerType.EMBY) ||
    user.userType === UserType.PLEX ||
    !user.jellyfinUserId
  ) {
    return null;
  }

  const userRepository = getRepository(User);
  const admin = await userRepository.findOne({
    select: { id: true, jellyfinDeviceId: true, jellyfinUserId: true },
    where: { id: 1 },
  });

  // The owner always reaches the whole library.
  if (!admin || user.id === admin.id) {
    return null;
  }

  const client = new JellyfinAPI(
    getHostname(),
    settings.jellyfin.apiKey,
    admin.jellyfinDeviceId
  );
  client.setUserId(admin.jellyfinUserId ?? '');

  const { users } = await client.getUsers();
  const policy = users.find(
    (candidate) => candidate.Id === user.jellyfinUserId
  )?.Policy;

  // Without a policy there is nothing to enforce; leave availability untouched
  // rather than risk hiding a library the user can actually reach.
  if (!policy || policy.EnableAllFolders !== false) {
    return null;
  }

  const allowedLibraryIds = new Set(policy.EnabledFolders ?? []);
  const enabled = settings.jellyfin.libraries.filter(
    (library) => library.enabled
  );

  if (enabled.every((library) => allowedLibraryIds.has(library.id))) {
    return null;
  }

  const visible = new Set<string>();

  for (const library of enabled) {
    if (!allowedLibraryIds.has(library.id)) {
      // Library not shared with this user: nothing from it is visible.
      continue;
    }

    for (const item of await client.getLibraryContents(library.id)) {
      visible.add(item.Id);
    }
  }

  logger.debug('Resolved media server library restrictions for user', {
    label: 'Media Server Sharing',
    userId: user.id,
    allowedLibraries: enabled
      .filter((library) => allowedLibraryIds.has(library.id))
      .map((library) => library.name),
    visibleItems: visible.size,
  });

  return visible;
};
