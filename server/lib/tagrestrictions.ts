/**
 * A restriction expressed as the labels or tags a user may and may not see.
 *
 * Every media server exposes the same idea under a different name: Plex calls
 * them labels and encodes them in the sharing filter, Jellyfin splits them into
 * `AllowedTags` and `BlockedTags`, Emby keeps a single list whose polarity is
 * flipped by a flag. They are normalised into this shape so the matching rule
 * lives in one place rather than once per server.
 */
export interface TagRestriction {
  allow: string[];
  deny: string[];
  /**
   * Set when the combined restrictions cannot be satisfied by any tag, so
   * nothing is visible and the media server need not be queried at all.
   */
  allowNothing?: boolean;
}

export const EMPTY_TAG_RESTRICTION: TagRestriction = { allow: [], deny: [] };

/**
 * Evaluates a restriction against the tags carried by an item. Items without
 * tags are only visible when no allow list applies.
 *
 * A deny entry wins over an allow entry, which is what both Plex and Jellyfin
 * do: a user allowed and denied the same tag sees nothing carrying it.
 */
export const isAllowedByTagRestriction = (
  restriction: TagRestriction,
  tags: string[]
): boolean => {
  if (restriction.allowNothing) {
    return false;
  }

  const normalized = tags.map((tag) => tag.toLowerCase());

  if (restriction.deny.some((tag) => normalized.includes(tag.toLowerCase()))) {
    return false;
  }

  if (!restriction.allow.length) {
    return true;
  }

  return restriction.allow.some((tag) =>
    normalized.includes(tag.toLowerCase())
  );
};
