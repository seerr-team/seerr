import type { User } from '@app/hooks/useUser';

export const hasLinkedPlexAccount = (
  user?: Pick<User, 'plexId' | 'plexUsername'> | null
): boolean =>
  user != null && (user.plexId != null || user.plexUsername != null);
