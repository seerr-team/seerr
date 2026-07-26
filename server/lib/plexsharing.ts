import PlexAPI from '@server/api/plexapi';
import PlexTvAPI from '@server/api/plextv';
import { MediaServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

/**
 * The set of Plex rating keys a restricted user is allowed to see, or `null`
 * when the user is unrestricted and availability needs no filtering.
 */
export type PlexVisibleRatingKeys = Set<string> | null;

/** Identifies a single item in the Plex library. */
export interface PlexItemRef {
  ratingKey: string;
  type: 'movie' | 'show';
}

const getAdminPlexToken = async (): Promise<string | null> => {
  const userRepository = getRepository(User);
  const admin = await userRepository.findOne({
    select: { id: true, plexToken: true },
    where: { id: 1 },
  });

  return admin?.plexToken ?? null;
};

/**
 * Builds the set of rating keys visible to a user, honouring both the shared
 * library selection and the label restrictions configured in Plex.
 *
 * Returns `null` when the user is unrestricted, which callers must treat as
 * "show everything", so unrestricted setups keep their current behaviour and
 * pay no extra cost.
 */
export const resolveVisiblePlexRatingKeys = async (
  user: User
): Promise<PlexVisibleRatingKeys> => {
  const settings = getSettings();

  if (
    settings.main.mediaServerType !== MediaServerType.PLEX ||
    user.userType !== UserType.PLEX ||
    !user.plexId
  ) {
    return null;
  }

  // The owner always sees the whole library.
  if (user.id === 1) {
    return null;
  }

  const adminToken = await getAdminPlexToken();

  if (!adminToken) {
    return null;
  }

  const rules = await new PlexTvAPI(adminToken).getUserSharingRules(
    user.plexId
  );

  if (!rules) {
    return null;
  }

  const plexClient = new PlexAPI({ plexToken: adminToken });
  const libraries = settings.plex.libraries.filter(
    (library) => library.enabled
  );
  const visible = new Set<string>();

  for (const library of libraries) {
    if (!rules.allLibraries && !rules.sharedSectionKeys.includes(library.id)) {
      // Library not shared with this user: nothing from it is visible.
      continue;
    }

    const filter = library.type === 'show' ? rules.tv : rules.movies;

    if (filter.allowNothing) {
      // The restrictions cannot be satisfied, so skip the library entirely
      // rather than listing items only to discard them.
      continue;
    }

    const allowed = new Set<string>();

    if (filter.allow.length) {
      for (const label of filter.allow) {
        for (const ratingKey of await plexClient.getRatingKeysByLabel(
          library.id,
          label
        )) {
          allowed.add(ratingKey);
        }
      }
    } else {
      // The library is shared without an allow list, so everything in it is
      // visible unless a deny label excludes it.
      for (const ratingKey of await getSectionRatingKeys(
        plexClient,
        library.id
      )) {
        allowed.add(ratingKey);
      }
    }

    for (const label of filter.deny) {
      for (const ratingKey of await plexClient.getRatingKeysByLabel(
        library.id,
        label
      )) {
        allowed.delete(ratingKey);
      }
    }

    for (const ratingKey of allowed) {
      visible.add(ratingKey);
    }
  }

  return visible;
};

/** Lists every rating key of a library section, paging through the results. */
const getSectionRatingKeys = async (
  plexClient: PlexAPI,
  sectionId: string
): Promise<string[]> => {
  const ratingKeys: string[] = [];
  const size = 500;
  let offset = 0;
  let totalSize = 0;

  do {
    const { totalSize: total, items } = await plexClient.getLibraryContents(
      sectionId,
      { offset, size }
    );
    totalSize = total;
    ratingKeys.push(...items.map((item) => item.ratingKey));
    offset += size;
  } while (offset < totalSize);

  return ratingKeys;
};

/**
 * Grants a restricted user access to an item already present in the library, by
 * adding one of the labels they are allowed to see.
 *
 * Returns the label that was applied, or `null` when nothing had to be done:
 * the user is unrestricted, already has access, or has no allow list to draw a
 * label from (a deny-only restriction cannot be satisfied this way).
 */
export const grantLabelAccess = async (
  user: User,
  { ratingKey, type }: PlexItemRef
): Promise<string | null> => {
  const settings = getSettings();

  if (
    settings.main.mediaServerType !== MediaServerType.PLEX ||
    user.userType !== UserType.PLEX ||
    !user.plexId ||
    user.id === 1
  ) {
    return null;
  }

  const adminToken = await getAdminPlexToken();

  if (!adminToken) {
    return null;
  }

  const rules = await new PlexTvAPI(adminToken).getUserSharingRules(
    user.plexId
  );

  if (!rules) {
    return null;
  }

  const filter = type === 'show' ? rules.tv : rules.movies;

  if (filter.allowNothing) {
    return null;
  }

  // Case-insensitive, to match how the filter is evaluated: granting a label
  // that the deny list then rejects would achieve nothing.
  const denied = new Set(filter.deny.map((entry) => entry.toLowerCase()));
  const label = filter.allow.find(
    (candidate) => !denied.has(candidate.toLowerCase())
  );

  if (!label) {
    return null;
  }

  await new PlexAPI({ plexToken: adminToken }).addLabel(ratingKey, type, label);

  logger.info('Granted Plex library access by adding a label', {
    label: 'Plex Sharing',
    userId: user.id,
    ratingKey,
    plexLabel: label,
  });

  return label;
};
