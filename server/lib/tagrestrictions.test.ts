import { isAllowedByTagRestriction } from '@server/lib/tagrestrictions';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('isAllowedByTagRestriction', () => {
  it('allows everything when no restriction applies', () => {
    assert.equal(
      isAllowedByTagRestriction({ allow: [], deny: [] }, ['anything']),
      true
    );
    assert.equal(isAllowedByTagRestriction({ allow: [], deny: [] }, []), true);
  });

  it('denies an item carrying a denied tag', () => {
    assert.equal(
      isAllowedByTagRestriction({ allow: [], deny: ['Private'] }, ['Private']),
      false
    );
    assert.equal(
      isAllowedByTagRestriction({ allow: [], deny: ['Private'] }, ['Family']),
      true
    );
  });

  it('requires one of the allowed tags when an allow list applies', () => {
    const restriction = { allow: ['Family'], deny: [] };

    assert.equal(isAllowedByTagRestriction(restriction, ['Family']), true);
    assert.equal(isAllowedByTagRestriction(restriction, ['Other']), false);
    assert.equal(isAllowedByTagRestriction(restriction, []), false);
  });

  it('lets a denied tag win over an allowed one', () => {
    // Matches what both Plex and Jellyfin do when the same tag is on both
    // lists: nothing carrying it is visible, and nothing without it satisfies
    // the allow list either.
    const restriction = { allow: ['Shared'], deny: ['Shared'] };

    assert.equal(isAllowedByTagRestriction(restriction, ['Shared']), false);
    assert.equal(isAllowedByTagRestriction(restriction, ['Other']), false);
  });

  it('compares tags case-insensitively', () => {
    assert.equal(
      isAllowedByTagRestriction({ allow: ['family'], deny: [] }, ['Family']),
      true
    );
    assert.equal(
      isAllowedByTagRestriction({ allow: [], deny: ['PRIVATE'] }, ['private']),
      false
    );
  });

  it('shows nothing when the restriction is unsatisfiable', () => {
    assert.equal(
      isAllowedByTagRestriction({ allow: [], deny: [], allowNothing: true }, [
        'Family',
      ]),
      false
    );
  });
});
