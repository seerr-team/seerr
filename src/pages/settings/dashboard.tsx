import SettingsActivity from '@app/components/Settings/SettingsActivity';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const DashboardSettingsPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);

  return (
    <SettingsLayout>
      <SettingsActivity />
    </SettingsLayout>
  );
};

export default DashboardSettingsPage;
