import UserSettings from '@app/components/UserProfile/UserSettings';
import UserNotificationSettings from '@app/components/UserProfile/UserSettings/UserNotificationSettings';
import UserNotificationsApprise from '@app/components/UserProfile/UserSettings/UserNotificationSettings/UserNotificationsApprise';
import type { NextPage } from 'next';

const NotificationsPage: NextPage = () => {
  return (
    <UserSettings>
      <UserNotificationSettings>
        <UserNotificationsApprise />
      </UserNotificationSettings>
    </UserSettings>
  );
};

export default NotificationsPage;
