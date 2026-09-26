import UserSettings from '@app/components/UserProfile/UserSettings';
import UserParentalControlsSettings from '@app/components/UserProfile/UserSettings/UserParentalControlsSettings';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const UserSettingsParentalControlsPage: NextPage = () => {
  useRouteGuard(Permission.MANAGE_USERS);
  return (
    <UserSettings>
      <UserParentalControlsSettings />
    </UserSettings>
  );
};

export default UserSettingsParentalControlsPage;
