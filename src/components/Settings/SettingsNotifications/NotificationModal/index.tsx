import DiscordModal from '@app/components/Settings/SettingsNotifications/NotificationModal/DiscordModal';
import EmailModal from '@app/components/Settings/SettingsNotifications/NotificationModal/EmailModal';
import GotifyModal from '@app/components/Settings/SettingsNotifications/NotificationModal/GotifyModal';
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
    createInstance: 'Create Instance',
    toastTestSending: 'Sending test notification…',
    toastTestSuccess: 'Test notification sent!',
    toastTestFailed: 'Test notification failed to send.',
    toastSaveSuccess: 'Notification instance saved successfully!',
    toastSaveFail: 'Notification instance failed to save.',
    toastCreateSuccess: 'Notification instance created successfully!',
    toastCreateFail: 'Notification instance failed to create.',
  }
);

export enum NotificationModalType {
  EDIT = 'edit',
  CREATE = 'create',
}

interface NotificationModalProps {
  type: NotificationModalType;
  data?: NotificationAgentConfig;
  afterSave: () => void;
  onClose: () => void;
}

const NotificationModal = ({
  type,
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

  const onCreate = async (submitData: NotificationAgentConfig) => {
    try {
      await axios.post(`/api/v1/settings/notification`, submitData);

      addToast(intl.formatMessage(messages.toastCreateSuccess), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (e) {
      addToast(intl.formatMessage(messages.toastCreateFail), {
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

  switch (data?.agent) {
    case NotificationAgentKey.DISCORD:
      return (
        <DiscordModal
          type={type}
          data={data as NotificationAgentDiscord}
          onClose={onClose}
          onTest={onTest}
          onSave={type === NotificationModalType.EDIT ? onSave : onCreate}
        />
      );
    case NotificationAgentKey.EMAIL:
      return (
        <EmailModal
          type={type}
          data={data as NotificationAgentEmail}
          onClose={onClose}
          onTest={onTest}
          onSave={type === NotificationModalType.EDIT ? onSave : onCreate}
        />
      );
    case NotificationAgentKey.GOTIFY:
      return (
        <GotifyModal
          type={type}
          data={data as NotificationAgentGotify}
          onClose={onClose}
          onTest={onTest}
          onSave={type === NotificationModalType.EDIT ? onSave : onCreate}
        />
      );
    case NotificationAgentKey.NTFY:
      return (
        <NtfyModal
          type={type}
          data={data as NotificationAgentNtfy}
          onClose={onClose}
          onTest={onTest}
          onSave={type === NotificationModalType.EDIT ? onSave : onCreate}
        />
      );
    case NotificationAgentKey.PUSHBULLET:
      return (
        <PushbulletModal
          type={type}
          data={data as NotificationAgentPushbullet}
          onClose={onClose}
          onTest={onTest}
          onSave={type === NotificationModalType.EDIT ? onSave : onCreate}
        />
      );
    case NotificationAgentKey.PUSHOVER:
      return (
        <PushoverModal
          type={type}
          data={data as NotificationAgentPushover}
          onClose={onClose}
          onTest={onTest}
          onSave={type === NotificationModalType.EDIT ? onSave : onCreate}
        />
      );
    case NotificationAgentKey.SLACK:
      return (
        <SlackModal
          type={type}
          data={data as NotificationAgentSlack}
          onClose={onClose}
          onTest={onTest}
          onSave={type === NotificationModalType.EDIT ? onSave : onCreate}
        />
      );
    case NotificationAgentKey.TELEGRAM:
      return (
        <TelegramModal
          type={type}
          data={data as NotificationAgentTelegram}
          onClose={onClose}
          onTest={onTest}
          onSave={type === NotificationModalType.EDIT ? onSave : onCreate}
        />
      );
    case NotificationAgentKey.WEBHOOK:
      return (
        <WebhookModal
          type={type}
          data={data as NotificationAgentWebhook}
          onClose={onClose}
          onTest={onTest}
          onSave={type === NotificationModalType.EDIT ? onSave : onCreate}
        />
      );
    case NotificationAgentKey.WEBPUSH:
      return (
        <WebPushModal
          type={type}
          data={data as NotificationAgentConfig}
          onClose={onClose}
          onTest={onTest}
          onSave={type === NotificationModalType.EDIT ? onSave : onCreate}
        />
      );
  }

  return <></>;
};

export default NotificationModal;
