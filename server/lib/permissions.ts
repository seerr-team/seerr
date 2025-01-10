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
  AUTO_APPROVE_MUSIC = 1024,
  REQUEST_4K = 2048,
  REQUEST_4K_MOVIE = 4096,
  REQUEST_4K_TV = 8192,
  REQUEST_ADVANCED = 16384,
  REQUEST_VIEW = 32768,
  AUTO_APPROVE_4K = 65536,
  AUTO_APPROVE_4K_MOVIE = 131072,
  AUTO_APPROVE_4K_TV = 262144,
  REQUEST_MOVIE = 524288,
  REQUEST_TV = 1048576,
  REQUEST_MUSIC = 2097152,
  AUTO_REQUEST = 4194304,
  AUTO_REQUEST_MOVIE = 8388608,
  AUTO_REQUEST_TV = 16777216,
  AUTO_REQUEST_MUSIC = 33554432,
  MANAGE_ISSUES = 67108864,
  VIEW_ISSUES = 134217728,
  CREATE_ISSUES = 268435456,
  RECENT_VIEW = 536870912,
  WATCHLIST_VIEW = 1073741824,
  MANAGE_BLACKLIST = 2147483648,
  VIEW_BLACKLIST = 4294967296,
}

export interface PermissionCheckOptions {
  type: 'and' | 'or';
}

/**
 * Takes a Permission and the users permission value and determines
 * if the user has access to the permission provided. If the user has
 * the admin permission, true will always be returned from this check!
 *
 * @param permissions Single permission or array of permissions
 * @param value users current permission value
 * @param options Extra options to control permission check behavior (mainly for arrays)
 */
export const hasPermission = (
  permissions: Permission | Permission[],
  value: number,
  options: PermissionCheckOptions = { type: 'and' }
): boolean => {
  let total = 0;

  // If we are not checking any permissions, bail out and return true
  if (permissions === 0) {
    return true;
  }

  if (Array.isArray(permissions)) {
    if (value & Permission.ADMIN) {
      return true;
    }
    switch (options.type) {
      case 'and':
        return permissions.every((permission) => !!(value & permission));
      case 'or':
        return permissions.some((permission) => !!(value & permission));
    }
  } else {
    total = permissions;
  }

  return !!(value & Permission.ADMIN) || !!(value & total);
};
