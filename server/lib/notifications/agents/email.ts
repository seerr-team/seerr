import { IssueType, IssueTypeName } from '@server/constants/issue';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import PreparedEmail from '@server/lib/email';
import type { NotificationAgentEmail } from '@server/lib/settings';
import { NotificationAgentKey, getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { EmailOptions } from 'email-templates';
import path from 'path';
import validator from 'validator';
import { Notification, shouldSendAdminNotification } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';



import { existsSync } from 'fs';


// --- email template locale routing (User > Global > EN fallback; requires template existence) ---
function __normalizeLocale(loc?: string) {
  const x = (loc || '').toLowerCase();
  if (!x) return '';
  // map de-DE -> de, en-US -> en, etc.
  return x.split(/[_-]/)[0] || '';
}

function __templateDirFor(templateName: string, userLocale?: string, globalLocale?: string) {
  const base = path.join(__dirname, '../../../templates/email');

  const tryLoc = (loc: string) => {
    // EN lives at base/<templateName>, localized at base/<loc>/<templateName>
    if (!loc || loc === 'en') return path.join(base, templateName);
    const candidate = path.join(base, loc, templateName);
    // Check html.pug existence as "template exists" signal
    if (existsSync(path.join(candidate, 'html.pug'))) return candidate;
    return '';
  };

  const u = __normalizeLocale(userLocale);
  const g = __normalizeLocale(globalLocale);

  return (
    tryLoc(u) ||
    tryLoc(g) ||
    path.join(base, templateName) // EN fallback
  );
}

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
    const { embedPoster } = settings.notifications.agents.email;

    if (type === Notification.TEST_NOTIFICATION) {
      return {
        template: __templateDirFor('test-email', recipientLocale, globalLocale),
        message: {
          to: recipientEmail,
        },
        locals: {
            // --- email template locals (ensure defined for templates) ---
            requestedBy:
              payload.request?.requestedBy?.displayName ??
              payload.user?.displayName ??
              payload.request?.requestedBy?.email ??
              '',
            commentUser:
              payload.comment?.user?.displayName ??
              payload.comment?.user?.email ??
              '',
            issueCreatedBy:
              payload.issue?.createdBy?.displayName ??
              payload.issue?.createdBy?.email ??
              '',
            issueModifiedBy:
              payload.issue?.modifiedBy?.displayName ??
              payload.issue?.modifiedBy?.email ??
              '',
            mediaName:
              payload.subject ??
              payload.media?.title ??
              '',
            mediaExtra: payload.extra ?? [],
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

          break;
        case Notification.MEDIA_AUTO_REQUESTED:

          break;
        case Notification.MEDIA_APPROVED:

          break;
        case Notification.MEDIA_AUTO_APPROVED:

          break;
        case Notification.MEDIA_AVAILABLE:

          break;
        case Notification.MEDIA_DECLINED:

          break;
        case Notification.MEDIA_FAILED:

          break;
      }

      return {
        template: __templateDirFor('media-request', recipientLocale, globalLocale),
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
          ? `${IssueTypeName[payload.issue.issueType].toLowerCase()} issue`
          : 'issue';

      let body = '';

      switch (type) {
        case Notification.ISSUE_CREATED:

          break;
        case Notification.ISSUE_COMMENT:

          break;
        case Notification.ISSUE_RESOLVED:

          break;
        case Notification.ISSUE_REOPENED:

          break;
      }

      return {
        template: __templateDirFor('media-issue', recipientLocale, globalLocale),
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
          if (
            validator.isEmail(payload.notifyUser.email, { require_tld: false })
          ) {
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
              if (validator.isEmail(user.email, { require_tld: false })) {
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
