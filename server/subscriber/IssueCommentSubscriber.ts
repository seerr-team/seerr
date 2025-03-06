import CoverArtArchive from '@server/api/coverartarchive';
import ListenBrainzAPI from '@server/api/listenbrainz';
import TheMovieDb from '@server/api/themoviedb';
import { IssueType, IssueTypeName } from '@server/constants/issue';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import IssueComment from '@server/entity/IssueComment';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import notificationManager, { Notification } from '@server/lib/notifications';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { sortBy } from 'lodash';
import type { EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { EventSubscriber } from 'typeorm';

@EventSubscriber()
export class IssueCommentSubscriber
  implements EntitySubscriberInterface<IssueComment>
{
  public listenTo(): typeof IssueComment {
    return IssueComment;
  }

  private async sendIssueCommentNotification(entity: IssueComment) {
    let title = '';
    let image = '';
    const tmdb = new TheMovieDb();
    const listenbrainz = new ListenBrainzAPI();
    const coverArt = CoverArtArchive.getInstance();

    try {
      const issue = (
        await getRepository(IssueComment).findOneOrFail({
          where: { id: entity.id },
          relations: { issue: true },
        })
      ).issue;

      const createdBy = await getRepository(User).findOneOrFail({
        where: { id: issue.createdBy.id },
      });

      const media = await getRepository(Media).findOneOrFail({
        where: { id: issue.media.id },
      });

      if (media.mediaType === MediaType.MOVIE) {
        const movie = await tmdb.getMovie({ movieId: media.tmdbId });

        title = `${movie.title}${
          movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ''
        }`;
        image = `https://image.tmdb.org/t/p/w600_and_h900_bestv2${movie.poster_path}`;
      } else if (media.mediaType === MediaType.TV) {
        const tvshow = await tmdb.getTvShow({ tvId: media.tmdbId });

        title = `${tvshow.name}${
          tvshow.first_air_date ? ` (${tvshow.first_air_date.slice(0, 4)})` : ''
        }`;
        image = `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tvshow.poster_path}`;
      } else if (media.mediaType === MediaType.MUSIC && media.mbId) {
        const album = await listenbrainz.getAlbum(media.mbId);
        const coverArtResponse = await coverArt.getCoverArt(media.mbId);

        title = `${album.release_group_metadata.release_group.name} by ${album.release_group_metadata.artist.name}`;
        image = coverArtResponse.images[0]?.thumbnails?.['250'] ?? '';
      }

      const [firstComment] = sortBy(issue.comments, 'id');

      if (entity.id !== firstComment.id) {
        // Send notifications to all issue managers
        notificationManager.sendNotification(Notification.ISSUE_COMMENT, {
          event: `New Comment on ${
            issue.issueType !== IssueType.OTHER
              ? `${IssueTypeName[issue.issueType]} `
              : ''
          }Issue`,
          subject: title,
          message: firstComment.message,
          comment: entity,
          issue,
          media,
          image,
          notifyAdmin: true,
          notifySystem: true,
          notifyUser:
            !createdBy.hasPermission(Permission.MANAGE_ISSUES) &&
            createdBy.id !== entity.user.id
              ? createdBy
              : undefined,
        });
      }
    } catch (e) {
      logger.error(
        'Something went wrong sending issue comment notification(s)',
        {
          label: 'Notifications',
          errorMessage: e.message,
          commentId: entity.id,
        }
      );
    }
  }

  public afterInsert(event: InsertEvent<IssueComment>): void {
    if (!event.entity) {
      return;
    }

    this.sendIssueCommentNotification(event.entity);
  }
}
