import { MediaType } from '@server/constants/media';
import type { NotificationPayload } from './agents/agent';
import { Notification } from './index';

export interface TemplateVariable {
  key: string;
  name: string;
  description: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    key: 'user_name',
    name: 'User Name',
    description: 'Display name of the user who made the request',
    example: 'John Doe',
  },
  {
    key: 'user_email',
    name: 'User Email',
    description: 'Email address of the user who made the request',
    example: 'john@example.com',
  },
  {
    key: 'media_name',
    name: 'Media Title',
    description: 'Title of the requested movie or TV show',
    example: 'The Matrix',
  },
  {
    key: 'media_type',
    name: 'Media Type',
    description: 'Type of media (Movie or TV Show)',
    example: 'Movie',
  },
  {
    key: 'media_year',
    name: 'Release Year',
    description: 'Release year of the media',
    example: '1999',
  },
  {
    key: 'request_date',
    name: 'Request Date',
    description: 'Date when the request was made',
    example: 'January 15, 2025',
  },
  {
    key: 'request_status',
    name: 'Request Status',
    description: 'Current status of the request',
    example: 'Approved',
  },
  {
    key: 'application_title',
    name: 'Application Name',
    description: 'Name of your Jellyseerr instance',
    example: 'Jellyseerr',
  },
  {
    key: 'application_url',
    name: 'Application URL',
    description: 'URL to your Jellyseerr instance',
    example: 'https://jellyseerr.example.com',
  },
  {
    key: 'media_poster_url',
    name: 'Poster Image URL',
    description: 'URL to the media poster image',
    example: 'https://image.tmdb.org/poster.jpg',
  },
  {
    key: 'recipient_name',
    name: 'Recipient Name',
    description: 'Name of the email recipient',
    example: 'Jane Doe',
  },
  {
    key: 'recipient_email',
    name: 'Recipient Email',
    description: 'Email address of the recipient',
    example: 'jane@example.com',
  },
  {
    key: 'is_4k',
    name: '4K Request',
    description: 'Whether this is a 4K quality request (Yes/No)',
    example: 'Yes',
  },
  {
    key: 'request_id',
    name: 'Request ID',
    description: 'Unique identifier for the request',
    example: '1234',
  },
  {
    key: 'media_overview',
    name: 'Media Description',
    description: 'Plot summary or description of the media',
    example:
      'A computer hacker learns from mysterious rebels about the true nature of his reality.',
  },
  {
    key: 'current_date',
    name: 'Current Date',
    description: 'Current date when the email is sent',
    example: 'January 15, 2025',
  },
  {
    key: 'user_request_count',
    name: 'User Request Count',
    description: 'Total number of requests made by this user',
    example: '15',
  },
  {
    key: 'days_pending',
    name: 'Days Pending',
    description:
      'Number of days the request has been pending (for pending notifications)',
    example: '3',
  },
  {
    key: 'season_count',
    name: 'Season Count',
    description: 'Number of seasons requested (for TV shows)',
    example: '2',
  },
  {
    key: 'tmdb_id',
    name: 'TMDB ID',
    description: 'The Movie Database ID for the media',
    example: '603',
  },
  {
    key: 'imdb_id',
    name: 'IMDb ID',
    description: 'Internet Movie Database ID for the media',
    example: 'tt0133093',
  },
  {
    key: 'request_url',
    name: 'Request URL',
    description: 'Direct link to view the requested media details',
    example: 'https://jellyseerr.dev/movie/603',
  },
];

export class TemplateEngine {
  private static getStatusText(type: Notification): string {
    switch (type) {
      case Notification.MEDIA_PENDING:
        return 'Pending Approval';
      case Notification.MEDIA_AUTO_REQUESTED:
        return 'Auto-Requested';
      case Notification.MEDIA_APPROVED:
        return 'Approved';
      case Notification.MEDIA_AUTO_APPROVED:
        return 'Auto-Approved';
      case Notification.MEDIA_AVAILABLE:
        return 'Available';
      case Notification.MEDIA_DECLINED:
        return 'Declined';
      case Notification.MEDIA_FAILED:
        return 'Failed';
      default:
        return 'Unknown';
    }
  }

  public static renderTemplate(
    template: string,
    type: Notification,
    payload: NotificationPayload,
    recipientEmail?: string,
    recipientName?: string,
    applicationUrl?: string,
    applicationTitle?: string
  ): string {
    const mediaType =
      payload.media?.mediaType === MediaType.MOVIE ? 'Movie' : 'TV Show';

    const releaseYear = '';

    const requestDate = payload.request?.createdAt
      ? new Date(payload.request.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

    // Calculate days pending for pending notifications
    const daysPending =
      payload.request?.createdAt && type === Notification.MEDIA_PENDING
        ? Math.floor(
            (Date.now() - new Date(payload.request.createdAt).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const requestUrl =
      applicationUrl && payload.media
        ? `${applicationUrl}/${
            payload.media.mediaType === MediaType.MOVIE ? 'movie' : 'tv'
          }/${payload.media.tmdbId}`
        : '';

    const variables = {
      user_name: payload.request?.requestedBy.displayName || '',
      user_email: payload.request?.requestedBy.email || '',
      media_name: payload.subject || '',
      media_type: mediaType,
      media_year: releaseYear,
      request_date: requestDate,
      request_status: this.getStatusText(type),
      application_title: applicationTitle || 'Jellyseerr',
      application_url: applicationUrl || '',
      media_poster_url: payload.image || '',
      recipient_name: recipientName || '',
      recipient_email: recipientEmail || '',
      is_4k: payload.request?.is4k ? 'Yes' : 'No',
      request_id: payload.request?.id?.toString() || '',
      media_overview: payload.message || '',
      current_date: currentDate,
      user_request_count:
        payload.request?.requestedBy.requestCount?.toString() || '',
      days_pending: daysPending.toString(),
      season_count: payload.request?.seasonCount?.toString() || '',
      tmdb_id: payload.media?.tmdbId?.toString() || '',
      imdb_id: payload.media?.imdbId || '',
      request_url: requestUrl,
    };

    let rendered = template;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(regex, value);
    });

    // Handle simple conditionals for 4K
    rendered = rendered.replace(
      /\{\{#is_4k\}\}(.+?)\{\{\/is_4k\}\}/g,
      variables.is_4k === 'Yes' ? '$1' : ''
    );

    return rendered;
  }

  public static getDefaultSubjectTemplate(type: Notification): string {
    switch (type) {
      case Notification.MEDIA_PENDING:
        return '[{{application_title}}] New {{media_type}} Request: {{media_name}}';
      case Notification.MEDIA_AUTO_REQUESTED:
        return '[{{application_title}}] {{media_type}} Auto-Requested: {{media_name}}';
      case Notification.MEDIA_APPROVED:
        return '[{{application_title}}] {{media_type}} Request Approved: {{media_name}}';
      case Notification.MEDIA_AUTO_APPROVED:
        return '[{{application_title}}] {{media_type}} Auto-Approved: {{media_name}}';
      case Notification.MEDIA_AVAILABLE:
        return '[{{application_title}}] {{media_type}} Now Available: {{media_name}}';
      case Notification.MEDIA_DECLINED:
        return '[{{application_title}}] {{media_type}} Request Declined: {{media_name}}';
      case Notification.MEDIA_FAILED:
        return '[{{application_title}}] {{media_type}} Request Failed: {{media_name}}';
      case Notification.TEST_NOTIFICATION:
        return '[{{application_title}}] Test Email Notification';
      case Notification.ISSUE_CREATED:
        return '[{{application_title}}] New Issue Report: {{media_name}}';
      case Notification.ISSUE_COMMENT:
        return '[{{application_title}}] New Comment on Issue: {{media_name}}';
      case Notification.ISSUE_RESOLVED:
        return '[{{application_title}}] Issue Resolved: {{media_name}}';
      case Notification.ISSUE_REOPENED:
        return '[{{application_title}}] Issue Reopened: {{media_name}}';
      default:
        return '[{{application_title}}] {{media_name}}';
    }
  }
}
