import type { User } from '@server/entity/User';
import DiscordAgent from '@server/lib/notifications/agents/discord';
import EmailAgent from '@server/lib/notifications/agents/email';
import GotifyAgent from '@server/lib/notifications/agents/gotify';
import LunaSeaAgent from '@server/lib/notifications/agents/lunasea';
import PushbulletAgent from '@server/lib/notifications/agents/pushbullet';
import PushoverAgent from '@server/lib/notifications/agents/pushover';
import SlackAgent from '@server/lib/notifications/agents/slack';
import TelegramAgent from '@server/lib/notifications/agents/telegram';
import WebhookAgent from '@server/lib/notifications/agents/webhook';
import WebPushAgent from '@server/lib/notifications/agents/webpush';
import { Permission } from '@server/lib/permissions';
import type {
  NotificationAgentConfig,
  NotificationAgentDiscord,
  NotificationAgentEmail,
  NotificationAgentGotify,
  NotificationAgentLunaSea,
  NotificationAgentPushbullet,
  NotificationAgentPushover,
  NotificationAgentSlack,
  NotificationAgentTelegram,
  NotificationAgentWebhook,
} from '@server/lib/settings';
import { getSettings, NotificationAgentKey } from '@server/lib/settings';
import logger from '@server/logger';
import type { NotificationAgent, NotificationPayload } from './agents/agent';

export enum Notification {
  NONE = 0,
  MEDIA_PENDING = 2,
  MEDIA_APPROVED = 4,
  MEDIA_AVAILABLE = 8,
  MEDIA_FAILED = 16,
  TEST_NOTIFICATION = 32,
  MEDIA_DECLINED = 64,
  MEDIA_AUTO_APPROVED = 128,
  ISSUE_CREATED = 256,
  ISSUE_COMMENT = 512,
  ISSUE_RESOLVED = 1024,
  ISSUE_REOPENED = 2048,
  MEDIA_AUTO_REQUESTED = 4096,
}

export const hasNotificationType = (
  types: Notification | Notification[],
  value: number
): boolean => {
  let total = 0;

  // If we are not checking any notifications, bail out and return true
  if (types === 0) {
    return true;
  }

  if (Array.isArray(types)) {
    // Combine all notification values into one
    total = types.reduce((a, v) => a + v, 0);
  } else {
    total = types;
  }

  // Test notifications don't need to be enabled
  if (!(value & Notification.TEST_NOTIFICATION)) {
    value += Notification.TEST_NOTIFICATION;
  }

  return !!(value & total);
};

export const getAdminPermission = (type: Notification): Permission => {
  switch (type) {
    case Notification.MEDIA_PENDING:
    case Notification.MEDIA_APPROVED:
    case Notification.MEDIA_AVAILABLE:
    case Notification.MEDIA_FAILED:
    case Notification.MEDIA_DECLINED:
    case Notification.MEDIA_AUTO_APPROVED:
      return Permission.MANAGE_REQUESTS;
    case Notification.ISSUE_CREATED:
    case Notification.ISSUE_COMMENT:
    case Notification.ISSUE_RESOLVED:
    case Notification.ISSUE_REOPENED:
      return Permission.MANAGE_ISSUES;
    default:
      return Permission.ADMIN;
  }
};

export const shouldSendAdminNotification = (
  type: Notification,
  user: User,
  payload: NotificationPayload
): boolean => {
  return (
    user.id !== payload.notifyUser?.id &&
    user.hasPermission(getAdminPermission(type)) &&
    // Check if the user submitted this request (on behalf of themself OR another user)
    (type !== Notification.MEDIA_AUTO_APPROVED ||
      user.id !==
        (payload.request?.modifiedBy ?? payload.request?.requestedBy)?.id) &&
    // Check if the user created this issue
    (type !== Notification.ISSUE_CREATED ||
      user.id !== payload.issue?.createdBy.id) &&
    // Check if the user submitted this issue comment
    (type !== Notification.ISSUE_COMMENT ||
      user.id !== payload.comment?.user.id) &&
    // Check if the user resolved/reopened this issue
    ((type !== Notification.ISSUE_RESOLVED &&
      type !== Notification.ISSUE_REOPENED) ||
      user.id !== payload.issue?.modifiedBy?.id)
  );
};

export const createAccordingNotificationAgent = (
  body: NotificationAgentConfig,
  id?: number
) => {
  let notificationAgent: NotificationAgent;

  const instanceAgentType = body.agent;
  switch (instanceAgentType) {
    case NotificationAgentKey.DISCORD:
      notificationAgent = new DiscordAgent(
        body as NotificationAgentDiscord,
        id
      );
      break;
    case NotificationAgentKey.EMAIL:
      notificationAgent = new EmailAgent(body as NotificationAgentEmail, id);
      break;
    case NotificationAgentKey.GOTIFY:
      notificationAgent = new GotifyAgent(body as NotificationAgentGotify, id);
      break;
    case NotificationAgentKey.LUNASEA:
      notificationAgent = new LunaSeaAgent(
        body as NotificationAgentLunaSea,
        id
      );
      break;
    case NotificationAgentKey.PUSHBULLET:
      notificationAgent = new PushbulletAgent(
        body as NotificationAgentPushbullet,
        id
      );
      break;
    case NotificationAgentKey.PUSHOVER:
      notificationAgent = new PushoverAgent(
        body as NotificationAgentPushover,
        id
      );
      break;
    case NotificationAgentKey.SLACK:
      notificationAgent = new SlackAgent(body as NotificationAgentSlack, id);
      break;
    case NotificationAgentKey.TELEGRAM:
      notificationAgent = new TelegramAgent(
        body as NotificationAgentTelegram,
        id
      );
      break;
    case NotificationAgentKey.WEBHOOK:
      notificationAgent = new WebhookAgent(
        body as NotificationAgentWebhook,
        id
      );
      break;
    case NotificationAgentKey.WEBPUSH:
      notificationAgent = new WebPushAgent(body, id);
      break;
    default:
      return;
  }

  return notificationAgent;
};

export const retrieveDefaultNotificationInstanceSettings = (
  agentKey: NotificationAgentKey
) => {
  const settings = getSettings();

  const defaults = settings.notification.instances.filter((instance) =>
    instance.default && instance.agent ? instance.agent === agentKey : true
  );

  // return agent template if no default is configured
  if (!defaults[0]) {
    return settings.notification.agentTemplates[agentKey];
  }

  return defaults[0];
};

class NotificationManager {
  private activeAgents: NotificationAgent[] = [];

  public registerAgent = (agent: NotificationAgent) => {
    this.activeAgents.push(agent);
    logger.info(`Registered notification agent instance ${agent.id}`, {
      label: 'Notifications',
    });
  };

  public unregisterAgent = (instanceId: number) => {
    const instanceIndex = this.activeAgents.findIndex(
      (instance) => instance.id === instanceId
    );

    this.activeAgents.splice(instanceIndex, 1);
    logger.info(
      `Unregistered notification agent instance with id ${instanceId}`,
      { label: 'Notifications' }
    );
  };

  public reregisterAgent = (agent: NotificationAgent, instanceId: number) => {
    const instanceIndex = this.activeAgents.findIndex(
      (instance) => instance.id === instanceId
    );

    this.activeAgents[instanceIndex] = agent;

    logger.info(
      `Reregistered notification agent instance with id ${instanceId}`,
      { label: 'Notifications' }
    );
  };

  public registerAllAgents = () => {
    const agentInstances = getSettings().notification.instances;

    agentInstances.forEach((instance) => {
      const notificationAgent = createAccordingNotificationAgent(
        instance,
        instance.id
      );

      if (notificationAgent) {
        notificationManager.registerAgent(notificationAgent);
      }
    });
  };

  public sendNotification(type: Notification, payload: NotificationPayload) {
    logger.info(`Sending notification(s) for ${Notification[type]}`, {
      label: 'Notifications',
      subject: payload.subject,
    });

    this.activeAgents.forEach((agent) => {
      if (agent.shouldSend()) {
        agent.send(type, payload);
      }
    });
  }
}

const notificationManager = new NotificationManager();

export default notificationManager;
