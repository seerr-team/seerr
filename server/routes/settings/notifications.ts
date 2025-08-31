import type { User } from '@server/entity/User';
import { Notification } from '@server/lib/notifications';
import type { NotificationAgent } from '@server/lib/notifications/agents/agent';
import DiscordAgent from '@server/lib/notifications/agents/discord';
import EmailAgent from '@server/lib/notifications/agents/email';
import GotifyAgent from '@server/lib/notifications/agents/gotify';
import NtfyAgent from '@server/lib/notifications/agents/ntfy';
import PushbulletAgent from '@server/lib/notifications/agents/pushbullet';
import PushoverAgent from '@server/lib/notifications/agents/pushover';
import SlackAgent from '@server/lib/notifications/agents/slack';
import TelegramAgent from '@server/lib/notifications/agents/telegram';
import WebhookAgent from '@server/lib/notifications/agents/webhook';
import WebPushAgent from '@server/lib/notifications/agents/webpush';
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

notificationRoutes.get('/discord', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.notifications.agents.discord);
});

notificationRoutes.post('/discord', async (req, res) => {
  const settings = getSettings();

  settings.notifications.agents.discord = req.body;
  await settings.save();

  res.status(200).json(settings.notifications.agents.discord);
});

notificationRoutes.post('/discord/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const discordAgent = new DiscordAgent(req.body);
  if (await sendTestNotification(discordAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: 'Failed to send Discord notification.',
    });
  }
});

notificationRoutes.get('/slack', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.notifications.agents.slack);
});

notificationRoutes.post('/slack', async (req, res) => {
  const settings = getSettings();

  settings.notifications.agents.slack = req.body;
  await settings.save();

  res.status(200).json(settings.notifications.agents.slack);
});

notificationRoutes.post('/slack/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const slackAgent = new SlackAgent(req.body);
  if (await sendTestNotification(slackAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: 'Failed to send Slack notification.',
    });
  }
});

notificationRoutes.get('/telegram', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.notifications.agents.telegram);
});

notificationRoutes.post('/telegram', async (req, res) => {
  const settings = getSettings();

  settings.notifications.agents.telegram = req.body;
  await settings.save();

  res.status(200).json(settings.notifications.agents.telegram);
});

notificationRoutes.post('/telegram/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const telegramAgent = new TelegramAgent(req.body);
  if (await sendTestNotification(telegramAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: 'Failed to send Telegram notification.',
    });
  }
});

notificationRoutes.get('/pushbullet', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.notifications.agents.pushbullet);
});

notificationRoutes.post('/pushbullet', async (req, res) => {
  const settings = getSettings();

  settings.notifications.agents.pushbullet = req.body;
  await settings.save();

  res.status(200).json(settings.notifications.agents.pushbullet);
});

notificationRoutes.post('/pushbullet/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const pushbulletAgent = new PushbulletAgent(req.body);
  if (await sendTestNotification(pushbulletAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: 'Failed to send Pushbullet notification.',
    });
  }
});

notificationRoutes.get('/pushover', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.notifications.agents.pushover);
});

notificationRoutes.post('/pushover', async (req, res) => {
  const settings = getSettings();

  settings.notifications.agents.pushover = req.body;
  await settings.save();

  res.status(200).json(settings.notifications.agents.pushover);
});

notificationRoutes.post('/pushover/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const pushoverAgent = new PushoverAgent(req.body);
  if (await sendTestNotification(pushoverAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: 'Failed to send Pushover notification.',
    });
  }
});

notificationRoutes.get('/email', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.notifications.agents.email);
});

notificationRoutes.post('/email', async (req, res) => {
  const settings = getSettings();

  settings.notifications.agents.email = req.body;
  await settings.save();

  res.status(200).json(settings.notifications.agents.email);
});

notificationRoutes.post('/email/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const emailAgent = new EmailAgent(req.body);
  if (await sendTestNotification(emailAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: 'Failed to send email notification.',
    });
  }
});

notificationRoutes.get('/webpush', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.notifications.agents.webpush);
});

notificationRoutes.post('/webpush', async (req, res) => {
  const settings = getSettings();

  settings.notifications.agents.webpush = req.body;
  await settings.save();

  res.status(200).json(settings.notifications.agents.webpush);
});

notificationRoutes.post('/webpush/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const webpushAgent = new WebPushAgent(req.body);
  if (await sendTestNotification(webpushAgent, req.user)) {
    return res.status(204).send();
  } else {
    return next({
      status: 500,
      message: 'Failed to send web push notification.',
    });
  }
});

notificationRoutes.get('/webhook', (_req, res) => {
  const settings = getSettings();

  const webhookSettings = settings.notifications.agents.webhook;

  const response: typeof webhookSettings = {
    enabled: webhookSettings.enabled,
    embedPoster: webhookSettings.embedPoster,
    types: webhookSettings.types,
    options: {
      ...webhookSettings.options,
      jsonPayload: JSON.parse(
        Buffer.from(webhookSettings.options.jsonPayload, 'base64').toString(
          'utf8'
        )
      ),
      supportVariables: webhookSettings.options.supportVariables ?? false,
    },
  };

  res.status(200).json(response);
});

notificationRoutes.post('/webhook', async (req, res, next) => {
  const settings = getSettings();
  try {
    JSON.parse(req.body.options.jsonPayload);

    settings.notifications.agents.webhook = {
      enabled: req.body.enabled,
      embedPoster: req.body.embedPoster,
      types: req.body.types,
      options: {
        jsonPayload: Buffer.from(req.body.options.jsonPayload).toString(
          'base64'
        ),
        webhookUrl: req.body.options.webhookUrl,
        authHeader: req.body.options.authHeader,
        supportVariables: req.body.options.supportVariables ?? false,
      },
    };
    await settings.save();

    res.status(200).json(settings.notifications.agents.webhook);
  } catch (e) {
    next({ status: 500, message: e.message });
  }
});

notificationRoutes.post('/webhook/test', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  try {
    JSON.parse(req.body.options.jsonPayload);

    const testBody = {
      enabled: req.body.enabled,
      embedPoster: req.body.embedPoster,
      types: req.body.types,
      options: {
        jsonPayload: Buffer.from(req.body.options.jsonPayload).toString(
          'base64'
        ),
        webhookUrl: req.body.options.webhookUrl,
        authHeader: req.body.options.authHeader,
        supportVariables: req.body.options.supportVariables ?? false,
      },
    };

    const webhookAgent = new WebhookAgent(testBody);
    if (await sendTestNotification(webhookAgent, req.user)) {
      return res.status(204).send();
    } else {
      return next({
        status: 500,
        message: 'Failed to send webhook notification.',
      });
    }
  } catch (e) {
    next({ status: 500, message: e.message });
  }
});

notificationRoutes.get('/gotify', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.notifications.agents.gotify);
});

notificationRoutes.post('/gotify', async (req, res) => {
  const settings = getSettings();

  settings.notifications.agents.gotify = req.body;
  await settings.save();

  res.status(200).json(settings.notifications.agents.gotify);
});

notificationRoutes.post('/gotify/test', async (req, res, next) => {
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
