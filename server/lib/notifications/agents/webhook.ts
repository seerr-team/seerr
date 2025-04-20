import { IssueStatus, IssueType } from '@server/constants/issue';
import { MediaStatus } from '@server/constants/media';
import type { NotificationAgentWebhook } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios from 'axios';
import { get } from 'lodash';
import { hasNotificationType, Notification } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

type KeyMapFunction = (
  payload: NotificationPayload,
  type: Notification
) => string;

const KeyMap: Record<string, string | KeyMapFunction> = {
  notification_type: (_payload, type) => Notification[type],
  event: 'event',
  subject: 'subject',
  message: 'message',
  image: 'image',
  notifyuser_username: 'notifyUser.displayName',
  notifyuser_email: 'notifyUser.email',
  notifyuser_avatar: 'notifyUser.avatar',
  notifyuser_settings_discordId: 'notifyUser.settings.discordId',
  notifyuser_settings_telegramChatId: 'notifyUser.settings.telegramChatId',
  media_tmdbid: 'media.tmdbId',
  media_tvdbid: 'media.tvdbId',
  media_type: 'media.mediaType',
  media_status: (payload) =>
    payload.media ? MediaStatus[payload.media.status] : '',
  media_status4k: (payload) =>
    payload.media ? MediaStatus[payload.media.status4k] : '',
  request_id: 'request.id',
  requestedBy_username: 'request.requestedBy.displayName',
  requestedBy_email: 'request.requestedBy.email',
  requestedBy_avatar: 'request.requestedBy.avatar',
  requestedBy_settings_discordId: 'request.requestedBy.settings.discordId',
  requestedBy_settings_telegramChatId:
    'request.requestedBy.settings.telegramChatId',
  issue_id: 'issue.id',
  issue_type: (payload) =>
    payload.issue ? IssueType[payload.issue.issueType] : '',
  issue_status: (payload) =>
    payload.issue ? IssueStatus[payload.issue.status] : '',
  reportedBy_username: 'issue.createdBy.displayName',
  reportedBy_email: 'issue.createdBy.email',
  reportedBy_avatar: 'issue.createdBy.avatar',
  reportedBy_settings_discordId: 'issue.createdBy.settings.discordId',
  reportedBy_settings_telegramChatId: 'issue.createdBy.settings.telegramChatId',
  comment_message: 'comment.message',
  commentedBy_username: 'comment.user.displayName',
  commentedBy_email: 'comment.user.email',
  commentedBy_avatar: 'comment.user.avatar',
  commentedBy_settings_discordId: 'comment.user.settings.discordId',
  commentedBy_settings_telegramChatId: 'comment.user.settings.telegramChatId',
};

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

  private parseKeys(
    finalPayload: Record<string, unknown>,
    payload: NotificationPayload,
    type: Notification
  ): Record<string, unknown> {
    Object.keys(finalPayload).forEach((key) => {
      if (key === '{{extra}}') {
        finalPayload.extra = payload.extra ?? [];
        delete finalPayload[key];
        key = 'extra';
      } else if (key === '{{media}}') {
        if (payload.media) {
          finalPayload.media = finalPayload[key];
        } else {
          finalPayload.media = null;
        }
        delete finalPayload[key];
        key = 'media';
      } else if (key === '{{request}}') {
        if (payload.request) {
          finalPayload.request = finalPayload[key];
        } else {
          finalPayload.request = null;
        }
        delete finalPayload[key];
        key = 'request';
      } else if (key === '{{issue}}') {
        if (payload.issue) {
          finalPayload.issue = finalPayload[key];
        } else {
          finalPayload.issue = null;
        }
        delete finalPayload[key];
        key = 'issue';
      } else if (key === '{{comment}}') {
        if (payload.comment) {
          finalPayload.comment = finalPayload[key];
        } else {
          finalPayload.comment = null;
        }
        delete finalPayload[key];
        key = 'comment';
      }

      if (typeof finalPayload[key] === 'string') {
        Object.keys(KeyMap).forEach((keymapKey) => {
          const keymapValue = KeyMap[keymapKey as keyof typeof KeyMap];
          finalPayload[key] = (finalPayload[key] as string).replace(
            `{{${keymapKey}}}`,
            typeof keymapValue === 'function'
              ? keymapValue(payload, type)
              : get(payload, keymapValue) ?? ''
          );
        });
      } else if (finalPayload[key] && typeof finalPayload[key] === 'object') {
        finalPayload[key] = this.parseKeys(
          finalPayload[key] as Record<string, unknown>,
          payload,
          type
        );
      }
    });

    return finalPayload;
  }

  private buildPayload(type: Notification, payload: NotificationPayload) {
    const payloadString = this.getSettings().options.jsonPayload;
    const parsedJSON = JSON.parse(JSON.parse(payloadString));

    return this.parseKeys(parsedJSON, payload, type);
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

    try {
      await axios.post(
        settings.options.webhookUrl,
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
