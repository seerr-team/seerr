import { IssueStatus, IssueType } from '@server/constants/issue';
import { MediaStatus } from '@server/constants/media';
import { Notification } from '@server/lib/notifications';
import type { NotificationPayload } from '@server/lib/notifications/agents/agent';
import { TemplateEngine } from '@server/lib/notifications/templateEngine';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const makePayload = (
  overrides: Partial<NotificationPayload> = {}
): NotificationPayload =>
  ({
    subject: 'Test Subject',
    notifySystem: true,
    notifyAdmin: false,
    ...overrides,
  }) as unknown as NotificationPayload;

describe('TemplateEngine', () => {
  describe('render', () => {
    it('escapes free-text values piped through the json filter', () => {
      const payload = makePayload({
        subject: 'The "Best" Movie',
        message: 'line one\nline two with a backslash \\',
      });

      const rendered = TemplateEngine.render(
        '{ "subject": {{ subject | json }}, "message": {{ message | json }} }',
        payload,
        Notification.TEST_NOTIFICATION
      );

      const parsed = JSON.parse(rendered);
      assert.equal(parsed.subject, 'The "Best" Movie');
      assert.equal(parsed.message, 'line one\nline two with a backslash \\');
    });

    it('renders optional sections as null when the entity is absent', () => {
      const template =
        '{ "media": {% if media %}{ "tmdbId": "{{ media_tmdbid }}" }{% else %}null{% endif %} }';

      const absent = JSON.parse(
        TemplateEngine.render(
          template,
          makePayload(),
          Notification.MEDIA_PENDING
        )
      );
      assert.equal(absent.media, null);

      const present = JSON.parse(
        TemplateEngine.render(
          template,
          makePayload({ media: { tmdbId: 42 } as never }),
          Notification.MEDIA_PENDING
        )
      );
      assert.deepEqual(present.media, { tmdbId: '42' });
    });

    it('renders undefined variables as empty strings without throwing', () => {
      const rendered = TemplateEngine.render(
        '{ "known": {{ subject | json }}, "unknown": "{{ nonexistent_variable }}" }',
        makePayload({ subject: 'Known Value' }),
        Notification.TEST_NOTIFICATION
      );

      const parsed = JSON.parse(rendered);
      assert.equal(parsed.known, 'Known Value');
      assert.equal(parsed.unknown, '');
    });

    it('does not crash on circular references in the json filter', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      const rendered = TemplateEngine.render(
        '{{ extra | json }}',
        makePayload({ extra: circular as never }),
        Notification.TEST_NOTIFICATION
      );

      assert.equal(rendered, 'null');
    });
  });

  describe('buildContext', () => {
    it('maps the notification type to its enum name', () => {
      const context = TemplateEngine.buildContext(
        makePayload(),
        Notification.MEDIA_AUTO_APPROVED
      );

      assert.equal(context.notification_type, 'MEDIA_AUTO_APPROVED');
    });

    it('exposes media fields and converts status enums to names', () => {
      const context = TemplateEngine.buildContext(
        makePayload({
          media: {
            tmdbId: 603,
            tvdbId: 1234,
            imdbId: 'tt0133093',
            mediaType: 'movie',
            status: MediaStatus.AVAILABLE,
            status4k: MediaStatus.PENDING,
          } as never,
        }),
        Notification.MEDIA_AVAILABLE
      );

      assert.equal(context.media_tmdbid, 603);
      assert.equal(context.media_imdbid, 'tt0133093');
      assert.equal(context.media_type, 'movie');
      assert.equal(context.media_status, 'AVAILABLE');
      assert.equal(context.media_status4k, 'PENDING');
    });

    it('defaults absent scalar fields to empty strings', () => {
      const context = TemplateEngine.buildContext(
        makePayload(),
        Notification.TEST_NOTIFICATION
      );

      assert.equal(context.media_tmdbid, '');
      assert.equal(context.media_status, '');
      assert.equal(context.request_id, '');
      assert.equal(context.comment_message, '');
    });

    it('maps notifyuser_* to notifyUser only, without falling back to the requester', () => {
      const context = TemplateEngine.buildContext(
        makePayload({
          request: {
            id: 7,
            requestedBy: { displayName: 'Requester' },
          } as never,
        }),
        Notification.MEDIA_PENDING
      );

      // notifyUser is intentionally undefined for admin notifications; the
      // requester must not leak into notifyuser_* variables.
      assert.equal(context.notifyuser_username, '');
      assert.equal(context.requestedBy_username, 'Requester');
    });

    it('converts issue enums to names', () => {
      const context = TemplateEngine.buildContext(
        makePayload({
          issue: {
            id: 3,
            issueType: IssueType.VIDEO,
            status: IssueStatus.OPEN,
          } as never,
        }),
        Notification.ISSUE_CREATED
      );

      assert.equal(context.issue_type, 'VIDEO');
      assert.equal(context.issue_status, 'OPEN');
    });

    it('exposes full entity values as null when absent and the raw value when present', () => {
      const absent = TemplateEngine.buildContext(
        makePayload(),
        Notification.TEST_NOTIFICATION
      );
      assert.equal(absent.media, null);
      assert.equal(absent.request, null);
      assert.equal(absent.issue, null);
      assert.equal(absent.comment, null);
      assert.deepEqual(absent.extra, []);

      const media = { tmdbId: 1 } as never;
      const present = TemplateEngine.buildContext(
        makePayload({ media }),
        Notification.MEDIA_AVAILABLE
      );
      assert.equal(present.media, media);
    });
  });
});
