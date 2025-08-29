import DiscordLogo from '@app/assets/extlogos/discord.svg';
import GotifyLogo from '@app/assets/extlogos/gotify.svg';
import NtfyLogo from '@app/assets/extlogos/ntfy.svg';
import PushbulletLogo from '@app/assets/extlogos/pushbullet.svg';
import PushoverLogo from '@app/assets/extlogos/pushover.svg';
import SlackLogo from '@app/assets/extlogos/slack.svg';
import TelegramLogo from '@app/assets/extlogos/telegram.svg';
import Dropdown from '@app/components/Common/Dropdown';
import defineMessages from '@app/utils/defineMessages';
import {
  BoltIcon,
  CloudIcon,
  EnvelopeIcon,
  PlusIcon,
} from '@heroicons/react/24/solid';
import { NotificationAgentKey } from '@server/interfaces/settings';
import { useIntl } from 'react-intl';

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationInstanceDropdown',
  {
    createNotificationInstance: 'Create Notification Instance',
  }
);

interface NotificationInstanceDropdownProps {
  onSelect: (agentKey: NotificationAgentKey) => void;
}

function NotificationInstanceDropdown({
  onSelect,
}: NotificationInstanceDropdownProps) {
  const intl = useIntl();

  return (
    <div className="mb-2 flex-grow justify-between sm:mr-2 sm:flex-row lg:mb-0 lg:flex-grow-0">
      <Dropdown
        className="mb-2 flex-grow sm:mb-0"
        buttonType="ghost"
        text={
          <>
            <PlusIcon />
            {intl.formatMessage(messages.createNotificationInstance)}
          </>
        }
      >
        <Dropdown.Item onClick={() => onSelect(NotificationAgentKey.DISCORD)}>
          <DiscordLogo />
          <span>Discord</span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => onSelect(NotificationAgentKey.EMAIL)}>
          <EnvelopeIcon />
          <span>Email</span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => onSelect(NotificationAgentKey.GOTIFY)}>
          <GotifyLogo />
          <span>Gotify</span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => onSelect(NotificationAgentKey.NTFY)}>
          <NtfyLogo />
          <span>Ntfy</span>
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() => onSelect(NotificationAgentKey.PUSHBULLET)}
        >
          <PushbulletLogo />
          <span>Pushbullet</span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => onSelect(NotificationAgentKey.PUSHOVER)}>
          <PushoverLogo />
          <span>Pushover</span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => onSelect(NotificationAgentKey.SLACK)}>
          <SlackLogo />
          <span>Slack</span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => onSelect(NotificationAgentKey.TELEGRAM)}>
          <TelegramLogo />
          <span>Telegram</span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => onSelect(NotificationAgentKey.WEBHOOK)}>
          <BoltIcon />
          <span>Webhook</span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => onSelect(NotificationAgentKey.WEBPUSH)}>
          <CloudIcon />
          <span>WebPush</span>
        </Dropdown.Item>
      </Dropdown>
    </div>
  );
}

export default NotificationInstanceDropdown;
