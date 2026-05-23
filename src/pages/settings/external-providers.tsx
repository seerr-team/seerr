import SettingsExternalProviders from '@app/components/Settings/SettingsExternalProviders';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const ExternalProvidersSettingsPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);

  return (
    <SettingsLayout>
      <SettingsExternalProviders />
    </SettingsLayout>
  );
};

export default ExternalProvidersSettingsPage;
