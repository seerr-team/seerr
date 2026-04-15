import { IssueType, IssueTypeName } from '@server/constants/issue';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { defineMessages, getIntl } from '@server/i18n';
import globalMessages from '@server/i18n/globalMessages';
import PreparedEmail from '@server/lib/email';
import type { NotificationAgentEmail } from '@server/lib/settings';
import { NotificationAgentKey, getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { AvailableLocale } from '@server/types/languages';
import type { EmailOptions } from 'email-templates';
import path from 'path';
import validator from 'validator';
import { Notification, shouldSendAdminNotification } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

const messages = defineMessages('notifications.agents.email', {
  issueType: '{type} issue',
  issue: 'issue',
  pendingRequest:
    'A new request for the following {mediaType} is pending approval:',
  pendingRequest4k:
    'A new request for the following {mediaType} in 4K is pending approval:',
  autoRequested:
    'A new request for the following {mediaType} was automatically submitted:',
  autoRequested4k:
    'A new request for the following {mediaType} in 4K was automatically submitted:',
  approvedRequest:
    'Your request for the following {mediaType} has been approved:',
  approvedRequest4k:
    'Your request for the following {mediaType} in 4K has been approved:',
  autoApproved:
    'A new request for the following {mediaType} has been automatically approved:',
  autoApproved4k:
    'A new request for the following {mediaType} in 4K has been automatically approved:',
  availableRequest:
    'Your request for the following {mediaType} is now available:',
  availableRequest4k:
    'Your request for the following {mediaType} in 4K is now available:',
  declinedRequest: 'Your request for the following {mediaType} was declined:',
  declinedRequest4k:
    'Your request for the following {mediaType} in 4K was declined:',
  failedRequest:
    'A request for the following {mediaType} failed to be added to {service}:',
  failedRequest4k:
    'A request for the following {mediaType} in 4K failed to be added to {service}:',
  issueCreated:
    'A new {issueType} has been reported by {userName} for the {mediaType} {subject}:',
  issueComment:
    '{userName} commented on the {issueType} for the {mediaType} {subject}:',
  issueResolved:
    'The {issueType} for the {mediaType} {subject} was marked as resolved by {userName}!',
  issueReopened:
    'The {issueType} for the {mediaType} {subject} was reopened by {userName}.',
});

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
    recipientName?: string,
    locale?: AvailableLocale
  ): EmailOptions | undefined {
    const intl = getIntl(locale);
    const settings = getSettings();
    const { applicationUrl, applicationTitle } = settings.main;
    const { embedPoster } = settings.notifications.agents.email;

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
        ? intl.formatMessage(globalMessages.movie)
        : intl.formatMessage(globalMessages.series)
      : undefined;
    const is4k = payload.request?.is4k;

    if (payload.request) {
      let body = '';

      switch (type) {
        case Notification.MEDIA_PENDING:
          body = intl.formatMessage(
            is4k ? messages.pendingRequest4k : messages.pendingRequest,
            { mediaType }
          );
          break;
        case Notification.MEDIA_AUTO_REQUESTED:
          body = intl.formatMessage(
            is4k ? messages.autoRequested4k : messages.autoRequested,
            { mediaType }
          );
          break;
        case Notification.MEDIA_APPROVED:
          body = intl.formatMessage(
            is4k ? messages.approvedRequest4k : messages.approvedRequest,
            { mediaType }
          );
          break;
        case Notification.MEDIA_AUTO_APPROVED:
          body = intl.formatMessage(
            is4k ? messages.autoApproved4k : messages.autoApproved,
            { mediaType }
          );
          break;
        case Notification.MEDIA_AVAILABLE:
          body = intl.formatMessage(
            is4k ? messages.availableRequest4k : messages.availableRequest,
            { mediaType }
          );
          break;
        case Notification.MEDIA_DECLINED:
          body = intl.formatMessage(
            is4k ? messages.declinedRequest4k : messages.declinedRequest,
            { mediaType }
          );
          break;
        case Notification.MEDIA_FAILED:
          body = intl.formatMessage(
            is4k ? messages.failedRequest4k : messages.failedRequest,
            {
              mediaType,
              service:
                payload.media?.mediaType === MediaType.MOVIE
                  ? 'Radarr'
                  : 'Sonarr',
            }
          );
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
          imageUrl: embedPoster ? payload.image : undefined,
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
          ? intl.formatMessage(messages.issueType, {
              type: IssueTypeName[payload.issue.issueType].toLowerCase(),
            })
          : intl.formatMessage(messages.issue);

      let body = '';

      switch (type) {
        case Notification.ISSUE_CREATED:
          body = intl.formatMessage(messages.issueCreated, {
            issueType,
            userName: payload.issue.createdBy.displayName,
            mediaType,
            subject: payload.subject,
          });
          break;
        case Notification.ISSUE_COMMENT:
          body = intl.formatMessage(messages.issueComment, {
            userName: payload.comment?.user.displayName,
            issueType,
            mediaType,
            subject: payload.subject,
          });
          break;
        case Notification.ISSUE_RESOLVED:
          body = intl.formatMessage(messages.issueResolved, {
            issueType,
            userName: payload.issue.modifiedBy?.displayName,
            mediaType,
            subject: payload.subject,
          });
          break;
        case Notification.ISSUE_REOPENED:
          body = intl.formatMessage(messages.issueReopened, {
            issueType,
            userName: payload.issue.modifiedBy?.displayName,
            mediaType,
            subject: payload.subject,
          });
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
          imageUrl: embedPoster ? payload.image : undefined,
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
          if (
            validator.isEmail(payload.notifyUser.email, { require_tld: false })
          ) {
            await email.send(
              this.buildMessage(
                type,
                payload,
                payload.notifyUser.email,
                payload.notifyUser.displayName,
                payload.notifyUser.settings?.locale as AvailableLocale
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
              if (validator.isEmail(user.email, { require_tld: false })) {
                await email.send(
                  this.buildMessage(
                    type,
                    payload,
                    user.email,
                    user.displayName,
                    user.settings?.locale as AvailableLocale
                  )
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
