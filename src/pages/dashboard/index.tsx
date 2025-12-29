import Activity from '@app/components/Activity';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import { MediaServerType } from '@server/constants/server';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const DashboardPage: NextPage = () => {
  const router = useRouter();
  const settings = useSettings();
  const { hasPermission } = useUser();

  useEffect(() => {
    if (settings.currentSettings.mediaServerType !== MediaServerType.PLEX) {
      router.replace('/');
      return;
    }

    if (!settings.currentSettings.activityEnabled) {
      router.replace(
        hasPermission(Permission.ADMIN) ? '/settings/dashboard' : '/'
      );
    }
  }, [
    hasPermission,
    router,
    settings.currentSettings.activityEnabled,
    settings.currentSettings.mediaServerType,
  ]);

  if (
    settings.currentSettings.mediaServerType !== MediaServerType.PLEX ||
    !settings.currentSettings.activityEnabled
  ) {
    return null;
  }

  return <Activity />;
};

export default DashboardPage;
