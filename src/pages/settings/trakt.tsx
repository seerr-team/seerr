import SettingsLayout from '@app/components/Settings/SettingsLayout';
import SettingsTrakt from '@app/components/Settings/SettingsTrakt';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const SettingsTraktPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsTrakt />
    </SettingsLayout>
  );
};

export default SettingsTraktPage;
