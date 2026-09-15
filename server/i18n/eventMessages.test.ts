import { IssueType } from '@server/constants/issue';
import { MediaType } from '@server/constants/media';
import { initI18n } from '@server/i18n';
import type { NotificationEventMessage } from '@server/i18n/eventMessages';
import eventMessages, { formatEvent } from '@server/i18n/eventMessages';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

describe('formatEvent', () => {
  before(() => {
    initI18n();
  });

  // The webhook payload has always exposed these exact English strings, so they
  // must survive the move to translatable messages.
  const englishCases: [string, NotificationEventMessage][] = [
    [
      'Movie Now Available',
      {
        descriptor: eventMessages.mediaNowAvailable,
        mediaType: MediaType.MOVIE,
      },
    ],
    [
      '4K Series Now Available',
      {
        descriptor: eventMessages.mediaNowAvailable,
        mediaType: MediaType.TV,
        is4k: true,
      },
    ],
    [
      'Series Request Now Available',
      {
        descriptor: eventMessages.mediaRequestNowAvailable,
        mediaType: MediaType.TV,
      },
    ],
    [
      'Movie Request Approved',
      {
        descriptor: eventMessages.mediaRequestApproved,
        mediaType: MediaType.MOVIE,
      },
    ],
    [
      '4K Movie Request Declined',
      {
        descriptor: eventMessages.mediaRequestDeclined,
        mediaType: MediaType.MOVIE,
        is4k: true,
      },
    ],
    [
      'New 4K Movie Request',
      {
        descriptor: eventMessages.newMediaRequest,
        mediaType: MediaType.MOVIE,
        is4k: true,
      },
    ],
    [
      'Series Request Automatically Submitted',
      {
        descriptor: eventMessages.mediaRequestAutoSubmitted,
        mediaType: MediaType.TV,
      },
    ],
    [
      'Movie Request Automatically Approved',
      {
        descriptor: eventMessages.mediaRequestAutoApproved,
        mediaType: MediaType.MOVIE,
      },
    ],
    [
      'Series Request Failed',
      { descriptor: eventMessages.mediaRequestFailed, mediaType: MediaType.TV },
    ],
    [
      'New Video Issue Reported',
      {
        descriptor: eventMessages.newIssueReported,
        issueType: IssueType.VIDEO,
      },
    ],
    [
      'New Issue Reported',
      {
        descriptor: eventMessages.newIssueReported,
        issueType: IssueType.OTHER,
      },
    ],
    [
      'Subtitle Issue Resolved',
      {
        descriptor: eventMessages.issueResolved,
        issueType: IssueType.SUBTITLES,
      },
    ],
    [
      'Issue Reopened',
      { descriptor: eventMessages.issueReopened, issueType: IssueType.OTHER },
    ],
    [
      'New Comment on Audio Issue',
      {
        descriptor: eventMessages.newIssueComment,
        issueType: IssueType.AUDIO,
      },
    ],
  ];

  for (const [expected, eventMessage] of englishCases) {
    it(`renders "${expected}" in English`, () => {
      assert.equal(formatEvent(eventMessage, 'en'), expected);
    });
  }

  it('returns undefined when there is no event message', () => {
    assert.equal(formatEvent(undefined, 'en'), undefined);
  });

  it('falls back to English while a locale is still untranslated', () => {
    // Weblate fills the other locales in after the strings land in en.json
    const event = formatEvent(
      {
        descriptor: eventMessages.newMediaRequest,
        mediaType: MediaType.MOVIE,
      },
      'fr'
    );

    assert.equal(event, 'New Movie Request');
  });
});
