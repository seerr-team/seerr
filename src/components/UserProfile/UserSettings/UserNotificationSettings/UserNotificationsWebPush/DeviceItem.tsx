import ConfirmButton from '@app/components/Common/ConfirmButton';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import { useIntl } from 'react-intl';
import { UAParser } from 'ua-parser-js';

interface DeviceItemProps {
  disablePushNotifications: (p256dh: string) => void;
  device: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent: string;
    createdAt: Date;
  };
}

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserNotificationSettings.UserNotificationsWebPush',
  {
    operatingsystem: 'Operating System',
    browser: 'Browser',
    engine: 'Engine',
    deletesubscription: 'Delete Subscription',
    unknown: 'Unknown',
  }
);

const DeviceItem = ({ disablePushNotifications, device }: DeviceItemProps) => {
  const intl = useIntl();
  const parsedUserAgent = UAParser(device.userAgent);

  return (
    <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gray-800 py-4 text-gray-400 shadow-md ring-1 ring-gray-700 xl:h-28 xl:flex-row">
      <div className="relative flex w-full flex-col justify-between overflow-hidden sm:flex-row">
        <div className="relative z-10 flex w-full items-center overflow-hidden pl-4 pr-4 sm:pr-0 xl:w-7/12 2xl:w-2/3">
          <div className="relative h-auto w-12 flex-shrink-0 scale-100 transform-gpu overflow-hidden rounded-md transition duration-300 hover:scale-105">
            {parsedUserAgent.device.type === 'mobile' ? (
              <DevicePhoneMobileIcon />
            ) : (
              <ComputerDesktopIcon />
            )}
          </div>
          <div className="flex flex-col justify-center overflow-hidden pl-2 xl:pl-4">
            <div className="pt-0.5 text-xs font-medium text-white sm:pt-1">
              {device.createdAt
                ? intl.formatDate(device.createdAt, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'N/A'}
            </div>
            <div className="mr-2 min-w-0 truncate text-lg font-bold text-white hover:underline xl:text-xl">
              {device.userAgent && parsedUserAgent.device.model
                ? parsedUserAgent.device.model
                : intl.formatMessage(messages.unknown)}
            </div>
          </div>
        </div>
        <div className="z-10 mt-4 ml-4 flex w-full flex-col justify-center overflow-hidden pr-4 text-sm sm:ml-2 sm:mt-0 xl:flex-1 xl:pr-0">
          <div className="card-field">
            <span className="card-field-name">
              {intl.formatMessage(messages.operatingsystem)}
            </span>
            <span className="flex truncate text-sm text-gray-300">
              {device.userAgent ? parsedUserAgent.os.name : 'N/A'}
            </span>
          </div>
          <div className="card-field">
            <span className="card-field-name">
              {intl.formatMessage(messages.browser)}
            </span>
            <span className="flex truncate text-sm text-gray-300">
              {device.userAgent ? parsedUserAgent.browser.name : 'N/A'}
            </span>
          </div>
          <div className="card-field">
            <span className="card-field-name">
              {intl.formatMessage(messages.engine)}
            </span>
            <span className="flex truncate text-sm text-gray-300">
              {device.userAgent ? parsedUserAgent.engine.name : 'N/A'}
            </span>
          </div>
        </div>
      </div>
      <div className="z-10 mt-4 flex w-full flex-col justify-center space-y-2 pl-4 pr-4 xl:mt-0 xl:w-96 xl:items-end xl:pl-0">
        <ConfirmButton
          onClick={() => disablePushNotifications(device.endpoint)}
          confirmText={intl.formatMessage(globalMessages.areyousure)}
          className="w-full"
        >
          <TrashIcon />
          <span>{intl.formatMessage(messages.deletesubscription)}</span>
        </ConfirmButton>
      </div>
    </div>
  );
};

export default DeviceItem;
