import { TemplateEngine } from '@server/lib/notifications/templateEngine';
import type { NotificationAgentWebhook } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios from 'axios';
import { hasNotificationType, Notification } from '..';
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
    const payloadString = Buffer.from(
      this.getSettings().options.jsonPayload,
      'base64'
    ).toString('utf8');

    try {
      // Parse the outer JSON string to get the template
      const templateString = JSON.parse(payloadString);

      // Render the template with Handlebars
      let renderedString = TemplateEngine.render(templateString, payload, type);

      // Clean up common JSON issues from template rendering
      // Remove trailing commas before closing braces/brackets
      renderedString = renderedString
        .replace(/,(\s*[}\]])/g, '$1')
        // Remove multiple consecutive commas
        .replace(/,+/g, ',')
        // Remove commas after opening braces/brackets
        .replace(/([[{])\s*,/g, '$1');

      // Parse the rendered template into an object
      return JSON.parse(renderedString);
    } catch (error) {
      logger.error('Error rendering webhook payload template', {
        label: 'Notifications',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fallback: try to parse as double-encoded JSON
      try {
        return JSON.parse(JSON.parse(payloadString));
      } catch {
        throw error;
      }
    }
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
        logger.warn(
          'Error rendering webhook URL template, using original URL',
          {
            label: 'Notifications',
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          }
        );
      }
    }

    try {
      await axios.post(
        webhookUrl,
        this.buildPayload(type, payload),
        settings.options.authHeader
          ? {
              headers: {
                Authorization: settings.options.authHeader,
              },
            }
          : undefined
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
