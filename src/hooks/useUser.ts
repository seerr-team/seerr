import { UserType } from '@server/constants/user';
import type { PermissionCheckOptions } from '@server/lib/permissions';
import { hasPermission, Permission } from '@server/lib/permissions';
import type { NotificationAgentKey } from '@server/lib/settings';
import { useRouter } from 'next/router';
import type { MutatorCallback } from 'swr';
import useSWR from 'swr';

export { Permission, UserType };
export type { PermissionCheckOptions };

export interface User {
  id: number;
  warnings: string[];
  plexUsername?: string | null;
  jellyfinUsername?: string | null;
  username?: string;
  displayName: string;
  email: string;
  avatar: string;
  permissions: number;
  userType: number;
  createdAt: Date;
  updatedAt: Date;
  requestCount: number;
  settings?: UserSettings;
}

type NotificationAgentTypes = Record<NotificationAgentKey, number>;

export interface UserSettings {
  discordId?: string;
  discoverRegion?: string;
  streamingRegion?: string;
  originalLanguage?: string;
  locale?: string;
  notificationTypes: Partial<NotificationAgentTypes>;
  watchlistSyncMovies?: boolean;
  watchlistSyncTv?: boolean;
}

interface UserHookResponse {
  user?: User;
  loading: boolean;
  error: string;
  revalidate: (
    data?: User | Promise<User> | MutatorCallback<User> | undefined,
    shouldRevalidate?: boolean | undefined
  ) => Promise<User | undefined>;
  hasPermission: (
    permission: Permission | Permission[],
    options?: PermissionCheckOptions
  ) => boolean;
}

export const useUser = ({
  id,
  initialData,
}: { id?: number; initialData?: User } = {}): UserHookResponse => {
  const router = useRouter();
  const isAuthPage = /^\/(login|setup|resetpassword(?:\/|$))/.test(
    router.pathname
  );

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<User>(id ? `/api/v1/user/${id}` : `/api/v1/auth/me`, {
    fallbackData: initialData,
    refreshInterval: !isAuthPage ? 30000 : 0,
    revalidateOnFocus: !isAuthPage,
    revalidateOnMount: !isAuthPage,
    revalidateOnReconnect: !isAuthPage,
    errorRetryInterval: 30000,
    shouldRetryOnError: false,
  });

  const checkPermission = (
    permission: Permission | Permission[],
    options?: PermissionCheckOptions
  ): boolean => {
    return hasPermission(permission, data?.permissions ?? 0, options);
  };

  return {
    user: data,
    loading: !data && !error,
    error,
    hasPermission: checkPermission,
    revalidate,
  };
};
