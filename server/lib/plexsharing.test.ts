import { pickGrantLabel } from '@server/lib/plexsharing';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const sharedWith = (counts: Record<string, number>): Map<string, number> =>
  new Map(Object.entries(counts));

describe('pickGrantLabel', () => {
  it('grants the label named after the user', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['Family', 'Household', 'alice'],
        ['alice'],
        sharedWith({ family: 2, household: 1 })
      ),
      { label: 'alice', alsoVisibleTo: 0 }
    );
  });

  it('grants nothing when no label is named after the user', () => {
    assert.equal(
      pickGrantLabel(
        ['Family', 'Household'],
        ['alice'],
        sharedWith({ family: 2, household: 1 })
      ),
      null
    );
  });

  it('grants nothing when the user has no name to match', () => {
    assert.equal(pickGrantLabel(['Family', 'alice'], [], sharedWith({})), null);
  });

  it('matches the user name case-insensitively', () => {
    assert.deepEqual(
      pickGrantLabel(['Family', 'Alice'], ['alice'], sharedWith({})),
      { label: 'Alice', alsoVisibleTo: 0 }
    );
  });

  it('matches any of the names the user is known by', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['Family', 'alice'],
        ['alice.plex', 'alice'],
        sharedWith({})
      ),
      { label: 'alice', alsoVisibleTo: 0 }
    );
  });

  it('reports the other users a matching label is also visible to', () => {
    assert.deepEqual(
      pickGrantLabel(['alice'], ['alice'], sharedWith({ alice: 2 })),
      { label: 'alice', alsoVisibleTo: 2 }
    );
  });

  it('prefers the least shared match when several names apply', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['alice', 'Family', 'alice-plex'],
        ['alice', 'alice-plex'],
        sharedWith({ alice: 2, 'alice-plex': 0 })
      ),
      { label: 'alice-plex', alsoVisibleTo: 0 }
    );
  });

  it('keeps the allow list order when nothing else separates the matches', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['alice-plex', 'alice'],
        ['alice', 'alice-plex'],
        sharedWith({ alice: 1, 'alice-plex': 1 })
      ),
      { label: 'alice-plex', alsoVisibleTo: 1 }
    );
  });

  it('returns null when there is no candidate', () => {
    assert.equal(pickGrantLabel([], ['alice'], sharedWith({})), null);
  });
});
