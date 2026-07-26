import type {
  JellyfinLibraryItem,
  JellyfinUserResponse,
} from '@server/api/jellyfin';
import JellyfinAPI from '@server/api/jellyfin';
import { MediaServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import type { TagRestriction } from '@server/lib/tagrestrictions';
import { isAllowedByTagRestriction } from '@server/lib/tagrestrictions';
import logger from '@server/logger';
import { getHostname } from '@server/utils/getHostname';

/**
 * Builds the set of Jellyfin or Emby item ids visible to a user.
 *
 * The allowed libraries are taken from the user's policy: `EnableAllFolders`
 * means unrestricted, otherwise `EnabledFolders` lists the library ids the user
 * may browse. Both servers report those fields on the user list, so a single
 * request covers every user.
 *
 * Only that library dimension is handled here. Both servers carry a second,
 * tag based mechanism which is the direct analogue of Plex labels, and which
 * they do enforce: Jellyfin exposes `AllowedTags` and `BlockedTags` on the
 * policy, Emby `IncludeTags`, `BlockedTags` and `IsTagBlockingModeInclusive`.
 * A user restricted that way is still reported as having access here.
 *
 * Items are then listed with the owner's credentials, since neither server
 * honours a `userId` filter when queried with an administrator token: Jellyfin
 * answers 401 for a forbidden library, and Emby returns an empty list even for
 * an allowed one.
 *
 * Returns `null` when the user reaches every enabled library, which callers
 * must treat as "no filtering".
 */
/**
 * Normalises the tag restrictions of a user policy, whose shape differs between
 * the two servers. Both behaviours were established against real servers:
 * Jellyfin applies `AllowedTags` and `BlockedTags` independently, while Emby
 * keeps a single list in `BlockedTags` that `IsTagBlockingModeInclusive` turns
 * from a deny list into an allow list.
 */
export const parseTagRestriction = (
  policy: JellyfinUserResponse['Policy'],
  serverType: MediaServerType
): TagRestriction => {
  const blocked = policy.BlockedTags ?? [];

  if (serverType === MediaServerType.EMBY) {
    return policy.IsTagBlockingModeInclusive
      ? { allow: [...blocked], deny: [] }
      : { allow: [], deny: [...blocked] };
  }

  return { allow: [...(policy.AllowedTags ?? [])], deny: [...blocked] };
};

/** Jellyfin reports item tags as `Tags`, Emby as `TagItems`. */
const getItemTags = (item: JellyfinLibraryItem): string[] =>
  item.Tags ?? item.TagItems?.map((tag) => tag.Name) ?? [];

/**
 * Builds the test telling whether a configured library is shared with the user.
 *
 * Emby's policy references libraries by their guid while the id stored in the
 * settings is the numeric one it returns elsewhere, so a policy entry has to be
 * matched against either identifier. Getting this wrong is not a partial
 * failure: no library matches and the whole library reads as unavailable.
 */
const buildLibraryMatcher = async (
  client: JellyfinAPI,
  policy: JellyfinUserResponse['Policy']
): Promise<(library: { id: string }) => boolean> => {
  const allowedFolders = new Set(policy.EnabledFolders ?? []);
  const guidById = new Map(
    (await client.getLibraries())
      .filter((library) => library.guid)
      .map((library) => [library.key, library.guid as string])
  );

  return (library) => {
    if (allowedFolders.has(library.id)) {
      return true;
    }

    const guid = guidById.get(library.id);

    return !!guid && allowedFolders.has(guid);
  };
};

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
  if (!policy) {
    return null;
  }

  const tagRestriction = parseTagRestriction(
    policy,
    settings.main.mediaServerType
  );
  const hasTagRestrictions =
    tagRestriction.allow.length > 0 || tagRestriction.deny.length > 0;
  const reachesEveryLibrary = policy.EnableAllFolders !== false;

  if (reachesEveryLibrary && !hasTagRestrictions) {
    return null;
  }

  const enabled = settings.jellyfin.libraries.filter(
    (library) => library.enabled
  );
  const isLibraryAllowed = reachesEveryLibrary
    ? () => true
    : await buildLibraryMatcher(client, policy);

  if (enabled.every(isLibraryAllowed) && !hasTagRestrictions) {
    return null;
  }

  const visible = new Set<string>();

  for (const library of enabled) {
    if (!isLibraryAllowed(library)) {
      // Library not shared with this user: nothing from it is visible.
      continue;
    }

    // Tags are only requested when they can change the outcome, since both
    // servers return a long list of metadata keywords under the same field.
    const items = await client.getLibraryContents(
      library.id,
      hasTagRestrictions ? { fields: 'Tags,TagItems' } : {}
    );

    for (const item of items) {
      if (
        hasTagRestrictions &&
        !isAllowedByTagRestriction(tagRestriction, getItemTags(item))
      ) {
        continue;
      }

      visible.add(item.Id);
    }
  }

  logger.debug('Resolved media server library restrictions for user', {
    label: 'Media Server Sharing',
    userId: user.id,
    allowedLibraries: enabled
      .filter(isLibraryAllowed)
      .map((library) => library.name),
    tagRestriction: hasTagRestrictions ? tagRestriction : undefined,
    visibleItems: visible.size,
  });

  return visible;
};
