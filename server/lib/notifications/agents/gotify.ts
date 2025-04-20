import { IssueStatus, IssueTypeName } from '@server/constants/issue';
import type { NotificationAgentGotify } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios from 'axios';
import { hasNotificationType, Notification } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

interface GotifyPayload {
  title: string;
  message: string;
  priority: number;
  extras: Record<string, unknown>;
}

class GotifyAgent
  extends BaseAgent<NotificationAgentGotify>
  implements NotificationAgent
{
  public shouldSend(): boolean {
    const settings = this.getSettings();

    if (
      settings.enabled &&
      settings.options.url &&
      settings.options.token &&
      settings.options.priority !== undefined
    ) {
      return true;
    }

    return false;
  }

  private getNotificationPayload(
    type: Notification,
    payload: NotificationPayload
  ): GotifyPayload {
    const { applicationUrl, applicationTitle } = getSettings().main;
    const settings = this.getSettings();
    const priority = settings.options.priority ?? 1;

    const title = payload.event
      ? `${payload.event} - ${payload.subject}`
      : payload.subject;

    let message = payload.message ? `${payload.message}  \n\n` : '';

    if (payload.request) {
      message += `\n**Requested By:** ${payload.request.requestedBy.displayName}  `;

      let status = '';
      switch (type) {
        case Notification.MEDIA_PENDING:
          status = 'Pending Approval';
          break;
        case Notification.MEDIA_APPROVED:
        case Notification.MEDIA_AUTO_APPROVED:
          status = 'Processing';
          break;
        case Notification.MEDIA_AVAILABLE:
          status = 'Available';
          break;
        case Notification.MEDIA_DECLINED:
          status = 'Declined';
          break;
        case Notification.MEDIA_FAILED:
          status = 'Failed';
          break;
      }

      if (status) {
        message += `\n**Request Status:** ${status}  `;
      }
    } else if (payload.comment) {
      message += `\nComment from ${payload.comment.user.displayName}:\n${payload.comment.message}  `;
    } else if (payload.issue) {
      message += `\n\n**Reported By:** ${payload.issue.createdBy.displayName}  `;
      message += `\n**Issue Type:** ${
        IssueTypeName[payload.issue.issueType]
      }  `;
      message += `\n**Issue Status:** ${
        payload.issue.status === IssueStatus.OPEN ? 'Open' : 'Resolved'
      }  `;
    }

    for (const extra of payload.extra ?? []) {
      message += `\n\n**${extra.name}**\n${extra.value}  `;
    }

    if (applicationUrl && payload.media) {
      const actionUrl = `${applicationUrl}/${payload.media.mediaType}/${payload.media.tmdbId}`;
      const displayUrl =
        actionUrl.length > 40 ? `${actionUrl.slice(0, 41)}...` : actionUrl;
      message += `\n\n**Open in ${applicationTitle}:** [${displayUrl}](${actionUrl})  `;
    }

    return {
      extras: {
        'client::display': {
          contentType: 'text/markdown',
        },
      },
      title,
      message,
      priority,
    };
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

    logger.debug('Sending Gotify notification', {
      label: 'Notifications',
      type: Notification[type],
      subject: payload.subject,
    });
    try {
      const endpoint = `${settings.options.url}/message?token=${settings.options.token}`;
      const notificationPayload = this.getNotificationPayload(type, payload);

      await axios.post(endpoint, notificationPayload);

      return true;
    } catch (e) {
      logger.error('Error sending Gotify notification', {
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

export default GotifyAgent;
