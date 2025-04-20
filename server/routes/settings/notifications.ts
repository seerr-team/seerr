import type { User } from '@server/entity/User';
import { Notification } from '@server/lib/notifications';
import type { NotificationAgent } from '@server/lib/notifications/agents/agent';
import GotifyAgent from '@server/lib/notifications/agents/gotify';
import { getSettings } from '@server/lib/settings';
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

  res.status(200).json(settings.notifications.agents.gotify);
});

notificationRoutes.post('/', async (req, res) => {
  const settings = getSettings();

  settings.notifications.agents.gotify = req.body;
  await settings.save();

  res.status(200).json(settings.notifications.agents.gotify);
});

notificationRoutes.post('/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const gotifyAgent = new GotifyAgent(req.body);
  if (await sendTestNotification(gotifyAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: 'Failed to send Gotify notification.',
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
