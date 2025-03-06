import CoverArtArchive from '@server/api/coverartarchive';
import ListenBrainzAPI from '@server/api/listenbrainz';
import TheMovieDb from '@server/api/themoviedb';
import { IssueStatus, IssueType, IssueTypeName } from '@server/constants/issue';
import { MediaType } from '@server/constants/media';
import Issue from '@server/entity/Issue';
import notificationManager, { Notification } from '@server/lib/notifications';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { sortBy } from 'lodash';
import type {
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { EventSubscriber } from 'typeorm';

@EventSubscriber()
export class IssueSubscriber implements EntitySubscriberInterface<Issue> {
  public listenTo(): typeof Issue {
    return Issue;
  }

  private async sendIssueNotification(entity: Issue, type: Notification) {
    let title = '';
    let image = '';
    const tmdb = new TheMovieDb();
    const listenbrainz = new ListenBrainzAPI();
    const coverArt = CoverArtArchive.getInstance();

    try {
      if (entity.media.mediaType === MediaType.MOVIE) {
        const movie = await tmdb.getMovie({ movieId: entity.media.tmdbId });

        title = `${movie.title}${
          movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ''
        }`;
        image = `https://image.tmdb.org/t/p/w600_and_h900_bestv2${movie.poster_path}`;
      } else if (entity.media.mediaType === MediaType.TV) {
        const tvshow = await tmdb.getTvShow({ tvId: entity.media.tmdbId });

        title = `${tvshow.name}${
          tvshow.first_air_date ? ` (${tvshow.first_air_date.slice(0, 4)})` : ''
        }`;
        image = `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tvshow.poster_path}`;
      } else if (
        entity.media.mediaType === MediaType.MUSIC &&
        entity.media.mbId
      ) {
        const album = await listenbrainz.getAlbum(entity.media.mbId);
        const coverArtResponse = await coverArt.getCoverArt(entity.media.mbId);

        title = `${album.release_group_metadata.release_group.name} by ${album.release_group_metadata.artist.name}`;
        image = coverArtResponse.images[0]?.thumbnails?.['250'] ?? '';
      }

      const [firstComment] = sortBy(entity.comments, 'id');
      const extra: { name: string; value: string }[] = [];

      if (entity.media.mediaType === MediaType.TV && entity.problemSeason > 0) {
        extra.push({
          name: 'Affected Season',
          value: entity.problemSeason.toString(),
        });

        if (entity.problemEpisode > 0) {
          extra.push({
            name: 'Affected Episode',
            value: entity.problemEpisode.toString(),
          });
        }
      }

      notificationManager.sendNotification(type, {
        event:
          type === Notification.ISSUE_CREATED
            ? `New ${
                entity.issueType !== IssueType.OTHER
                  ? `${IssueTypeName[entity.issueType]} `
                  : ''
              }Issue Reported`
            : type === Notification.ISSUE_RESOLVED
            ? `${
                entity.issueType !== IssueType.OTHER
                  ? `${IssueTypeName[entity.issueType]} `
                  : ''
              }Issue Resolved`
            : `${
                entity.issueType !== IssueType.OTHER
                  ? `${IssueTypeName[entity.issueType]} `
                  : ''
              }Issue Reopened`,
        subject: title,
        message: firstComment.message,
        issue: entity,
        media: entity.media,
        image,
        extra,
        notifyAdmin: true,
        notifySystem: true,
        notifyUser:
          !entity.createdBy.hasPermission(Permission.MANAGE_ISSUES) &&
          entity.modifiedBy?.id !== entity.createdBy.id &&
          (type === Notification.ISSUE_RESOLVED ||
            type === Notification.ISSUE_REOPENED)
            ? entity.createdBy
            : undefined,
      });
    } catch (e) {
      logger.error('Something went wrong sending issue notification(s)', {
        label: 'Notifications',
        errorMessage: e.message,
        issueId: entity.id,
      });
    }
  }

  public afterInsert(event: InsertEvent<Issue>): void {
    if (!event.entity) {
      return;
    }

    this.sendIssueNotification(event.entity, Notification.ISSUE_CREATED);
  }

  public beforeUpdate(event: UpdateEvent<Issue>): void {
    if (!event.entity) {
      return;
    }

    if (
      event.entity.status === IssueStatus.RESOLVED &&
      event.databaseEntity.status !== IssueStatus.RESOLVED
    ) {
      this.sendIssueNotification(
        event.entity as Issue,
        Notification.ISSUE_RESOLVED
      );
    } else if (
      event.entity.status === IssueStatus.OPEN &&
      event.databaseEntity.status !== IssueStatus.OPEN
    ) {
      this.sendIssueNotification(
        event.entity as Issue,
        Notification.ISSUE_REOPENED
      );
    }
  }
}
