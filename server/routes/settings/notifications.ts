import { MediaType } from '@server/constants/media';
import type { User } from '@server/entity/User';
import { Notification } from '@server/lib/notifications';
import type {
  NotificationAgent,
  NotificationPayload,
} from '@server/lib/notifications/agents/agent';
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
import {
  TemplateEngine,
  TEMPLATE_VARIABLES,
} from '@server/lib/notifications/template-engine';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import * as EmailValidator from 'email-validator';
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

// Route to test specific email templates
notificationRoutes.post('/email/test-template', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const { notificationType, settings: userSettings } = req.body;

  if (!notificationType) {
    return next({
      status: 400,
      message: 'Notification type is required for template testing.',
    });
  }

  try {
    if (!EmailValidator.validate(req.user.email)) {
      return next({
        status: 400,
        message: 'Invalid email address for current user.',
      });
    }

    // Create example payload for template rendering with realistic TMDB data for The Matrix
    const examplePayload = {
      notifySystem: false,
      notifyAdmin: false,
      notifyUser: req.user,
      event: 'New Request',
      subject: 'The Matrix',
      message:
        'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.',
      image:
        'https://image.tmdb.org/t/p/w600_and_h900_bestv2/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
      media: {
        id: 1,
        mediaType: MediaType.MOVIE,
        tmdbId: 603,
        imdbId: 'tt0133093',
        status: 3,
        status4k: 1,
      },
      request: {
        id: 1234,
        is4k: false,
        seasonCount: 0,
        createdAt: '2025-01-12T10:30:00.000Z',
        requestedBy: {
          id: 5,
          displayName: 'John Doe',
          email: 'john@example.com',
          requestCount: 15,
        },
      },
    } as unknown as NotificationPayload;

    const emailAgent = new EmailAgent(userSettings);
    const success = await emailAgent.send(notificationType, examplePayload);

    if (success) {
      logger.info('Template test email sent successfully', {
        label: 'Email Template Test',
        notificationType: Notification[notificationType],
        recipient: req.user.email,
      });
      return res.status(204).send();
    } else {
      return next({
        status: 500,
        message: 'Failed to send template test email.',
      });
    }
  } catch (error) {
    logger.error('Template test failed', {
      label: 'Email Template Test',
      error: error instanceof Error ? error.message : 'Unknown error',
      notificationType: Notification[notificationType],
      recipient: req.user?.email,
    });

    return next({
      status: 500,
      message: `Template test failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    });
  }
});

// Route to get email preview HTML
notificationRoutes.post('/email/preview', async (req, res, next) => {
  if (!req.user) {
    return next({
      status: 500,
      message: 'User information is missing from the request.',
    });
  }

  const {
    notificationType,
    settings: userSettings,
    useCustom,
    templateName,
  } = req.body;

  if (!notificationType) {
    return next({
      status: 400,
      message: 'Notification type is required for email preview.',
    });
  }

  try {
    const globalSettings = getSettings();

    // Create example payload for preview rendering
    const examplePayload = {
      notifySystem: false,
      notifyAdmin: false,
      notifyUser: req.user,
      event: 'New Request',
      subject: 'The Matrix',
      message:
        'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.',
      image:
        'https://image.tmdb.org/t/p/w600_and_h900_bestv2/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
      media: {
        id: 1,
        mediaType: MediaType.MOVIE,
        tmdbId: 603,
        imdbId: 'tt0133093',
        status: 3,
        status4k: 1,
      },
      request: {
        id: 1234,
        is4k: false,
        seasonCount: 0,
        createdAt: '2025-01-12T10:30:00.000Z',
        requestedBy: {
          id: 5,
          displayName: 'John Doe',
          email: 'john@example.com',
          requestCount: 15,
        },
      },
    } as unknown as NotificationPayload;

    let subject, body;

    if (useCustom) {
      const getCustomTemplateKey = (type: number): string => {
        switch (type) {
          case Notification.MEDIA_PENDING:
            return 'mediaPending';
          case Notification.MEDIA_APPROVED:
            return 'mediaApproved';
          case Notification.MEDIA_AVAILABLE:
            return 'mediaAvailable';
          case Notification.MEDIA_FAILED:
            return 'mediaFailed';
          case Notification.MEDIA_DECLINED:
            return 'mediaDeclined';
          case Notification.MEDIA_AUTO_APPROVED:
            return 'mediaAutoApproved';
          case Notification.MEDIA_AUTO_REQUESTED:
            return 'mediaAutoRequested';
          case Notification.ISSUE_CREATED:
            return 'issueCreated';
          case Notification.TEST_NOTIFICATION:
            return 'testNotification';
          default:
            return 'mediaRequest';
        }
      };

      const customTemplateKey = getCustomTemplateKey(notificationType);
      const customTemplate =
        userSettings.options?.customTemplates?.[customTemplateKey];

      if (customTemplate) {
        subject = TemplateEngine.renderTemplate(
          customTemplate.subject || '',
          notificationType,
          examplePayload,
          req.user.email,
          req.user.displayName,
          globalSettings.main.applicationUrl,
          globalSettings.main.applicationTitle
        );

        body = TemplateEngine.renderTemplate(
          customTemplate.body || '',
          notificationType,
          examplePayload,
          req.user.email,
          req.user.displayName,
          globalSettings.main.applicationUrl,
          globalSettings.main.applicationTitle
        );
      } else {
        const emailAgent = new EmailAgent();
        const message = emailAgent.buildMessage(
          notificationType,
          examplePayload,
          req.user.email,
          req.user.displayName
        );

        if (message && message.message) {
          subject = message.message.subject || '';
          body =
            'This notification uses the default Jellyseerr email template with full styling and layout.';
        } else {
          subject = '';
          body = 'Preview not available for this notification type.';
        }
      }

      const templateKey = getCustomTemplateKey(notificationType);
      const isCustomHtml =
        userSettings.options?.customTemplates?.[templateKey]?.useCustomHtml;

      if (isCustomHtml) {
        const html = `
          <div style="border: 2px solid #f59e0b; padding: 1rem; margin-bottom: 1rem; background: #fef3c7; color: #92400e; border-radius: 4px;">
            <strong>⚠️ Custom HTML Mode:</strong> This shows your raw HTML content. The actual email will use only your HTML without any Jellyseerr styling.
          </div>
          ${body}
        `;
        res.status(200).json({ subject, html });
      } else {
        const html = `
          <div style="font-family: Inter, Arial, sans-serif; background-color: #111827; color: white; padding: 2rem; border-radius: 8px;">
            <h2 style="text-align: center; margin-bottom: 2rem;">Email Preview - ${
              templateName || 'Custom Template'
            } (Custom)</h2>
            <div style="text-align: center; margin-bottom: 1rem;">
              <h1 style="font-size: 3em; font-weight: 700;">Jellyseerr</h1>
            </div>
            <div style="text-align: center; margin: 1rem 0;">
              <div style="font-size: 1.25em;">Hi, ${req.user.displayName}!</div>
            </div>
            <div style="background: rgba(255,255,255,0.05); border-radius: .75rem; padding: 1.5rem; margin: 1.5rem 0;">
              <div style="white-space: pre-line; line-height: 1.6;">
                ${body.replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        `;
        res.status(200).json({ subject, html });
      }
    } else {
      const mediaType = 'movie';
      const is4k = false;

      const getDefaultEvent = (type: number): string => {
        switch (type) {
          case Notification.MEDIA_PENDING:
            return 'New Request';
          case Notification.MEDIA_AUTO_REQUESTED:
            return 'Auto Request';
          case Notification.MEDIA_APPROVED:
            return 'Request Approved';
          case Notification.MEDIA_AUTO_APPROVED:
            return 'Auto Approved';
          case Notification.MEDIA_AVAILABLE:
            return 'Available';
          case Notification.MEDIA_DECLINED:
            return 'Request Declined';
          case Notification.MEDIA_FAILED:
            return 'Request Failed';
          case Notification.TEST_NOTIFICATION:
            return 'Test Email';
          case Notification.ISSUE_CREATED:
            return 'New Issue';
          case Notification.ISSUE_COMMENT:
            return 'Issue Comment';
          case Notification.ISSUE_RESOLVED:
            return 'Issue Resolved';
          case Notification.ISSUE_REOPENED:
            return 'Issue Reopened';
          default:
            return 'Notification';
        }
      };

      const getDefaultBody = (type: number): string => {
        switch (type) {
          case Notification.MEDIA_PENDING:
            return `A new request for the following ${mediaType} ${
              is4k ? 'in 4K ' : ''
            }is pending approval:`;
          case Notification.MEDIA_AUTO_REQUESTED:
            return `A new request for the following ${mediaType} ${
              is4k ? 'in 4K ' : ''
            }was automatically submitted:`;
          case Notification.MEDIA_APPROVED:
            return `Your request for the following ${mediaType} ${
              is4k ? 'in 4K ' : ''
            }has been approved:`;
          case Notification.MEDIA_AUTO_APPROVED:
            return `A new request for the following ${mediaType} ${
              is4k ? 'in 4K ' : ''
            }has been automatically approved:`;
          case Notification.MEDIA_AVAILABLE:
            return `Your request for the following ${mediaType} ${
              is4k ? 'in 4K ' : ''
            }is now available:`;
          case Notification.MEDIA_DECLINED:
            return `Your request for the following ${mediaType} ${
              is4k ? 'in 4K ' : ''
            }was declined:`;
          case Notification.MEDIA_FAILED:
            return `A request for the following ${mediaType} ${
              is4k ? 'in 4K ' : ''
            }failed to be added to Radarr:`;
          case Notification.TEST_NOTIFICATION:
            return 'This is a test email from Jellyseerr.';
          case Notification.ISSUE_CREATED:
            return 'A new issue has been reported for the following media:';
          case Notification.ISSUE_COMMENT:
            return 'A new comment has been added to an issue:';
          case Notification.ISSUE_RESOLVED:
            return 'An issue has been resolved:';
          case Notification.ISSUE_REOPENED:
            return 'An issue has been reopened:';
          default:
            return 'You have a notification from Jellyseerr.';
        }
      };

      subject = `${getDefaultEvent(notificationType)} - ${
        examplePayload.subject
      } [${globalSettings.main.applicationTitle}]`;
      const defaultBody = getDefaultBody(notificationType);

      const isIssueNotification =
        notificationType === Notification.ISSUE_CREATED ||
        notificationType === Notification.ISSUE_COMMENT ||
        notificationType === Notification.ISSUE_RESOLVED ||
        notificationType === Notification.ISSUE_REOPENED;

      // Create HTML preview that mimics the actual email layout
      const html = `
        <div style="font-family: Inter, Arial, sans-serif; background-color: #111827; color: white; padding: 2rem; border-radius: 8px;">
          <h2 style="text-align: center; margin-bottom: 2rem;">Email Preview - ${
            templateName || 'Default Template'
          } (Default)</h2>
          <div style="text-align: center; margin-bottom: 1rem;">
            <h1 style="font-size: 3em; font-weight: 700;">Jellyseerr</h1>
          </div>
          <div style="text-align: center; margin: 1rem 0;">
            <div style="font-size: 1.25em;">Hi, ${req.user.displayName}!</div>
          </div>
          <div style="text-align: center; margin: 1rem 0;">
            <div style="font-size: 1.25em;">${defaultBody}</div>
          </div>
          ${
            !isIssueNotification
              ? `
          <div style="margin: 1.5rem 0; padding: 1rem; border: 1px solid #666; border-radius: 8px; background: linear-gradient(135deg, rgba(17,24,39,0.47) 0%, rgb(17,24,39) 75%);">
            <div style="display: flex; align-items: center; color: white;">
              <img src="${examplePayload.image}" style="width: 60px; height: 90px; border-radius: 4px; margin-right: 1rem;" alt="Poster" />
              <div>
                <div style="font-weight: bold; font-size: 1.1em;">${examplePayload.subject}</div>
                <div style="margin-top: 0.5rem; opacity: 0.8;">Requested By: John Doe</div>
                <div style="margin-top: 0.25rem; opacity: 0.6; font-size: 0.9em;">January 15, 2025</div>
              </div>
            </div>
          </div>
          `
              : `
          <div style="margin: 1.5rem 0; padding: 1rem; border: 1px solid #666; border-radius: 8px; background: rgba(255,255,255,0.05);">
            <div style="color: white;">
              <div style="font-weight: bold; font-size: 1.1em;">${examplePayload.subject}</div>
              <div style="margin-top: 0.5rem; opacity: 0.8;">Reported By: John Doe</div>
              <div style="margin-top: 0.25rem; opacity: 0.6; font-size: 0.9em;">January 15, 2025</div>
            </div>
          </div>
          `
          }
        </div>
      `;

      res.status(200).json({ subject, html });
    }
  } catch (error) {
    logger.error('Email preview failed', {
      label: 'Email Preview',
      error: error instanceof Error ? error.message : 'Unknown error',
      notificationType: Notification[notificationType],
    });

    return next({
      status: 500,
      message: `Email preview failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
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

const getEmailAgentDefaults = (
  type: Notification
): { subject: string; body: string } => {
  const mediaType = 'movie';
  const is4k = false;

  // Subject follows EmailAgent pattern: event - mediaName [applicationTitle]
  const getDefaultEvent = (notificationType: Notification): string => {
    switch (notificationType) {
      case Notification.MEDIA_PENDING:
        return 'New Request';
      case Notification.MEDIA_AUTO_REQUESTED:
        return 'Auto Request';
      case Notification.MEDIA_APPROVED:
        return 'Request Approved';
      case Notification.MEDIA_AUTO_APPROVED:
        return 'Auto Approved';
      case Notification.MEDIA_AVAILABLE:
        return 'Available';
      case Notification.MEDIA_DECLINED:
        return 'Request Declined';
      case Notification.MEDIA_FAILED:
        return 'Request Failed';
      case Notification.TEST_NOTIFICATION:
        return 'Test Email';
      default:
        return 'Notification';
    }
  };

  // Body follows EmailAgent hardcoded templates
  const getDefaultBody = (notificationType: Notification): string => {
    switch (notificationType) {
      case Notification.MEDIA_PENDING:
        return `A new request for the following ${mediaType} ${
          is4k ? 'in 4K ' : ''
        }is pending approval:`;
      case Notification.MEDIA_AUTO_REQUESTED:
        return `A new request for the following ${mediaType} ${
          is4k ? 'in 4K ' : ''
        }was automatically submitted:`;
      case Notification.MEDIA_APPROVED:
        return `Your request for the following ${mediaType} ${
          is4k ? 'in 4K ' : ''
        }has been approved:`;
      case Notification.MEDIA_AUTO_APPROVED:
        return `A new request for the following ${mediaType} ${
          is4k ? 'in 4K ' : ''
        }has been automatically approved:`;
      case Notification.MEDIA_AVAILABLE:
        return `Your request for the following ${mediaType} ${
          is4k ? 'in 4K ' : ''
        }is now available:`;
      case Notification.MEDIA_DECLINED:
        return `Your request for the following ${mediaType} ${
          is4k ? 'in 4K ' : ''
        }was declined:`;
      case Notification.MEDIA_FAILED:
        return `A request for the following ${mediaType} ${
          is4k ? 'in 4K ' : ''
        }failed to be added to Radarr:`;
      case Notification.TEST_NOTIFICATION:
        return 'This is a test email from Jellyseerr.';
      default:
        return 'You have a notification from Jellyseerr.';
    }
  };

  return {
    subject: `${getDefaultEvent(type)} - [Media Name] [Jellyseerr]`,
    body: getDefaultBody(type),
  };
};

// Route to get available template variables
notificationRoutes.get('/email/template-variables', (_req, res) => {
  res.status(200).json({
    variables: TEMPLATE_VARIABLES,
    defaults: {
      MEDIA_PENDING: getEmailAgentDefaults(Notification.MEDIA_PENDING),
      MEDIA_AUTO_REQUESTED: getEmailAgentDefaults(
        Notification.MEDIA_AUTO_REQUESTED
      ),
      MEDIA_APPROVED: getEmailAgentDefaults(Notification.MEDIA_APPROVED),
      MEDIA_AUTO_APPROVED: getEmailAgentDefaults(
        Notification.MEDIA_AUTO_APPROVED
      ),
      MEDIA_AVAILABLE: getEmailAgentDefaults(Notification.MEDIA_AVAILABLE),
      MEDIA_DECLINED: getEmailAgentDefaults(Notification.MEDIA_DECLINED),
      MEDIA_FAILED: getEmailAgentDefaults(Notification.MEDIA_FAILED),
      ISSUE_CREATED: {
        subject: 'New Issue - [Media Name] [Jellyseerr]',
        body: 'A new issue has been reported.',
      },
      TEST_NOTIFICATION: getEmailAgentDefaults(Notification.TEST_NOTIFICATION),
    },
  });
});

export default notificationRoutes;
