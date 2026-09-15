import { IssueType, IssueTypeName } from '@server/constants/issue';
import { MediaType } from '@server/constants/media';
import { defineMessages, getIntl } from '@server/i18n';
import type { AvailableLocale } from '@server/types/languages';

const eventMessages = defineMessages('notifications.events', {
  mediaNowAvailable: '{quality}{mediaType} Now Available',
  mediaRequestNowAvailable: '{quality}{mediaType} Request Now Available',
  mediaRequestApproved: '{quality}{mediaType} Request Approved',
  mediaRequestDeclined: '{quality}{mediaType} Request Declined',
  newMediaRequest: 'New {quality}{mediaType} Request',
  mediaRequestAutoSubmitted:
    '{quality}{mediaType} Request Automatically Submitted',
  mediaRequestAutoApproved:
    '{quality}{mediaType} Request Automatically Approved',
  mediaRequestFailed: '{quality}{mediaType} Request Failed',
  newIssueReported: 'New {issueType} Reported',
  issueResolved: '{issueType} Resolved',
  issueReopened: '{issueType} Reopened',
  newIssueComment: 'New Comment on {issueType}',
  movie: 'Movie',
  series: 'Series',
  issue: 'Issue',
  issueTypeName: '{type} Issue',
});

/**
 * Describes the event line of a notification in a locale-agnostic way.
 *
 * Producers only record which message applies and the raw values it needs, so
 * that every agent can render the line in its own recipient's language.
 */
export interface NotificationEventMessage {
  descriptor: { id: string; defaultMessage: string };
  is4k?: boolean;
  mediaType?: MediaType;
  issueType?: IssueType;
}

export const formatEvent = (
  eventMessage: NotificationEventMessage | undefined,
  locale?: AvailableLocale
): string | undefined => {
  if (!eventMessage) {
    return undefined;
  }

  const intl = getIntl(locale);

  return intl.formatMessage(eventMessage.descriptor, {
    quality: eventMessage.is4k ? '4K ' : '',
    mediaType:
      eventMessage.mediaType === MediaType.MOVIE
        ? intl.formatMessage(eventMessages.movie)
        : intl.formatMessage(eventMessages.series),
    issueType:
      eventMessage.issueType && eventMessage.issueType !== IssueType.OTHER
        ? intl.formatMessage(eventMessages.issueTypeName, {
            type: IssueTypeName[eventMessage.issueType],
          })
        : intl.formatMessage(eventMessages.issue),
  });
};

export default eventMessages;
