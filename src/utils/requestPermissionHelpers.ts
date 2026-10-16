import type {
  Permission,
  PermissionCheckOptions,
} from '@server/lib/permissions';
import { Permission as Perm } from '@server/lib/permissions';

export type HasPermission = (
  permission: Permission | Permission[],
  options?: PermissionCheckOptions
) => boolean;

export const hasAutoApprovePermission = (
  hasPermission: HasPermission,
  mediaType: 'movie' | 'tv',
  is4k: boolean
): boolean =>
  hasPermission(
    [
      Perm.MANAGE_REQUESTS,
      is4k ? Perm.AUTO_APPROVE_4K : Perm.AUTO_APPROVE,
      mediaType === 'movie'
        ? is4k
          ? Perm.AUTO_APPROVE_4K_MOVIE
          : Perm.AUTO_APPROVE_MOVIE
        : is4k
          ? Perm.AUTO_APPROVE_4K_TV
          : Perm.AUTO_APPROVE_TV,
    ],
    { type: 'or' }
  );
