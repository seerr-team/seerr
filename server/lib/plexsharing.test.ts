import { pickGrantLabel } from '@server/lib/plexsharing';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const sharedWith = (counts: Record<string, number>): Map<string, number> =>
  new Map(Object.entries(counts));

describe('pickGrantLabel', () => {
  it('prefers the label no other user is allowed to see', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['Famille', 'Nico', 'cedric2605'],
        ['cedric2605'],
        sharedWith({ famille: 2, nico: 1 })
      ),
      { label: 'cedric2605', alsoVisibleTo: 0 }
    );
  });

  it('breaks ties between exclusive labels on the user name', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['brunocarrer', 'nikaii', 'cedric2605'],
        ['cedric2605'],
        sharedWith({})
      ),
      { label: 'cedric2605', alsoVisibleTo: 0 }
    );
  });

  it('falls back to the least shared label when none is exclusive', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['Famille', 'Nico'],
        ['cedric2605'],
        sharedWith({ famille: 2, nico: 1 })
      ),
      { label: 'Nico', alsoVisibleTo: 1 }
    );
  });

  it('keeps the allow list order when nothing else separates the labels', () => {
    assert.deepEqual(
      pickGrantLabel(
        ['Nico', 'Famille'],
        [],
        sharedWith({ nico: 1, famille: 1 })
      ),
      { label: 'Nico', alsoVisibleTo: 1 }
    );
  });

  it('matches the user name case-insensitively', () => {
    assert.deepEqual(
      pickGrantLabel(['Famille', 'Cedric2605'], ['cedric2605'], sharedWith({})),
      { label: 'Cedric2605', alsoVisibleTo: 0 }
    );
  });

  it('returns null when there is no candidate', () => {
    assert.equal(pickGrantLabel([], ['cedric2605'], sharedWith({})), null);
  });
});
