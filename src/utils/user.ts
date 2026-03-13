import type { User } from '@app/hooks/useUser';

export const hasLinkedPlexAccount = (
  user?: Pick<User, 'plexId' | 'plexUsername'> | null
): boolean => Boolean(user?.plexId || user?.plexUsername);
