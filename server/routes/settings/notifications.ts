import type { User } from '@server/entity/User';
import { Notification } from '@server/lib/notifications';
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

notificationRoutes.post<{ id: string }>('/:id', async (req, res) => {
  const settings = getSettings();

  let notificationInstanceIndex = settings.notifications.instances.findIndex(
    (instance) => instance.id === Number(req.params.id)
  );

  if (notificationInstanceIndex === -1) {
    notificationInstanceIndex = settings.notifications.instances.length;
  }

  const request = req.body;
  request.id = notificationInstanceIndex;
  settings.notifications.instances[notificationInstanceIndex] = req.body;

  await settings.save();

  res
    .status(200)
    .json(settings.notifications.instances[notificationInstanceIndex]);
});

notificationRoutes.post<{ id: string }>('/:id/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  let notificationAgent: NotificationAgent;
  const instanceType = req.body.agent as NotificationAgentKey;
  switch (instanceType) {
    case NotificationAgentKey.DISCORD:
      notificationAgent = new DiscordAgent(req.body);
      break;
    case NotificationAgentKey.EMAIL:
      notificationAgent = new EmailAgent(req.body);
      break;
    case NotificationAgentKey.GOTIFY:
      notificationAgent = new GotifyAgent(req.body);
      break;
    case NotificationAgentKey.LUNASEA:
      notificationAgent = new LunaSeaAgent(req.body);
      break;
    case NotificationAgentKey.PUSHBULLET:
      notificationAgent = new PushbulletAgent(req.body);
      break;
    case NotificationAgentKey.PUSHOVER:
      notificationAgent = new PushoverAgent(req.body);
      break;
    case NotificationAgentKey.SLACK:
      notificationAgent = new SlackAgent(req.body);
      break;
    case NotificationAgentKey.TELEGRAM:
      notificationAgent = new TelegramAgent(req.body);
      break;
    case NotificationAgentKey.WEBHOOK:
      notificationAgent = new WebhookAgent(req.body);
      break;
    case NotificationAgentKey.WEBPUSH:
      notificationAgent = new WebPushAgent(req.body);
      break;

    default:
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
      message: `Failed to send ${instanceType} notification.`,
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
