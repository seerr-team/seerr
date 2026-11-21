import UserSettings from '@app/components/UserProfile/UserSettings';
import UserApiKey from '@app/components/UserProfile/UserSettings/UserApiKey';
import type { NextPage } from 'next';

const UserApiKeyPage: NextPage = () => {
  return (
    <UserSettings>
      <UserApiKey />
    </UserSettings>
  );
};

export default UserApiKeyPage;
