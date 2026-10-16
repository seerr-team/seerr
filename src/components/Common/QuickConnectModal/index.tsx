import Alert from '@app/components/Common/Alert';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import { useQuickConnect } from '@app/hooks/useQuickConnect';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Common.QuickConnectModal', {
  waitingForAuth: 'Waiting for authorization...',
  expired: 'Code Expired',
  expiredMessage: 'This Quick Connect code has expired. Please try again.',
  error: 'Error',
  tryAgain: 'Try Again',
});

interface QuickConnectModalProps {
  show: boolean;
  title: string;
  subTitle: string;
  cancelText: string;
  instructionsMessage: string;
  dialogClass?: string;
  showInlineError?: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  onError?: (error: string) => void;
  authenticate: (secret: string) => Promise<void>;
}

const QuickConnectModal = ({
  show,
  title,
  subTitle,
  cancelText,
  instructionsMessage,
  dialogClass,
  showInlineError,
  onCancel,
  onSuccess,
  onError,
  authenticate,
}: QuickConnectModalProps) => {
  const intl = useIntl();

  const {
    code,
    isLoading,
    hasError,
    isExpired,
    errorMessage,
    initiateQuickConnect,
    cleanup,
  } = useQuickConnect({
    show,
    onSuccess,
    onError,
    authenticate,
  });

  const handleCancel = () => {
    cleanup();
    onCancel();
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
        onCancel={handleCancel}
        title={title}
        subTitle={subTitle}
        cancelText={cancelText}
        dialogClass={dialogClass}
        {...(hasError || isExpired
          ? {
              okText: intl.formatMessage(messages.tryAgain),
              onOk: initiateQuickConnect,
            }
          : {})}
      >
        {showInlineError && errorMessage && (
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
            <p className="text-center text-gray-300">{instructionsMessage}</p>

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

export default QuickConnectModal;
