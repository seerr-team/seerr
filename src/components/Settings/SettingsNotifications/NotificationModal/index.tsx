import DiscordModal from '@app/components/Settings/SettingsNotifications/NotificationModal/DiscordModal';
import EmailModal from '@app/components/Settings/SettingsNotifications/NotificationModal/EmailModal';
import GotifyModal from '@app/components/Settings/SettingsNotifications/NotificationModal/GotifyModal';
import LunaSeaModal from '@app/components/Settings/SettingsNotifications/NotificationModal/LunaSeaModal';
import NtfyModal from '@app/components/Settings/SettingsNotifications/NotificationModal/NtfyModal';
import PushbulletModal from '@app/components/Settings/SettingsNotifications/NotificationModal/PushbulletModal';
import PushoverModal from '@app/components/Settings/SettingsNotifications/NotificationModal/PushoverModal';
import SlackModal from '@app/components/Settings/SettingsNotifications/NotificationModal/SlackModal';
import TelegramModal from '@app/components/Settings/SettingsNotifications/NotificationModal/TelegramModal';
import WebhookModal from '@app/components/Settings/SettingsNotifications/NotificationModal/WebhookModal';
import WebPushModal from '@app/components/Settings/SettingsNotifications/NotificationModal/WebPushModal';
import defineMessages from '@app/utils/defineMessages';
import type {
  NotificationAgentConfig,
  NotificationAgentDiscord,
  NotificationAgentEmail,
  NotificationAgentGotify,
  NotificationAgentLunaSea,
  NotificationAgentNtfy,
  NotificationAgentPushbullet,
  NotificationAgentPushover,
  NotificationAgentSlack,
  NotificationAgentTelegram,
  NotificationAgentWebhook,
} from '@server/interfaces/settings';
import { NotificationAgentKey } from '@server/interfaces/settings';
import axios from 'axios';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationModal',
  {
    editTitle: 'Edit Notification Instance',
    createTitle: 'Create Notification Instance',
    toastTestSending: 'Sending test notification…',
    toastTestSuccess: 'Test notification sent!',
    toastTestFailed: 'Test notification failed to send.',
    toastSaveSuccess: 'Notification settings saved successfully!',
    toastSaveFail: 'Notification settings failed to save.',
  }
);

interface NotificationModalProps {
  data: NotificationAgentConfig | null;
  afterSave: () => void;
  onClose: () => void;
}

const NotificationModal = ({
  data,
  afterSave,
  onClose,
}: NotificationModalProps) => {
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();

  const onSave = async (submitData: NotificationAgentConfig) => {
    try {
      await axios.post(
        `/api/v1/settings/notification/${submitData.id}`,
        submitData
      );

      addToast(intl.formatMessage(messages.toastSaveSuccess), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (e) {
      addToast(intl.formatMessage(messages.toastSaveFail), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      afterSave();
    }
  };

  const onTest = async (testData: NotificationAgentConfig) => {
    let toastId: string | undefined;
    try {
      addToast(
        intl.formatMessage(messages.toastTestSending),
        {
          autoDismiss: false,
          appearance: 'info',
        },
        (id) => {
          toastId = id;
        }
      );
      await axios.post('/api/v1/settings/notification/test', testData);

      if (toastId) {
        removeToast(toastId);
      }
      addToast(intl.formatMessage(messages.toastTestSuccess), {
        autoDismiss: true,
        appearance: 'success',
      });
    } catch (e) {
      if (toastId) {
        removeToast(toastId);
      }
      addToast(intl.formatMessage(messages.toastTestFailed), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  const editTitle = `${intl.formatMessage(messages.editTitle)} #${data?.id}`;

  switch (data?.agent) {
    case NotificationAgentKey.DISCORD:
      return (
        <DiscordModal
          title={editTitle}
          data={data as NotificationAgentDiscord}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
    case NotificationAgentKey.EMAIL:
      return (
        <EmailModal
          title={editTitle}
          data={data as NotificationAgentEmail}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
    case NotificationAgentKey.GOTIFY:
      return (
        <GotifyModal
          title={editTitle}
          data={data as NotificationAgentGotify}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
    case NotificationAgentKey.NTFY:
      return (
        <NtfyModal
          title={editTitle}
          data={data as NotificationAgentNtfy}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
    case NotificationAgentKey.LUNASEA:
      return (
        <LunaSeaModal
          title={editTitle}
          data={data as NotificationAgentLunaSea}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
    case NotificationAgentKey.PUSHBULLET:
      return (
        <PushbulletModal
          title={editTitle}
          data={data as NotificationAgentPushbullet}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
    case NotificationAgentKey.PUSHOVER:
      return (
        <PushoverModal
          title={editTitle}
          data={data as NotificationAgentPushover}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
    case NotificationAgentKey.SLACK:
      return (
        <SlackModal
          title={editTitle}
          data={data as NotificationAgentSlack}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
    case NotificationAgentKey.TELEGRAM:
      return (
        <TelegramModal
          title={editTitle}
          data={data as NotificationAgentTelegram}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
    case NotificationAgentKey.WEBHOOK:
      return (
        <WebhookModal
          title={editTitle}
          data={data as NotificationAgentWebhook}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
    case NotificationAgentKey.WEBPUSH:
      return (
        <WebPushModal
          title={editTitle}
          data={data as NotificationAgentConfig}
          onClose={onClose}
          onTest={onTest}
          onSave={onSave}
        />
      );
  }

  return <></>;
};

export default NotificationModal;
