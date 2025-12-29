import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const ActivitySettingsRedirectPage: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/dashboard');
  }, [router]);

  return null;
};

export default ActivitySettingsRedirectPage;
