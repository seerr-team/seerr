import { IssueStatus, IssueTypeName } from '@server/constants/issue';
import type { NotificationAgentSlack } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios from 'axios';
import { hasNotificationType, Notification } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

interface EmbedField {
  type: 'plain_text' | 'mrkdwn';
  text: string;
}

interface TextItem {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

interface Element {
  type: 'button';
  text?: TextItem;
  action_id: string;
  url?: string;
  value?: string;
  style?: 'primary' | 'danger';
}

interface EmbedBlock {
  type: 'header' | 'actions' | 'section' | 'context';
  block_id?: 'section789';
  text?: TextItem;
  fields?: EmbedField[];
  accessory?: {
    type: 'image';
    image_url: string;
    alt_text: string;
  };
  elements?: (Element | TextItem)[];
}

interface SlackBlockEmbed {
  text: string;
  blocks: EmbedBlock[];
}

class SlackAgent
  extends BaseAgent<NotificationAgentSlack>
  implements NotificationAgent
{
  protected getSettings(): NotificationAgentSlack {
    if (this.settings) {
      return this.settings;
    }

    const settings = getSettings();

    return settings.notifications.agents.slack;
  }

  public buildEmbed(
    type: Notification,
    payload: NotificationPayload
  ): SlackBlockEmbed {
    const settings = getSettings();
    const { applicationUrl, applicationTitle } = settings.main;
    const { embedImage } = settings.notifications.agents.slack;

    const fields: EmbedField[] = [];

    if (payload.request) {
      fields.push({
        type: 'mrkdwn',
        text: `*Requested By*\n${payload.request.requestedBy.displayName}`,
      });

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
        fields.push({
          type: 'mrkdwn',
          text: `*Request Status*\n${status}`,
        });
      }
    } else if (payload.comment) {
      fields.push({
        type: 'mrkdwn',
        text: `*Comment from ${payload.comment.user.displayName}*\n${payload.comment.message}`,
      });
    } else if (payload.issue) {
      fields.push(
        {
          type: 'mrkdwn',
          text: `*Reported By*\n${payload.issue.createdBy.displayName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Issue Type*\n${IssueTypeName[payload.issue.issueType]}`,
        },
        {
          type: 'mrkdwn',
          text: `*Issue Status*\n${
            payload.issue.status === IssueStatus.OPEN ? 'Open' : 'Resolved'
          }`,
        }
      );
    }

    for (const extra of payload.extra ?? []) {
      fields.push({
        type: 'mrkdwn',
        text: `*${extra.name}*\n${extra.value}`,
      });
    }

    const blocks: EmbedBlock[] = [];

    if (payload.event) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*${payload.event}*`,
          },
        ],
      });
    }

    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: payload.subject,
      },
    });

    if (payload.message) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: payload.message,
        },
        accessory:
          embedImage && payload.image
            ? {
                type: 'image',
                image_url: payload.image,
                alt_text: payload.subject,
              }
            : undefined,
      });
    }

    if (fields.length > 0) {
      blocks.push({
        type: 'section',
        fields,
      });
    }

    const url = applicationUrl
      ? payload.issue
        ? `${applicationUrl}/issues/${payload.issue.id}`
        : payload.media
        ? `${applicationUrl}/${payload.media.mediaType}/${payload.media.tmdbId}`
        : undefined
      : undefined;

    if (url) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            action_id: 'open-in-jellyseerr',
            type: 'button',
            url,
            text: {
              type: 'plain_text',
              text: `View ${
                payload.issue ? 'Issue' : 'Media'
              } in ${applicationTitle}`,
            },
          },
        ],
      });
    }

    return {
      text: payload.event ?? payload.subject,
      blocks,
    };
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

    logger.debug('Sending Slack notification', {
      label: 'Notifications',
      type: Notification[type],
      subject: payload.subject,
    });
    try {
      await axios.post(
        settings.options.webhookUrl,
        this.buildEmbed(type, payload)
      );

      return true;
    } catch (e) {
      logger.error('Error sending Slack notification', {
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

export default SlackAgent;
