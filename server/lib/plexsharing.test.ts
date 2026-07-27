import { pickGrantLabel } from '@server/lib/plexsharing';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const sharedWith = (counts: Record<string, number>): Map<string, number> =>
  new Map(Object.entries(counts));

describe('pickGrantLabel', () => {
  it('prefers the label no other user is allowed to see', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['Family', 'Household', 'alice'],
        ['alice'],
        sharedWith({ family: 2, household: 1 })
      ),
      { label: 'alice', alsoVisibleTo: 0 }
    );
  });

  it('breaks ties between exclusive labels on the user name', () => {
    assert.deepEqual(
      pickGrantLabel(['bob', 'carol', 'alice'], ['alice'], sharedWith({})),
      { label: 'alice', alsoVisibleTo: 0 }
    );
  });

  it('falls back to the least shared label when none is exclusive', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['Family', 'Household'],
        ['alice'],
        sharedWith({ family: 2, household: 1 })
      ),
      { label: 'Household', alsoVisibleTo: 1 }
    );
  });

  it('keeps the allow list order when nothing else separates the labels', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['Household', 'Family'],
        [],
        sharedWith({ household: 1, family: 1 })
      ),
      { label: 'Household', alsoVisibleTo: 1 }
    );
  });

  it('matches the user name case-insensitively', () => {
    assert.deepEqual(
      pickGrantLabel(['Family', 'Alice'], ['alice'], sharedWith({})),
      { label: 'Alice', alsoVisibleTo: 0 }
    );
  });

  it('returns null when there is no candidate', () => {
    assert.equal(pickGrantLabel([], ['alice'], sharedWith({})), null);
  });
});
