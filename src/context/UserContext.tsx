import type { User } from '@app/hooks/useUser';
import { useUser } from '@app/hooks/useUser';
import { useRouter } from 'next/dist/client/router';
import { useEffect, useRef } from 'react';

interface UserContextProps {
  initialUser: User;
  children?: React.ReactNode;
}

/**
 * This UserContext serves the purpose of just preparing the useUser hooks
 * cache on server side render. It also will handle redirecting the user to
 * the login page if their session ever becomes invalid.
 */
export const UserContext = ({ initialUser, children }: UserContextProps) => {
  const { user, error, revalidate } = useUser({ initialData: initialUser });
  const router = useRouter();
  const routing = useRef(false);
  const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

  useEffect(() => {
    revalidate();
  }, [router.pathname, revalidate]);

  useEffect(() => {
    if (
      !router.pathname.match(/(setup|login|resetpassword)/) &&
      (!user || error) &&
      !routing.current
    ) {
      routing.current = true;
      location.href = `${API_BASE}/login`;
    }
  }, [router, user, error, API_BASE]);

  return <>{children}</>;
};
