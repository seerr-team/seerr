import QuickConnectModal from '@app/components/Common/QuickConnectModal';
import defineMessages from '@app/utils/defineMessages';
import axios from 'axios';
import { useCallback } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Login.JellyfinQuickConnectModal', {
  title: 'Quick Connect',
  subtitle: 'Sign in with Quick Connect',
  instructions: 'Enter this code in your {mediaServerName} app',
  cancel: 'Cancel',
});

interface JellyfinQuickConnectModalProps {
  onClose: () => void;
  onAuthenticated: () => void;
  onError: (error: string) => void;
  mediaServerName: string;
}

const JellyfinQuickConnectModal = ({
  onClose,
  onAuthenticated,
  onError,
  mediaServerName,
}: JellyfinQuickConnectModalProps) => {
  const intl = useIntl();

  const authenticate = useCallback(async (secret: string) => {
    await axios.post('/api/v1/auth/jellyfin/quickconnect/authenticate', {
      secret,
    });
  }, []);

  return (
    <QuickConnectModal
      show
      title={intl.formatMessage(messages.title)}
      subTitle={intl.formatMessage(messages.subtitle)}
      cancelText={intl.formatMessage(messages.cancel)}
      instructionsMessage={intl.formatMessage(messages.instructions, {
        mediaServerName,
      })}
      onCancel={onClose}
      onSuccess={() => {
        onAuthenticated();
        onClose();
      }}
      onError={onError}
      authenticate={authenticate}
    />
  );
};

export default JellyfinQuickConnectModal;
