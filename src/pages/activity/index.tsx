import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const ActivityPageRedirect: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return null;
};

export default ActivityPageRedirect;
