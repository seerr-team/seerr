import { IssueStatus, IssueType } from '@server/constants/issue';
import { MediaStatus } from '@server/constants/media';
import Handlebars from 'handlebars';
import { get } from 'lodash';
import type { NotificationPayload } from './agents/agent';
import { Notification } from './index';

/**
 * TemplateEngine provides Handlebars-based templating for notification agents.
 * Supports variable substitution, conditionals, loops, and custom helpers.
 */
export class TemplateEngine {
  private static helpersRegistered = false;

  /**
   * Registers custom Handlebars helpers for use in templates.
   * This is called automatically on first render.
   */
  private static registerHelpers(): void {
    if (this.helpersRegistered) {
      return;
    }

    // Comparison helpers for conditionals
    // Usage: {{#if (eq status "PENDING")}}...{{/if}}
    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b); // Equal to
    Handlebars.registerHelper('ne', (a: unknown, b: unknown) => a !== b); // Not equal to
    Handlebars.registerHelper('lt', (a: unknown, b: unknown) => {
      return (a as number) < (b as number); // Less than
    });
    Handlebars.registerHelper('gt', (a: unknown, b: unknown) => {
      return (a as number) > (b as number); // Greater than
    });
    Handlebars.registerHelper('lte', (a: unknown, b: unknown) => {
      return (a as number) <= (b as number); // Less than or equal to
    });
    Handlebars.registerHelper('gte', (a: unknown, b: unknown) => {
      return (a as number) >= (b as number); // Greater than or equal to
    });

    // Logical helpers for combining conditions
    // Usage: {{#if (and media request)}}...{{/if}}
    Handlebars.registerHelper('and', (a: unknown, b: unknown) => a && b); // Logical AND
    Handlebars.registerHelper('or', (a: unknown, b: unknown) => a || b); // Logical OR

    // String formatting helpers
    // Capitalizes first letter, rest lowercase
    // Usage: {{capitalize user_name}} -> "John"
    Handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // Converts string to uppercase
    // Usage: {{upper media_type}} -> "MOVIE"
    Handlebars.registerHelper('upper', (str: string) => {
      if (!str) return '';
      return str.toUpperCase();
    });

    // Converts string to lowercase
    // Usage: {{lower notifyuser_email}} -> "user@example.com"
    Handlebars.registerHelper('lower', (str: string) => {
      if (!str) return '';
      return str.toLowerCase();
    });

    // Truncates a string to specified length with ellipsis
    // Usage: {{truncate subject 50}} -> "Very long movie title that gets cut off..."
    Handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (!str) return '';
      if (str.length <= length) return str;
      return str.substring(0, length) + '...';
    });

    // Converts objects/arrays to JSON strings
    // Usage: {{json extra}} -> "[{\"name\":\"key\",\"value\":\"val\"}]"
    Handlebars.registerHelper('json', (obj: unknown) => {
      return JSON.stringify(obj);
    });

    // Provides default value if variable is undefined/null/empty
    // Usage: {{default notifyuser_username "Unknown User"}} -> "Unknown User"
    Handlebars.registerHelper(
      'default',
      (value: unknown, defaultValue: unknown) => {
        return value ?? defaultValue;
      }
    );

    this.helpersRegistered = true;
  }

  /**
   * Builds template context from notification payload.
   * Extracts all variables and converts enums to human-readable strings.
   */
  static buildContext(
    payload: NotificationPayload,
    type: Notification
  ): Record<string, unknown> {
    // For auto-approved/auto-requested, use the requesting user as the notify user
    const effectiveNotifyUser =
      payload.notifyUser || payload.request?.requestedBy;

    const context: Record<string, unknown> = {
      // Basic notification fields
      notification_type: Notification[type],
      event: payload.event ?? '',
      subject: payload.subject ?? '',
      message: payload.message ?? '',
      image: payload.image ?? '',

      // Notify user fields
      notifyuser_username: get(effectiveNotifyUser, 'displayName', ''),
      notifyuser_email: get(effectiveNotifyUser, 'email', ''),
      notifyuser_avatar: get(effectiveNotifyUser, 'avatar', ''),
      notifyuser_settings_discordId: get(
        effectiveNotifyUser,
        'settings.discordId',
        ''
      ),
      notifyuser_settings_telegramChatId: get(
        effectiveNotifyUser,
        'settings.telegramChatId',
        ''
      ),

      // Media fields
      media_tmdbid: get(payload, 'media.tmdbId', ''),
      media_tvdbid: get(payload, 'media.tvdbId', ''),
      media_type: get(payload, 'media.mediaType', ''),
      media_status: payload.media ? MediaStatus[payload.media.status] : '',
      media_status4k: payload.media ? MediaStatus[payload.media.status4k] : '',

      // Request fields
      request_id: get(payload, 'request.id', ''),
      requestedBy_username: get(payload, 'request.requestedBy.displayName', ''),
      requestedBy_email: get(payload, 'request.requestedBy.email', ''),
      requestedBy_avatar: get(payload, 'request.requestedBy.avatar', ''),
      requestedBy_settings_discordId: get(
        payload,
        'request.requestedBy.settings.discordId',
        ''
      ),
      requestedBy_settings_telegramChatId: get(
        payload,
        'request.requestedBy.settings.telegramChatId',
        ''
      ),

      // Issue fields
      issue_id: get(payload, 'issue.id', ''),
      issue_type: payload.issue ? IssueType[payload.issue.issueType] : '',
      issue_status: payload.issue ? IssueStatus[payload.issue.status] : '',
      reportedBy_username: get(payload, 'issue.createdBy.displayName', ''),
      reportedBy_email: get(payload, 'issue.createdBy.email', ''),
      reportedBy_avatar: get(payload, 'issue.createdBy.avatar', ''),
      reportedBy_settings_discordId: get(
        payload,
        'issue.createdBy.settings.discordId',
        ''
      ),
      reportedBy_settings_telegramChatId: get(
        payload,
        'issue.createdBy.settings.telegramChatId',
        ''
      ),

      // Comment fields
      comment_message: get(payload, 'comment.message', ''),
      commentedBy_username: get(payload, 'comment.user.displayName', ''),
      commentedBy_email: get(payload, 'comment.user.email', ''),
      commentedBy_avatar: get(payload, 'comment.user.avatar', ''),
      commentedBy_settings_discordId: get(
        payload,
        'comment.user.settings.discordId',
        ''
      ),
      commentedBy_settings_telegramChatId: get(
        payload,
        'comment.user.settings.telegramChatId',
        ''
      ),

      // Include full objects for advanced template usage
      extra: payload.extra ?? [],
      media: payload.media ?? null,
      request: payload.request ?? null,
      issue: payload.issue ?? null,
      comment: payload.comment ?? null,
    };

    return context;
  }

  /**
   * Renders a template string with the given payload data.
   *
   * @param template - Handlebars template string
   * @param payload - Notification payload data
   * @param type - Notification type
   * @returns Rendered template string
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.render(
   *   'New {{notification_type}}: {{subject}}',
   *   payload,
   *   Notification.MEDIA_PENDING
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Using conditionals
   * const result = TemplateEngine.render(
   *   '{{#if media}}Media ID: {{media_tmdbid}}{{/if}}',
   *   payload,
   *   type
   * );
   * ```
   */
  static render(
    template: string,
    payload: NotificationPayload,
    type: Notification
  ): string {
    this.registerHelpers();

    try {
      const context = this.buildContext(payload, type);
      // Compile template without HTML escaping (noEscape: true)
      const compiledTemplate = Handlebars.compile(template, { noEscape: true });
      return compiledTemplate(context);
    } catch (error) {
      throw new Error(
        `Template rendering failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}
