import { defineMessages, getIntl } from '@server/i18n';
import type { AvailableLocale } from '@server/types/languages';
import { Notification } from '.';
import type { NotificationPayload } from './agents/agent';

const messages = defineMessages('notifications.event', {
  approved:
    '{mediaType, select, movie {Movie Request Approved} series {Series Request Approved} other {Request Approved}}',
  approved4k:
    '{mediaType, select, movie {4K Movie Request Approved} series {4K Series Request Approved} other {4K Request Approved}}',
  autoApproved:
    '{mediaType, select, movie {Movie Request Automatically Approved} series {Series Request Automatically Approved} other {Request Automatically Approved}}',
  autoApproved4k:
    '{mediaType, select, movie {4K Movie Request Automatically Approved} series {4K Series Request Automatically Approved} other {4K Request Automatically Approved}}',
  autoRequested:
    '{mediaType, select, movie {Movie Request Automatically Submitted} series {Series Request Automatically Submitted} other {Request Automatically Submitted}}',
  autoRequested4k:
    '{mediaType, select, movie {4K Movie Request Automatically Submitted} series {4K Series Request Automatically Submitted} other {4K Request Automatically Submitted}}',
  available:
    '{mediaType, select, movie {Movie Now Available} series {Series Now Available} other {Now Available}}',
  available4k:
    '{mediaType, select, movie {4K Movie Now Available} series {4K Series Now Available} other {4K Now Available}}',
  declined:
    '{mediaType, select, movie {Movie Request Declined} series {Series Request Declined} other {Request Declined}}',
  declined4k:
    '{mediaType, select, movie {4K Movie Request Declined} series {4K Series Request Declined} other {4K Request Declined}}',
  failed:
    '{mediaType, select, movie {Movie Request Failed} series {Series Request Failed} other {Request Failed}}',
  failed4k:
    '{mediaType, select, movie {4K Movie Request Failed} series {4K Series Request Failed} other {4K Request Failed}}',
  pending:
    '{mediaType, select, movie {New Movie Request} series {New Series Request} other {New Request}}',
  pending4k:
    '{mediaType, select, movie {New 4K Movie Request} series {New 4K Series Request} other {New 4K Request}}',
});

/**
 * Formats a media request notification title for a given recipient locale.
 * Kept in one place so every agent renders the same title in the locale it
 * already resolves for the rest of the notification, instead of reusing a
 * title pre-formatted once in the server's default locale.
 */
export function formatNotificationEvent(
  type: Notification,
  mediaType: 'movie' | 'series',
  is4k: boolean,
  locale?: AvailableLocale
): string | undefined {
  const intl = getIntl(locale);

  switch (type) {
    case Notification.MEDIA_AVAILABLE:
      return intl.formatMessage(
        is4k ? messages.available4k : messages.available,
        {
          mediaType,
        }
      );
    case Notification.MEDIA_APPROVED:
      return intl.formatMessage(
        is4k ? messages.approved4k : messages.approved,
        {
          mediaType,
        }
      );
    case Notification.MEDIA_DECLINED:
      return intl.formatMessage(
        is4k ? messages.declined4k : messages.declined,
        {
          mediaType,
        }
      );
    case Notification.MEDIA_PENDING:
      return intl.formatMessage(is4k ? messages.pending4k : messages.pending, {
        mediaType,
      });
    case Notification.MEDIA_AUTO_REQUESTED:
      return intl.formatMessage(
        is4k ? messages.autoRequested4k : messages.autoRequested,
        { mediaType }
      );
    case Notification.MEDIA_AUTO_APPROVED:
      return intl.formatMessage(
        is4k ? messages.autoApproved4k : messages.autoApproved,
        { mediaType }
      );
    case Notification.MEDIA_FAILED:
      return intl.formatMessage(is4k ? messages.failed4k : messages.failed, {
        mediaType,
      });
    default:
      return undefined;
  }
}

/**
 * Resolves the notification title an agent should display: re-formats it in
 * the agent's own locale for media request notifications, or falls back to
 * the pre-formatted `event` (e.g. issue notifications, which have no
 * mediaType) for everything else.
 */
export function resolveNotificationEvent(
  type: Notification,
  payload: Pick<NotificationPayload, 'event' | 'mediaType' | 'is4k'>,
  locale?: AvailableLocale
): string | undefined {
  if (payload.mediaType) {
    return formatNotificationEvent(
      type,
      payload.mediaType,
      !!payload.is4k,
      locale
    );
  }

  return payload.event;
}
