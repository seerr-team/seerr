import Hardcover from '@server/api/hardcover';
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
    let title: string;
    let image: string;
    const tmdb = new TheMovieDb();
    const hardcover = new Hardcover();

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
        if (!media.hasTmdbId()) {
          throw new Error('TMDB ID is missing for this media!');
        }
        const movie = await tmdb.getMovie({ movieId: media.tmdbId });

        title = `${movie.title}${
          movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ''
        }`;
        image = `https://image.tmdb.org/t/p/w600_and_h900_bestv2${movie.poster_path}`;
      } else if (media.mediaType === MediaType.BOOK) {
        if (!media.hcId) {
          throw new Error('Hardcover ID is missing for this media!');
        }
        const book = await hardcover.getBook(media.hcId);

        title = `${book.title}${
          book.release_date ? ` (${book.release_date.slice(0, 4)})` : ''
        }`;
        image = book.image?.url
          ? book.image.url
          : `https://assets.hardcover.app/static/covers/cover${
              (media.hcId % 9) + 1
            }.png`;
      } else {
        if (!media.hasTmdbId()) {
          throw new Error('TMDB ID is missing for this media!');
        }
        const tvshow = await tmdb.getTvShow({ tvId: media.tmdbId });

        title = `${tvshow.name}${
          tvshow.first_air_date ? ` (${tvshow.first_air_date.slice(0, 4)})` : ''
        }`;
        image = `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tvshow.poster_path}`;
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
