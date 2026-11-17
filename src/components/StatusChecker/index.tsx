import Modal from '@app/components/Common/Modal';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import type { StatusResponse } from '@server/interfaces/api/settingsInterfaces';
import { Fragment, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.StatusChecker', {
  appUpdated: '{applicationTitle} Updated',
  appUpdatedDescription:
    'Please click the button below to reload the application.',
  reloadApp: 'Reload {applicationTitle}',
  restartRequired: 'Server Restart Required',
  restartRequiredDescription:
    'Please restart the server to apply the updated settings.',
});

const StatusChecker = () => {
  const intl = useIntl();
  const settings = useSettings();
  const { hasPermission } = useUser();
  const { data, error } = useSWR<StatusResponse>(
    '/api/v1/status?checkUpdateAvailable=false',
    {
      refreshInterval: 60 * 1000,
    }
  );
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    if (!data?.restartRequired) {
      setAlertDismissed(false);
    }
  }, [data?.restartRequired]);

  if (!data && !error) {
    return null;
  }

  if (!data) {
    return null;
  }

  return (
    <Transition
      as={Fragment}
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      appear
      show={
        !alertDismissed &&
        ((hasPermission(Permission.ADMIN) && data.restartRequired) ||
          data.commitTag !== process.env.commitTag)
      }
    >
      {hasPermission(Permission.ADMIN) && data.restartRequired ? (
        <Modal
          title={intl.formatMessage(messages.restartRequired)}
          backgroundClickable={false}
          onOk={() => {
            setAlertDismissed(true);
            if (data.commitTag !== process.env.commitTag) {
              location.reload();
            }
          }}
          okText={intl.formatMessage(globalMessages.close)}
        >
          {intl.formatMessage(messages.restartRequiredDescription)}
        </Modal>
      ) : (
        <Modal
          title={intl.formatMessage(messages.appUpdated, {
            applicationTitle: settings.currentSettings.applicationTitle,
          })}
          onOk={() => location.reload()}
          okText={intl.formatMessage(messages.reloadApp, {
            applicationTitle: settings.currentSettings.applicationTitle,
          })}
          backgroundClickable={false}
        >
          {intl.formatMessage(messages.appUpdatedDescription)}
        </Modal>
      )}
    </Transition>
  );
};

export default StatusChecker;
