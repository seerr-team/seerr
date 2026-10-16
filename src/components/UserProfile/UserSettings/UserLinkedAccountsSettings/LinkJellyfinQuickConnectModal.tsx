import QuickConnectModal from '@app/components/Common/QuickConnectModal';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
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
    usePassword: 'Use Password Instead',
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
    },
    [user]
  );

  const handleCancel = () => {
    onClose();
    onSwitchToPassword();
  };

  return (
    <QuickConnectModal
      show={show}
      title={intl.formatMessage(messages.title, { mediaServerName })}
      subTitle={intl.formatMessage(messages.subtitle)}
      cancelText={intl.formatMessage(messages.usePassword)}
      instructionsMessage={intl.formatMessage(messages.instructions, {
        mediaServerName,
      })}
      dialogClass="sm:max-w-lg"
      showInlineError
      onCancel={handleCancel}
      onSuccess={() => {
        onSave();
        onClose();
      }}
      authenticate={authenticate}
    />
  );
};

export default LinkJellyfinQuickConnectModal;
