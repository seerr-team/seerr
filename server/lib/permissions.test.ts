import { hasPermission, Permission } from '@server/lib/permissions';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('hasPermission', () => {
  it('does not grant unrelated legacy permissions to a value that never included them', () => {
    const value = Permission.MANAGE_REQUESTS | Permission.REQUEST;
    assert.equal(hasPermission(Permission.MANAGE_USERS, value), false);
    assert.equal(hasPermission(Permission.KEEP_MEDIA, value), false);
  });

  it('still recognizes legacy permissions on a value that includes them', () => {
    const value = Permission.MANAGE_REQUESTS | Permission.REQUEST;
    assert.equal(hasPermission(Permission.MANAGE_REQUESTS, value), true);
    assert.equal(hasPermission(Permission.REQUEST, value), true);
  });

  it('ADMIN still implies every legacy permission, with or without KEEP_MEDIA', () => {
    assert.equal(
      hasPermission(Permission.MANAGE_USERS, Permission.ADMIN),
      true
    );
    assert.equal(
      hasPermission(
        [Permission.MANAGE_USERS, Permission.MANAGE_REQUESTS],
        Permission.ADMIN,
        { type: 'and' }
      ),
      true
    );
  });

  it('a legacy value (built before KEEP_MEDIA existed) does not implicitly gain it', () => {
    const legacyValue =
      Permission.MANAGE_REQUESTS | Permission.REQUEST | Permission.AUTO_APPROVE;
    assert.equal((legacyValue & Permission.KEEP_MEDIA) === 0, true);
    assert.equal(hasPermission(Permission.KEEP_MEDIA, legacyValue), false);
  });

  it('array checks with "and"/"or" behave the same for legacy permissions', () => {
    const value = Permission.MANAGE_USERS | Permission.MANAGE_REQUESTS;
    assert.equal(
      hasPermission(
        [Permission.MANAGE_USERS, Permission.MANAGE_REQUESTS],
        value,
        {
          type: 'and',
        }
      ),
      true
    );
    assert.equal(
      hasPermission([Permission.MANAGE_USERS, Permission.VIEW_ISSUES], value, {
        type: 'or',
      }),
      true
    );
    assert.equal(
      hasPermission([Permission.MANAGE_USERS, Permission.VIEW_ISSUES], value, {
        type: 'and',
      }),
      false
    );
  });

  it('NONE (0) as the permissions argument always passes, unaffected by KEEP_MEDIA', () => {
    assert.equal(hasPermission(Permission.NONE, Permission.NONE), true);
  });

  it('KEEP_MEDIA behaves like any other independent bit flag', () => {
    const value = Permission.KEEP_MEDIA | Permission.REQUEST;
    assert.equal(hasPermission(Permission.KEEP_MEDIA, value), true);
    assert.equal(hasPermission(Permission.MANAGE_USERS, value), false);
  });
});
