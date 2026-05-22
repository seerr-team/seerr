import UserSettings from '@app/components/UserProfile/UserSettings';
import UserMetadataSettings from '@app/components/UserProfile/UserSettings/UserMetadataSettings';
import type { NextPage } from 'next';

const ProfileMetadataPage: NextPage = () => {
  return (
    <UserSettings>
      <UserMetadataSettings />
    </UserSettings>
  );
};

export default ProfileMetadataPage;
