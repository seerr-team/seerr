import UserSettings from '@app/components/UserProfile/UserSettings';
import UserAppearanceSettings from '@app/components/UserProfile/UserSettings/UserAppearanceSettings';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const UserAppearanceSettingsPage: NextPage = () => {
  useRouteGuard(Permission.MANAGE_USERS);
  return (
    <UserSettings>
      <UserAppearanceSettings />
    </UserSettings>
  );
};

export default UserAppearanceSettingsPage;
