import type { User } from '@server/entity/User';
import notificationManager, { Notification } from '@server/lib/notifications';
import type { NotificationAgent } from '@server/lib/notifications/agents/agent';
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
import { Router } from 'express';

const notificationRoutes = Router();

const sendTestNotification = async (agent: NotificationAgent, user: User) =>
  await agent.send(Notification.TEST_NOTIFICATION, {
    notifySystem: true,
    notifyAdmin: false,
    notifyUser: user,
    subject: 'Test Notification',
    message: 'Check check, 1, 2, 3. Are we coming in clear?',
  });

const createNotificationAgent = (
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

notificationRoutes.get('/', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.notifications.instances);
});

notificationRoutes.get<{ id: string }>('/:id', (req, res, next) => {
  const settings = getSettings();

  const notificationInstance = settings.notifications.instances.find(
    (instance) => instance.id === Number(req.params.id)
  );

  if (!notificationInstance) {
    return next({ status: '404', message: 'Notifications instance not found' });
  }

  res.status(200).json(notificationInstance);
});

notificationRoutes.post<{ id: string }>('/:id', async (req, res, next) => {
  const settings = getSettings();

  const notificationInstanceId = Number(req.params.id);
  let notificationInstanceIndex = settings.notifications.instances.findIndex(
    (instance) => instance.id === notificationInstanceId
  );

  if (notificationInstanceIndex === -1) {
    notificationInstanceIndex = settings.notifications.instances.length;

    const notificationAgent = createNotificationAgent(
      req.body,
      notificationInstanceIndex
    );

    if (!notificationAgent) {
      return next({
        status: 500,
        message: 'A valid instance type is missing from the request.',
      });
    }

    notificationManager.registerAgent(notificationAgent);
  }

  const request = req.body;
  request.id = notificationInstanceIndex;
  settings.notifications.instances[notificationInstanceIndex] = req.body;

  await settings.save();

  res
    .status(200)
    .json(settings.notifications.instances[notificationInstanceIndex]);
});

notificationRoutes.delete<{ id: string }>('/:id', async (req, res, next) => {
  const settings = getSettings();

  const notificationInstanceIndex = settings.notifications.instances.findIndex(
    (instance) => instance.id === Number(req.params.id)
  );

  if (notificationInstanceIndex === -1) {
    return next({ status: '404', message: 'Notifications instance not found' });
  }

  settings.notifications.instances.splice(notificationInstanceIndex, 1);
  notificationManager.unregisterAgent(Number(req.params.id));

  await settings.save();

  res.status(200).send();
});

notificationRoutes.post<{ id: string }>('/:id/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const notificationAgent = createNotificationAgent(req.body);
  if (!notificationAgent) {
    return next({
      status: 500,
      message: 'A valid instance type is missing from the request.',
    });
  }

  if (await sendTestNotification(notificationAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: `Failed to send ${req.body.agent} notification.`,
    });
  }
});

notificationRoutes.get('/ntfy', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.notifications.agents.ntfy);
});

notificationRoutes.post('/ntfy', async (req, res) => {
  const settings = getSettings();

  settings.notifications.agents.ntfy = req.body;
  await settings.save();

  res.status(200).json(settings.notifications.agents.ntfy);
});

notificationRoutes.post('/ntfy/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const ntfyAgent = new NtfyAgent(req.body);
  if (await sendTestNotification(ntfyAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: 'Failed to send ntfy notification.',
    });
  }
});

export default notificationRoutes;
