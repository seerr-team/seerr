import { IssueStatus, IssueType } from '@server/constants/issue';
import { MediaStatus } from '@server/constants/media';
import logger from '@server/logger';
import { Liquid } from 'liquidjs';
import { get } from 'lodash';
import type { NotificationPayload } from './agents/agent';
import { Notification } from './index';

/**
 * LiquidJS-based templating for notification agents. Note that Liquid does not
 * HTML-escape output, so characters such as apostrophes and quotes render
 * verbatim.
 */
export class TemplateEngine {
  private static engine: Liquid | undefined;

  private static getEngine(): Liquid {
    if (!this.engine) {
      const engine = new Liquid();

      // Make the `json` filter circular-safe: TypeORM entities can hold
      // circular relations (e.g. Media <-> Issue) that JSON.stringify rejects.
      engine.registerFilter('json', (value: unknown) => {
        try {
          return JSON.stringify(value);
        } catch (error) {
          logger.warn('Unable to serialize value in webhook json filter', {
            label: 'Notifications',
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          });
          return 'null';
        }
      });

      this.engine = engine;
    }

    return this.engine;
  }

  /**
   * Builds the template context: flat scalar variables for substitution, plus
   * the full `media`/`request`/`issue`/`comment`/`extra` values for
   * conditionals (e.g. `{% if media %}`).
   */
  static buildContext(
    payload: NotificationPayload,
    type: Notification
  ): Record<string, unknown> {
    return {
      notification_type: Notification[type],
      event: payload.event ?? '',
      subject: payload.subject ?? '',
      message: payload.message ?? '',
      image: payload.image ?? '',

      notifyuser_username: get(payload, 'notifyUser.displayName', ''),
      notifyuser_email: get(payload, 'notifyUser.email', ''),
      notifyuser_avatar: get(payload, 'notifyUser.avatar', ''),
      notifyuser_settings_discordIds: get(
        payload,
        'notifyUser.settings.discordIds',
        ''
      ),
      notifyuser_settings_telegramChatId: get(
        payload,
        'notifyUser.settings.telegramChatId',
        ''
      ),

      media_imdbid: get(payload, 'media.imdbId', ''),
      media_tmdbid: get(payload, 'media.tmdbId', ''),
      media_tvdbid: get(payload, 'media.tvdbId', ''),
      media_type: get(payload, 'media.mediaType', ''),
      media_jellyfinMediaId:
        payload.media?.jellyfinMediaId ??
        payload.media?.jellyfinMediaId4k ??
        '',
      media_status: payload.media ? MediaStatus[payload.media.status] : '',
      media_status4k: payload.media ? MediaStatus[payload.media.status4k] : '',
      media_plexRatingKey: payload.media?.ratingKey ?? '',
      media_plexRatingKey4k: payload.media?.ratingKey4k ?? '',

      request_id: get(payload, 'request.id', ''),
      requestedBy_jellyfinUserId: get(
        payload,
        'request.requestedBy.jellyfinUserId',
        ''
      ),
      requestedBy_username: get(payload, 'request.requestedBy.displayName', ''),
      requestedBy_email: get(payload, 'request.requestedBy.email', ''),
      requestedBy_avatar: get(payload, 'request.requestedBy.avatar', ''),
      requestedBy_settings_discordIds: get(
        payload,
        'request.requestedBy.settings.discordIds',
        ''
      ),
      requestedBy_settings_telegramChatId: get(
        payload,
        'request.requestedBy.settings.telegramChatId',
        ''
      ),

      issue_id: get(payload, 'issue.id', ''),
      issue_type: payload.issue ? IssueType[payload.issue.issueType] : '',
      issue_status: payload.issue ? IssueStatus[payload.issue.status] : '',
      reportedBy_username: get(payload, 'issue.createdBy.displayName', ''),
      reportedBy_email: get(payload, 'issue.createdBy.email', ''),
      reportedBy_avatar: get(payload, 'issue.createdBy.avatar', ''),
      reportedBy_settings_discordIds: get(
        payload,
        'issue.createdBy.settings.discordIds',
        ''
      ),
      reportedBy_settings_telegramChatId: get(
        payload,
        'issue.createdBy.settings.telegramChatId',
        ''
      ),

      comment_message: get(payload, 'comment.message', ''),
      commentedBy_username: get(payload, 'comment.user.displayName', ''),
      commentedBy_email: get(payload, 'comment.user.email', ''),
      commentedBy_avatar: get(payload, 'comment.user.avatar', ''),
      commentedBy_settings_discordIds: get(
        payload,
        'comment.user.settings.discordIds',
        ''
      ),
      commentedBy_settings_telegramChatId: get(
        payload,
        'comment.user.settings.telegramChatId',
        ''
      ),

      // Full values, exposed for conditionals and advanced templates
      extra: payload.extra ?? [],
      media: payload.media ?? null,
      request: payload.request ?? null,
      issue: payload.issue ?? null,
      comment: payload.comment ?? null,
    };
  }

  /**
   * Renders a Liquid template string against a notification payload.
   *
   * @throws if the template contains invalid Liquid syntax
   */
  static async render(
    template: string,
    payload: NotificationPayload,
    type: Notification
  ): Promise<string> {
    const context = this.buildContext(payload, type);
    // parseAndRender is typed `Promise<any>`; coerce to honor the `string` return.
    return String(await this.getEngine().parseAndRender(template, context));
  }
}
