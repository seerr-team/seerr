import UserSettings from '@app/components/UserProfile/UserSettings';
import UserApiKey from '@app/components/UserProfile/UserSettings/UserApiKey';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const UserApiKeyPage: NextPage = () => {
  useRouteGuard(Permission.MANAGE_USERS);
  return (
    <UserSettings>
      <UserApiKey />
    </UserSettings>
  );
};

export default UserApiKeyPage;
