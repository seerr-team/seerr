import UserSettings from '@app/components/UserProfile/UserSettings';
import UserMetadataSettings from '@app/components/UserProfile/UserSettings/UserMetadataSettings';
import type { NextPage } from 'next';

const AdminUserMetadataPage: NextPage = () => {
  return (
    <UserSettings>
      <UserMetadataSettings />
    </UserSettings>
  );
};

export default AdminUserMetadataPage;
