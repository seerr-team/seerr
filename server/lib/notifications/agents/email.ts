import { IssueType, IssueTypeName } from '@server/constants/issue';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import PreparedEmail from '@server/lib/email';
import type { NotificationAgentEmail } from '@server/lib/settings';
import { getSettings, NotificationAgentKey } from '@server/lib/settings';
import logger from '@server/logger';
import type { EmailOptions } from 'email-templates';
import * as EmailValidator from 'email-validator';
import path from 'path';
import { Notification, shouldSendAdminNotification } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

class EmailAgent
  extends BaseAgent<NotificationAgentEmail>
  implements NotificationAgent
{
  protected getSettings(): NotificationAgentEmail {
    if (this.settings) {
      return this.settings;
    }

    const settings = getSettings();

    return settings.notifications.agents.email;
  }

  public shouldSend(): boolean {
    const settings = this.getSettings();

    if (
      settings.enabled &&
      settings.options.emailFrom &&
      settings.options.smtpHost &&
      settings.options.smtpPort
    ) {
      return true;
    }

    return false;
  }

  private buildMessage(
    type: Notification,
    payload: NotificationPayload,
    recipientEmail: string,
    recipientName?: string
  ): EmailOptions | undefined {
    const settings = getSettings();
    const { applicationUrl, applicationTitle } = settings.main;
    const { embedImage } = settings.notifications.agents.email;

    if (type === Notification.TEST_NOTIFICATION) {
      return {
        template: path.join(__dirname, '../../../templates/email/test-email'),
        message: {
          to: recipientEmail,
        },
        locals: {
          body: payload.message,
          applicationUrl,
          applicationTitle,
          recipientName,
          recipientEmail,
        },
      };
    }

    const mediaType = payload.media
      ? payload.media.mediaType === MediaType.MOVIE
        ? 'movie'
        : 'series'
      : undefined;
    const is4k = payload.request?.is4k;

    if (payload.request) {
      let body = '';

      switch (type) {
        case Notification.MEDIA_PENDING:
          body = `A new request for the following ${mediaType} ${
            is4k ? 'in 4K ' : ''
          }is pending approval:`;
          break;
        case Notification.MEDIA_AUTO_REQUESTED:
          body = `A new request for the following ${mediaType} ${
            is4k ? 'in 4K ' : ''
          }was automatically submitted:`;
          break;
        case Notification.MEDIA_APPROVED:
          body = `Your request for the following ${mediaType} ${
            is4k ? 'in 4K ' : ''
          }has been approved:`;
          break;
        case Notification.MEDIA_AUTO_APPROVED:
          body = `A new request for the following ${mediaType} ${
            is4k ? 'in 4K ' : ''
          }has been automatically approved:`;
          break;
        case Notification.MEDIA_AVAILABLE:
          body = `Your request for the following ${mediaType} ${
            is4k ? 'in 4K ' : ''
          }is now available:`;
          break;
        case Notification.MEDIA_DECLINED:
          body = `Your request for the following ${mediaType} ${
            is4k ? 'in 4K ' : ''
          }was declined:`;
          break;
        case Notification.MEDIA_FAILED:
          body = `A request for the following ${mediaType} ${
            is4k ? 'in 4K ' : ''
          }failed to be added to ${
            payload.media?.mediaType === MediaType.MOVIE ? 'Radarr' : 'Sonarr'
          }:`;
          break;
      }

      return {
        template: path.join(
          __dirname,
          '../../../templates/email/media-request'
        ),
        message: {
          to: recipientEmail,
        },
        locals: {
          event: payload.event,
          body,
          mediaName: payload.subject,
          mediaExtra: payload.extra ?? [],
          imageUrl: embedImage ? payload.image : undefined,
          timestamp: new Date().toTimeString(),
          requestedBy: payload.request.requestedBy.displayName,
          actionUrl: applicationUrl
            ? `${applicationUrl}/${payload.media?.mediaType}/${payload.media?.tmdbId}`
            : undefined,
          applicationUrl,
          applicationTitle,
          recipientName,
          recipientEmail,
        },
      };
    } else if (payload.issue) {
      const issueType =
        payload.issue && payload.issue.issueType !== IssueType.OTHER
          ? `${IssueTypeName[payload.issue.issueType].toLowerCase()} issue`
          : 'issue';

      let body = '';

      switch (type) {
        case Notification.ISSUE_CREATED:
          body = `A new ${issueType} has been reported by ${payload.issue.createdBy.displayName} for the ${mediaType} ${payload.subject}:`;
          break;
        case Notification.ISSUE_COMMENT:
          body = `${payload.comment?.user.displayName} commented on the ${issueType} for the ${mediaType} ${payload.subject}:`;
          break;
        case Notification.ISSUE_RESOLVED:
          body = `The ${issueType} for the ${mediaType} ${payload.subject} was marked as resolved by ${payload.issue.modifiedBy?.displayName}!`;
          break;
        case Notification.ISSUE_REOPENED:
          body = `The ${issueType} for the ${mediaType} ${payload.subject} was reopened by ${payload.issue.modifiedBy?.displayName}.`;
          break;
      }

      return {
        template: path.join(__dirname, '../../../templates/email/media-issue'),
        message: {
          to: recipientEmail,
        },
        locals: {
          event: payload.event,
          body,
          issueDescription: payload.message,
          issueComment: payload.comment?.message,
          mediaName: payload.subject,
          extra: payload.extra ?? [],
          imageUrl: embedImage ? payload.image : undefined,
          timestamp: new Date().toTimeString(),
          actionUrl: applicationUrl
            ? `${applicationUrl}/issues/${payload.issue.id}`
            : undefined,
          applicationUrl,
          applicationTitle,
          recipientName,
          recipientEmail,
        },
      };
    }

    return undefined;
  }

  public async send(
    type: Notification,
    payload: NotificationPayload
  ): Promise<boolean> {
    if (payload.notifyUser) {
      if (
        !payload.notifyUser.settings ||
        // Check if user has email notifications enabled and fallback to true if undefined
        // since email should default to true
        (payload.notifyUser.settings.hasNotificationType(
          NotificationAgentKey.EMAIL,
          type
        ) ??
          true)
      ) {
        logger.debug('Sending email notification', {
          label: 'Notifications',
          recipient: payload.notifyUser.displayName,
          type: Notification[type],
          subject: payload.subject,
        });

        try {
          const email = new PreparedEmail(
            this.getSettings(),
            payload.notifyUser.settings?.pgpKey
          );
          if (EmailValidator.validate(payload.notifyUser.email)) {
            await email.send(
              this.buildMessage(
                type,
                payload,
                payload.notifyUser.email,
                payload.notifyUser.displayName
              )
            );
          } else {
            logger.warn('Invalid email address provided for user', {
              label: 'Notifications',
              recipient: payload.notifyUser.displayName,
              type: Notification[type],
              subject: payload.subject,
            });
          }
        } catch (e) {
          logger.error('Error sending email notification', {
            label: 'Notifications',
            recipient: payload.notifyUser.displayName,
            type: Notification[type],
            subject: payload.subject,
            errorMessage: e.message,
          });

          return false;
        }
      }
    }

    if (payload.notifyAdmin) {
      const userRepository = getRepository(User);
      const users = await userRepository.find();

      await Promise.all(
        users
          .filter(
            (user) =>
              (!user.settings ||
                // Check if user has email notifications enabled and fallback to true if undefined
                // since email should default to true
                (user.settings.hasNotificationType(
                  NotificationAgentKey.EMAIL,
                  type
                ) ??
                  true)) &&
              shouldSendAdminNotification(type, user, payload)
          )
          .map(async (user) => {
            logger.debug('Sending email notification', {
              label: 'Notifications',
              recipient: user.displayName,
              type: Notification[type],
              subject: payload.subject,
            });

            try {
              const email = new PreparedEmail(
                this.getSettings(),
                user.settings?.pgpKey
              );
              if (EmailValidator.validate(user.email)) {
                await email.send(
                  this.buildMessage(type, payload, user.email, user.displayName)
                );
              } else {
                logger.warn('Invalid email address provided for user', {
                  label: 'Notifications',
                  recipient: user.displayName,
                  type: Notification[type],
                  subject: payload.subject,
                });
              }
            } catch (e) {
              logger.error('Error sending email notification', {
                label: 'Notifications',
                recipient: user.displayName,
                type: Notification[type],
                subject: payload.subject,
                errorMessage: e.message,
              });

              return false;
            }
          })
      );
    }

    return true;
  }
}

export default EmailAgent;
