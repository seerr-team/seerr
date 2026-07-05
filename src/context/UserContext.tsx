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

  useEffect(() => {
    revalidate();
  }, [router.pathname, revalidate]);

  useEffect(() => {
    // Only treat the session as invalid when the server actually rejected
    // it. A check that never completed (e.g. the fetch was aborted because
    // the user navigated away, or the server was briefly unreachable)
    // rejects without a response; redirecting on those kicks logged-in
    // users to /login and can even cancel an in-flight navigation to
    // another site, dragging the browser back to the app.
    const sessionInvalid =
      error?.response?.status === 401 || error?.response?.status === 403;

    if (
      !router.pathname.match(/(setup|login|resetpassword)/) &&
      (!user || sessionInvalid) &&
      !routing.current
    ) {
      routing.current = true;
      location.href = '/login';
    }
  }, [router, user, error]);

  return <>{children}</>;
};
