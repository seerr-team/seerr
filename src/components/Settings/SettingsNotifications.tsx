import PageTitle from '@app/components/Common/PageTitle';
import Table from '@app/components/Common/Table';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Settings', {
  notifications: 'Notifications',
  notificationSettings: 'Notification Settings',
  notificationSettingsDescription:
    'Configure and enable global notification agents.',
  instanceName: 'Name',
  instanceId: 'ID',
  notificationAgent: 'Agent',
  email: 'Email',
  webhook: 'Webhook',
  webpush: 'Web Push',
});

const SettingsNotifications = () => {
  const intl = useIntl();

  /*const {
    data,
    error,
    mutate: revalidate,
  } = useSWR(
    `/api/v1/settings/notifications?take=${currentPageSize}&skip=${
      pageIndex * currentPageSize
    }&sort=${currentSort}`
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }*/

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

      <Table>
        <thead>
          <tr>
            <Table.TH>
              <input type="checkbox" id="selectAll" name="selectAll" />
            </Table.TH>
            <Table.TH>{intl.formatMessage(messages.instanceName)}</Table.TH>
            <Table.TH>{intl.formatMessage(messages.instanceId)}</Table.TH>
            <Table.TH>
              {intl.formatMessage(messages.notificationAgent)}
            </Table.TH>
          </tr>
        </thead>

        <Table.TBody>
          {
            <tr>
              <Table.TD></Table.TD>
              <Table.TD></Table.TD>
              <Table.TD></Table.TD>
              <Table.TD></Table.TD>
            </tr>
          }
        </Table.TBody>
      </Table>
    </>
  );
};

export default SettingsNotifications;
