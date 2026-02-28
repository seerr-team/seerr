import { IssueStatus, IssueTypeName } from '@server/constants/issue';
import type { NotificationAgentApprise } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import {
  getAvailableMediaServerName,
  getAvailableMediaServerUrl,
} from '@server/utils/mediaServerHelper';
import axios from 'axios';
import { Notification, hasNotificationType } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

interface AppriseOptions {
  format: 'text' | 'markdown' | 'html' | 'ignore';
  tags?: string;
  apiToken?: string;
  title?: string;
  body?: string;
  urls?: string;
  type: 'info' | 'success' | 'warning' | 'failure';
}

class AppriseAgent
  extends BaseAgent<NotificationAgentApprise>
  implements NotificationAgent
{
  protected getSettings(): NotificationAgentApprise {
    if (this.settings) {
      return this.settings;
    }

    const settings = getSettings();

    return settings.notifications.agents.apprise;
  }

  public shouldSend(): boolean {
    const settings = this.getSettings();

    return !!(settings.enabled && settings.options.url);
  }

  private buildRequest(
    type: Notification,
    payload: NotificationPayload
  ): AppriseOptions {
    const settings = getSettings();
    const { applicationUrl, applicationTitle, mediaServerType } = settings.main;
    const mediaServerName = getAvailableMediaServerName(mediaServerType);
    const mediaServerUrl = getAvailableMediaServerUrl(payload);

    let title = '';
    let body = '';
    if (payload.event) {
      title += `**${payload.event}**`;
      body += `${payload.subject}\n\n`;
    } else {
      title += `**${payload.subject}**`;
      body += `${payload.message}\n\n`;
    }

    if (applicationUrl) {
      title += ` [[${applicationTitle}]](${applicationUrl})`;
    } else {
      title += ` [${applicationTitle}]`;
    }

    if (payload.request) {
      body += `Requested By\n${payload.request.requestedBy.displayName}`;
      let status = '';

      switch (type) {
        case Notification.MEDIA_PENDING:
          status = `Pending Approval`;
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
        body += `\n\nRequest Status\n${status}`;
      }
    } else if (payload.comment) {
      body += `\n\nComment From ${payload.comment.user.displayName}\n${payload.comment.message}`;
    } else if (payload.issue) {
      body += `\n\nReported By\n${payload.issue.createdBy.displayName}\n\nIssue Type\n${IssueTypeName[payload.issue.issueType]}\n\nIssue Status\n${payload.issue.status === IssueStatus.OPEN ? 'Open' : 'Resolved'}`;
    }

    const url = applicationUrl
      ? payload.issue
        ? `${applicationUrl}/issues/${payload.issue.id}`
        : payload.media
          ? `${applicationUrl}/${payload.media.mediaType}/${payload.media.tmdbId}`
          : undefined
      : undefined;

    if (url) {
      body += `\n\nView ${
        payload.issue ? 'Issue' : 'Media'
      } in [${applicationTitle}](${url})`;
    }

    if (mediaServerUrl) {
      body += `\n\nPlay on [${mediaServerName}](${mediaServerUrl})`;
    }

    if (payload.notifyUser?.settings?.appriseStatelessURL) {
      return {
        title: title,
        body: body,
        format: 'markdown',
        urls: payload.notifyUser?.settings?.appriseStatelessURL,
        type: 'info',
      };
    } else {
      return {
        title: title,
        body: body,
        format: 'markdown',
        tags: payload.notifyUser?.settings?.appriseTags || 'all',
        type: 'info',
      };
    }
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

    logger.debug('Sending Apprise notification', {
      label: 'Notifications',
      type: Notification[type],
      subject: payload.subject,
    });

    try {
      await axios.post(settings.options.url, this.buildRequest(type, payload));

      return true;
    } catch (e) {
      logger.error('Error sending Apprise notification', {
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

export default AppriseAgent;
