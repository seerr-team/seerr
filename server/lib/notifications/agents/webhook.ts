import { TemplateEngine } from '@server/lib/notifications/templateEngine';
import type { NotificationAgentWebhook } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios from 'axios';
import { Notification, hasNotificationType } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

class WebhookAgent
  extends BaseAgent<NotificationAgentWebhook>
  implements NotificationAgent
{
  protected getSettings(): NotificationAgentWebhook {
    if (this.settings) {
      return this.settings;
    }

    const settings = getSettings();

    return settings.notifications.agents.webhook;
  }

  private buildPayload(type: Notification, payload: NotificationPayload) {
    const template = Buffer.from(
      this.getSettings().options.jsonPayload,
      'base64'
    ).toString('utf8');
    const rendered = TemplateEngine.render(template, payload, type);

    return JSON.parse(rendered);
  }

  public shouldSend(): boolean {
    const settings = this.getSettings();

    if (settings.enabled && settings.options.webhookUrl) {
      return true;
    }

    return false;
  }

  public async send(
    type: Notification,
    payload: NotificationPayload
  ): Promise<boolean> {
    const settings = this.getSettings();

    if (
      !payload.notifySystem ||
      !hasNotificationType(type, settings.types ?? 0)
    ) {
      return true;
    }

    logger.debug('Sending webhook notification', {
      label: 'Notifications',
      type: Notification[type],
      subject: payload.subject,
    });

    let webhookUrl = settings.options.webhookUrl;

    if (settings.options.supportVariables) {
      try {
        webhookUrl = TemplateEngine.render(webhookUrl, payload, type);
      } catch (error) {
        logger.error('Failed to render webhook URL template', {
          label: 'Notifications',
          type: Notification[type],
          subject: payload.subject,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        });

        return false;
      }
    }

    let body: unknown;
    try {
      body = this.buildPayload(type, payload);
    } catch (error) {
      logger.error('Failed to render webhook payload template', {
        label: 'Notifications',
        type: Notification[type],
        subject: payload.subject,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return false;
    }

    try {
      const headers: Record<string, string> = {};

      if (settings.options.authHeader) {
        headers.Authorization = settings.options.authHeader;
      }

      if (
        settings.options.customHeaders &&
        settings.options.customHeaders.length > 0
      ) {
        settings.options.customHeaders.forEach((header) => {
          const key = header.key?.trim();
          const value = header.value?.trim();

          if (key && value) {
            // Don't override Authorization header if it's already set via authHeader
            if (
              key.toLowerCase() !== 'authorization' ||
              !settings.options.authHeader
            ) {
              headers[key] = value;
            }
          }
        });
      }

      await axios.post(
        webhookUrl,
        body,
        Object.keys(headers).length > 0 ? { headers } : undefined
      );

      return true;
    } catch (e) {
      logger.error('Error sending webhook notification', {
        label: 'Notifications',
        type: Notification[type],
        subject: payload.subject,
        errorMessage: e.message,
        response: e?.response?.data,
      });

      return false;
    }
  }
}

export default WebhookAgent;
