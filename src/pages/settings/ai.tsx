import SettingsLayout from '@app/components/Settings/SettingsLayout';
import SettingsAi from '@app/components/Settings/SettingsAi';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const SettingsAiPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsAi />
    </SettingsLayout>
  );
};

export default SettingsAiPage;
