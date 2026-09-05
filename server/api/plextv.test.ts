import {
  isAllowedByLabelFilter,
  parsePlexLabelFilter,
} from '@server/api/plextv';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('parsePlexLabelFilter', () => {
  it('returns empty lists when no restriction is set', () => {
    for (const value of [undefined, null, '']) {
      assert.deepEqual(parsePlexLabelFilter(value), { allow: [], deny: [] });
    }
  });

  it('parses a single allowed label', () => {
    assert.deepEqual(parsePlexLabelFilter('label=Family'), {
      allow: ['Family'],
      deny: [],
    });
  });

  it('parses several comma separated labels', () => {
    assert.deepEqual(parsePlexLabelFilter('label=Family,Kids'), {
      allow: ['Family', 'Kids'],
      deny: [],
    });
  });

  it('decodes url encoded values, as returned by plex.tv', () => {
    assert.deepEqual(parsePlexLabelFilter('label=Family%2CKids'), {
      allow: ['Family', 'Kids'],
      deny: [],
    });
  });

  it('parses negated restrictions into the deny list', () => {
    assert.deepEqual(parsePlexLabelFilter('label!=Private'), {
      allow: [],
      deny: ['Private'],
    });
  });

  it('handles allow and deny clauses in the same filter', () => {
    assert.deepEqual(parsePlexLabelFilter('label=Family&label!=Private'), {
      allow: ['Family'],
      deny: ['Private'],
    });
  });

  it('ignores clauses that are not label based', () => {
    assert.deepEqual(parsePlexLabelFilter('contentRating=PG&label=Family'), {
      allow: ['Family'],
      deny: [],
    });
  });

  it('keeps encoded separators inside a label value', () => {
    // %26 is `&`, which must not be mistaken for a clause separator.
    assert.deepEqual(parsePlexLabelFilter('label=Tom%20%26%20Jerry'), {
      allow: ['Tom & Jerry'],
      deny: [],
    });
  });

  it('does not throw on a malformed encoding', () => {
    assert.deepEqual(parsePlexLabelFilter('label=100%'), {
      allow: ['100%'],
      deny: [],
    });
  });

  it('drops empty values and surrounding whitespace', () => {
    assert.deepEqual(parsePlexLabelFilter('label= Family , ,Kids '), {
      allow: ['Family', 'Kids'],
      deny: [],
    });
  });
});

describe('isAllowedByLabelFilter', () => {
  it('hides everything when the restrictions cannot be satisfied', () => {
    assert.equal(
      isAllowedByLabelFilter({ allow: [], deny: [], allowNothing: true }, [
        'Family',
      ]),
      false
    );
  });

  it('allows anything when no restriction applies', () => {
    assert.equal(isAllowedByLabelFilter({ allow: [], deny: [] }, []), true);
    assert.equal(
      isAllowedByLabelFilter({ allow: [], deny: [] }, ['Family']),
      true
    );
  });

  it('requires one of the allowed labels', () => {
    const filter = { allow: ['Family', 'Kids'], deny: [] };

    assert.equal(isAllowedByLabelFilter(filter, ['Family']), true);
    assert.equal(isAllowedByLabelFilter(filter, ['Other', 'Kids']), true);
    assert.equal(isAllowedByLabelFilter(filter, ['Other']), false);
  });

  it('hides unlabelled media when an allow list is set', () => {
    assert.equal(
      isAllowedByLabelFilter({ allow: ['Family'], deny: [] }, []),
      false
    );
  });

  it('denies media carrying a denied label, even when also allowed', () => {
    assert.equal(
      isAllowedByLabelFilter({ allow: ['Family'], deny: ['Private'] }, [
        'Family',
        'Private',
      ]),
      false
    );
  });

  it('compares labels case insensitively', () => {
    assert.equal(
      isAllowedByLabelFilter({ allow: ['family'], deny: [] }, ['Family']),
      true
    );
    assert.equal(
      isAllowedByLabelFilter({ allow: [], deny: ['private'] }, ['PRIVATE']),
      false
    );
  });
});
