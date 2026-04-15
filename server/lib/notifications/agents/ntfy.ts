import { IssueStatus, IssueTypeName } from '@server/constants/issue';
import { getIntl } from '@server/i18n';
import globalMessages from '@server/i18n/globalMessages';
import type { NotificationAgentNtfy } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { AvailableLocale } from '@server/types/languages';
import axios from 'axios';
import { Notification, hasNotificationType } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

class NtfyAgent
  extends BaseAgent<NotificationAgentNtfy>
  implements NotificationAgent
{
  protected getSettings(): NotificationAgentNtfy {
    if (this.settings) {
      return this.settings;
    }

    const settings = getSettings();

    return settings.notifications.agents.ntfy;
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!|>~<])/g, '\\$1');
  }

  private buildPayload(type: Notification, payload: NotificationPayload) {
    const settings = this.getSettings();
    const intl = getIntl(settings.options.locale as AvailableLocale);
    const { applicationUrl } = getSettings().main;
    const embedPoster = settings.embedPoster;

    const topic = settings.options.topic;
    const priority = settings.options.priority ?? 3;

    const title = payload.event
      ? `${payload.event} - ${payload.subject}`
      : payload.subject;
    let message = payload.message ?? '';

    if (payload.request) {
      message += `${message ? '\n\n' : ''}**${intl.formatMessage(globalMessages.requestedBy)}:** ${this.escapeMarkdown(payload.request.requestedBy.displayName)}`;

      let status = '';
      switch (type) {
        case Notification.MEDIA_PENDING:
          status = intl.formatMessage(globalMessages.pendingApproval);
          break;
        case Notification.MEDIA_APPROVED:
        case Notification.MEDIA_AUTO_APPROVED:
          status = intl.formatMessage(globalMessages.processing);
          break;
        case Notification.MEDIA_AVAILABLE:
          status = intl.formatMessage(globalMessages.available);
          break;
        case Notification.MEDIA_DECLINED:
          status = intl.formatMessage(globalMessages.declined);
          break;
        case Notification.MEDIA_FAILED:
          status = intl.formatMessage(globalMessages.failed);
          break;
      }

      if (status) {
        message += `\n**${intl.formatMessage(globalMessages.requestStatus)}:** ${status}`;
      }
    } else if (payload.comment) {
      message += `\n**${this.escapeMarkdown(
        intl.formatMessage(globalMessages.commentFrom, {
          userName: payload.comment.user.displayName,
        })
      )}:**\n${payload.comment.message}`;
    } else if (payload.issue) {
      message += `\n\n**${intl.formatMessage(globalMessages.reportedBy)}:** ${this.escapeMarkdown(payload.issue.createdBy.displayName)}`;
      message += `\n**${intl.formatMessage(globalMessages.issueType)}:** ${IssueTypeName[payload.issue.issueType]}`;
      message += `\n**${intl.formatMessage(globalMessages.issueStatus)}:** ${
        payload.issue.status === IssueStatus.OPEN
          ? intl.formatMessage(globalMessages.open)
          : intl.formatMessage(globalMessages.resolved)
      }`;
    }

    for (const extra of payload.extra ?? []) {
      message += `\n\n**${extra.name}**\n${extra.value}`;
    }

    const attach = embedPoster ? payload.image : undefined;

    let click;
    if (applicationUrl && payload.media) {
      click = `${applicationUrl}/${payload.media.mediaType}/${payload.media.tmdbId}`;
    }

    return {
      topic,
      priority,
      title,
      message,
      markdown: true,
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
    const settings = this.getSettings();

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
