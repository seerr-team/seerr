import type { JellyfinUserResponse } from '@server/api/jellyfin';
import { MediaServerType } from '@server/constants/server';
import { parseTagRestriction } from '@server/lib/jellyfinsharing';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

type Policy = JellyfinUserResponse['Policy'];

const policy = (fields: Partial<Policy>): Policy =>
  ({ IsAdministrator: false, ...fields }) as Policy;

describe('parseTagRestriction', () => {
  describe('Jellyfin', () => {
    const parse = (fields: Partial<Policy>) =>
      parseTagRestriction(policy(fields), MediaServerType.JELLYFIN);

    it('reads the two lists independently', () => {
      assert.deepEqual(
        parse({ AllowedTags: ['Family'], BlockedTags: ['Private'] }),
        { allow: ['Family'], deny: ['Private'] }
      );
    });

    it('returns an empty restriction when the policy carries no tag', () => {
      assert.deepEqual(parse({}), { allow: [], deny: [] });
    });

    it('ignores the Emby inclusive flag', () => {
      // The flag exists on Jellyfin policies too but has no meaning there, so
      // reading it would silently turn a deny list into an allow list.
      assert.deepEqual(
        parse({ BlockedTags: ['Private'], IsTagBlockingModeInclusive: true }),
        { allow: [], deny: ['Private'] }
      );
    });
  });

  describe('Emby', () => {
    const parse = (fields: Partial<Policy>) =>
      parseTagRestriction(policy(fields), MediaServerType.EMBY);

    it('treats the single list as a deny list by default', () => {
      assert.deepEqual(
        parse({ BlockedTags: ['Private'], IsTagBlockingModeInclusive: false }),
        { allow: [], deny: ['Private'] }
      );
    });

    it('turns the same list into an allow list in inclusive mode', () => {
      assert.deepEqual(
        parse({ BlockedTags: ['Family'], IsTagBlockingModeInclusive: true }),
        { allow: ['Family'], deny: [] }
      );
    });

    it('ignores AllowedTags, which Emby does not use', () => {
      assert.deepEqual(parse({ AllowedTags: ['Family'] }), {
        allow: [],
        deny: [],
      });
    });
  });
});
