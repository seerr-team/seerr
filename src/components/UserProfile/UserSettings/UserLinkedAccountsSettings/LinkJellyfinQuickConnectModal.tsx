import Alert from '@app/components/Common/Alert';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import { useQuickConnect } from '@app/hooks/useQuickConnect';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { MediaServerType } from '@server/constants/server';
import axios from 'axios';
import { useCallback } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages(
  'components.UserProfile.UserSettings.LinkJellyfinQuickConnectModal',
  {
    title: 'Link {mediaServerName} Account',
    subtitle: 'Quick Connect',
    instructions: 'Enter this code in your {mediaServerName} app',
    waitingForAuth: 'Waiting for authorization...',
    expired: 'Code Expired',
    expiredMessage: 'This Quick Connect code has expired. Please try again.',
    error: 'Error',
    usePassword: 'Use Password Instead',
    tryAgain: 'Try Again',
    errorExists: 'This account is already linked',
  }
);

interface LinkJellyfinQuickConnectModalProps {
  show: boolean;
  onClose: () => void;
  onSave: () => void;
  onSwitchToPassword: () => void;
}

const LinkJellyfinQuickConnectModal = ({
  show,
  onClose,
  onSave,
  onSwitchToPassword,
}: LinkJellyfinQuickConnectModalProps) => {
  const intl = useIntl();
  const settings = useSettings();
  const { user } = useUser();

  const mediaServerName =
    settings.currentSettings.mediaServerType === MediaServerType.JELLYFIN
      ? 'Jellyfin'
      : 'Emby';

  const authenticate = useCallback(
    async (secret: string) => {
      await axios.post(
        `/api/v1/user/${user?.id}/settings/linked-accounts/jellyfin/quickconnect`,
        { secret }
      );
      onSave();
      onClose();
    },
    [user, onSave, onClose]
  );

  const {
    code,
    isLoading,
    hasError,
    isExpired,
    errorMessage,
    initiateQuickConnect,
    cleanup,
  } = useQuickConnect({
    show: true,
    onSuccess: () => {
      onSave();
      onClose();
    },
    authenticate,
  });

  const handleSwitchToPassword = () => {
    cleanup();
    onClose();
    onSwitchToPassword();
  };

  return (
    <Transition
      as="div"
      appear
      show={show}
      enter="transition-opacity ease-in-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity ease-in-out duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Modal
        onCancel={handleSwitchToPassword}
        title={intl.formatMessage(messages.title, { mediaServerName })}
        subTitle={intl.formatMessage(messages.subtitle)}
        cancelText={intl.formatMessage(messages.usePassword)}
        {...(hasError || isExpired
          ? {
              okText: intl.formatMessage(messages.tryAgain),
              onOk: initiateQuickConnect,
            }
          : {})}
        dialogClass="sm:max-w-lg"
      >
        {errorMessage && (
          <div className="mb-4">
            <Alert type="error">{errorMessage}</Alert>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        )}

        {!isLoading && !hasError && !isExpired && (
          <div className="flex flex-col items-center space-y-4">
            <p className="text-center text-gray-300">
              {intl.formatMessage(messages.instructions, { mediaServerName })}
            </p>

            <div className="flex flex-col items-center space-y-2">
              <div className="rounded-lg bg-gray-700 px-8 py-4">
                <span className="text-4xl font-bold tracking-wider text-white">
                  {code}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <div className="h-4 w-4">
                <LoadingSpinner />
              </div>
              <span>{intl.formatMessage(messages.waitingForAuth)}</span>
            </div>
          </div>
        )}

        {hasError && (
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-500">
                {intl.formatMessage(messages.error)}
              </h3>
              <p className="mt-2 text-gray-300">{errorMessage}</p>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-yellow-500">
                {intl.formatMessage(messages.expired)}
              </h3>
              <p className="mt-2 text-gray-300">
                {intl.formatMessage(messages.expiredMessage)}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </Transition>
  );
};

export default LinkJellyfinQuickConnectModal;
