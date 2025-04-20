import PageTitle from '@app/components/Common/PageTitle';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Settings', {
  notifications: 'Notifications',
  notificationSettings: 'Notification Settings',
  notificationSettingsDescription:
    'Configure and enable global notification agents.',
  email: 'Email',
  webhook: 'Webhook',
  webpush: 'Web Push',
});

const SettingsNotifications = () => {
  const intl = useIntl();

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.notifications),
          intl.formatMessage(globalMessages.settings),
        ]}
      />

      <div className="mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.notificationSettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.notificationSettingsDescription)}
        </p>
      </div>
    </>
  );
};

export default SettingsNotifications;
