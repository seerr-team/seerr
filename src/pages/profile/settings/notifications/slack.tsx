import UserSettings from '@app/components/UserProfile/UserSettings';
import UserNotificationSettings from '@app/components/UserProfile/UserSettings/UserNotificationSettings';
import UserNotificationsSlack from '@app/components/UserProfile/UserSettings/UserNotificationSettings/UserNotificationsSlack';
import type { NextPage } from 'next';

const NotificationsPage: NextPage = () => {
  return (
    <UserSettings>
      <UserNotificationSettings>
        <UserNotificationsSlack />
      </UserNotificationSettings>
    </UserSettings>
  );
};

export default NotificationsPage;
