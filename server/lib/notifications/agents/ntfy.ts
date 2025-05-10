import { IssueStatus, IssueTypeName } from '@server/constants/issue';
import type { NotificationAgentNtfy } from '@server/interfaces/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios from 'axios';
import { hasNotificationType, Notification } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

class NtfyAgent
  extends BaseAgent<NotificationAgentNtfy>
  implements NotificationAgent
{
  private buildPayload(type: Notification, payload: NotificationPayload) {
    const { applicationUrl } = getSettings().main;

    const topic = this.getSettings().options.topic;
    const priority = 3;

    const title = payload.event
      ? `${payload.event} - ${payload.subject}`
      : payload.subject;
    let message = payload.message ?? '';

    if (payload.request) {
      message += `\n\nRequested By: ${payload.request.requestedBy.displayName}`;

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
        message += `\nRequest Status: ${status}`;
      }
    } else if (payload.comment) {
      message += `\nComment from ${payload.comment.user.displayName}:\n${payload.comment.message}`;
    } else if (payload.issue) {
      message += `\n\nReported By: ${payload.issue.createdBy.displayName}`;
      message += `\nIssue Type: ${IssueTypeName[payload.issue.issueType]}`;
      message += `\nIssue Status: ${
        payload.issue.status === IssueStatus.OPEN ? 'Open' : 'Resolved'
      }`;
    }

    for (const extra of payload.extra ?? []) {
      message += `\n\n**${extra.name}**\n${extra.value}`;
    }

    const attach = payload.image;

    let click;
    if (applicationUrl && payload.media) {
      click = `${applicationUrl}/${payload.media.mediaType}/${payload.media.tmdbId}`;
    }

    return {
      topic,
      priority,
      title,
      message,
      attach,
      click,
    };
  }

  public shouldSend(): boolean {
    const settings = this.getSettings();

    if (settings.enabled && settings.options.url && settings.options.topic) {
      return true;
    }

    return false;
  }

  public async send(
    type: Notification,
    payload: NotificationPayload
  ): Promise<boolean> {
    const settings = this.getSettings() as NotificationAgentNtfy;

    if (
      !payload.notifySystem ||
      !hasNotificationType(type, settings.types ?? 0)
    ) {
      return true;
    }

    logger.debug('Sending ntfy notification', {
      label: 'Notifications',
      type: Notification[type],
      subject: payload.subject,
    });

    try {
      let authHeader;
      if (
        settings.options.authMethodUsernamePassword &&
        settings.options.username &&
        settings.options.password
      ) {
        const encodedAuth = Buffer.from(
          `${settings.options.username}:${settings.options.password}`
        ).toString('base64');

        authHeader = `Basic ${encodedAuth}`;
      } else if (settings.options.authMethodToken) {
        authHeader = `Bearer ${settings.options.token}`;
      }

      await axios.post(
        settings.options.url,
        this.buildPayload(type, payload),
        authHeader
          ? {
              headers: {
                Authorization: authHeader,
              },
            }
          : undefined
      );

      return true;
    } catch (e) {
      logger.error('Error sending ntfy notification', {
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

export default NtfyAgent;
