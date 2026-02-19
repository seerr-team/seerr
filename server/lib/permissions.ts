export enum Permission {
  NONE = 0,
  ADMIN = 2,
  MANAGE_SETTINGS = 4,
  MANAGE_USERS = 8,
  MANAGE_REQUESTS = 16,
  REQUEST = 32,
  VOTE = 64,
  AUTO_APPROVE = 128,
  AUTO_APPROVE_MOVIE = 256,
  AUTO_APPROVE_TV = 512,
  REQUEST_4K = 1024,
  REQUEST_4K_MOVIE = 2048,
  REQUEST_4K_TV = 4096,
  REQUEST_ADVANCED = 8192,
  REQUEST_VIEW = 16384,
  AUTO_APPROVE_4K = 32768,
  AUTO_APPROVE_4K_MOVIE = 65536,
  AUTO_APPROVE_4K_TV = 131072,
  REQUEST_MOVIE = 262144,
  REQUEST_TV = 524288,
  MANAGE_ISSUES = 1048576,
  VIEW_ISSUES = 2097152,
  CREATE_ISSUES = 4194304,
  AUTO_REQUEST = 8388608,
  AUTO_REQUEST_MOVIE = 16777216,
  AUTO_REQUEST_TV = 33554432,
  RECENT_VIEW = 67108864,
  WATCHLIST_VIEW = 134217728,
  MANAGE_BLOCKLIST = 268435456,
  VIEW_BLOCKLIST = 1073741824,
}

export interface PermissionCheckOptions {
  type: 'and' | 'or';
}

/**
 * Checks if a permission is an auto-approve permission.
 * Admin users should NOT automatically bypass these permissions,
 * allowing third-party tools to intercept and process requests.
 */
function isAutoApprovePermission(perm: Permission): boolean {
  return (
    perm === Permission.AUTO_APPROVE ||
    perm === Permission.AUTO_APPROVE_MOVIE ||
    perm === Permission.AUTO_APPROVE_TV ||
    perm === Permission.AUTO_APPROVE_4K ||
    perm === Permission.AUTO_APPROVE_4K_MOVIE ||
    perm === Permission.AUTO_APPROVE_4K_TV
  );
}

/**
 * Takes a Permission and the users permission value and determines
 * if the user has access to the permission provided. If the user has
 * the admin permission, true will be returned UNLESS the permission
 * being checked is an auto-approve permission (to allow third-party
 * tools to intercept requests).
 *
 * @param permissions Single permission or array of permissions
 * @param userPermissionValue users current permission value
 * @param options Extra options to control permission check behavior (mainly for arrays)
 */
export const hasPermission = (
  permissions: Permission | Permission[],
  userPermissionValue: number,
  options: PermissionCheckOptions = { type: 'and' }
): boolean => {
  // If we are not checking any permissions, bail out and return true
  // This handles isAuthenticated() called with no arguments (any logged-in user)
  if (permissions === 0) {
    return true;
  }

  // Normalize permissions to an array
  const requiredPermissions: Permission[] = Array.isArray(permissions)
    ? permissions
    : [permissions];

  // If we're checking an empty array, return true
  if (requiredPermissions.length === 0) {
    return true;
  }

  // Handle array of permissions
  if (Array.isArray(permissions)) {
    // Check if this array includes ANY auto-approve permission
    const includesAutoApprove = requiredPermissions.some((perm) =>
      isAutoApprovePermission(perm)
    );

    // If there's NO auto-approve permission in the list, admin bypasses
    if (!includesAutoApprove && userPermissionValue & Permission.ADMIN) {
      return true;
    }

    // Otherwise, do the normal bit checks for each required permission
    switch (options.type) {
      case 'and':
        return requiredPermissions.every(
          (perm) => !!(userPermissionValue & perm)
        );
      case 'or':
        return requiredPermissions.some(
          (perm) => !!(userPermissionValue & perm)
        );
    }
  }

  // Handle single permission
  const singlePerm = requiredPermissions[0];
  // If it's NOT an auto-approve permission, let admin pass automatically
  if (
    !isAutoApprovePermission(singlePerm) &&
    userPermissionValue & Permission.ADMIN
  ) {
    return true;
  }

  // Otherwise, must explicitly match the permission bit
  return !!(userPermissionValue & singlePerm);
};
