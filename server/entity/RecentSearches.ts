import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import type { RecentSearchesItem } from '@server/interfaces/api/discoverInterfaces';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ZodNumber, ZodOptional, ZodString } from 'zod';

export class DuplicateWatchlistRequestError extends Error {}
export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

@Entity()
export class RecentSearches implements RecentSearchesItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  public ratingKey = '';

  @Column({ type: 'varchar' })
  public mediaType: MediaType;

  @Column({ type: 'varchar' })
  title = '';

  @Column()
  @Index()
  public tmdbId: number;

  @ManyToOne(() => User, (user) => user.recentSearches, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public requestedBy: User;

  @ManyToOne(() => Media, (media) => media.recentSearches, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public media: Media;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<RecentSearches>) {
    Object.assign(this, init);
  }

  public static async createRecentSearches({
    recentSearchesRequest,
    user,
  }: {
    recentSearchesRequest: {
      mediaType: MediaType;
      ratingKey?: ZodOptional<ZodString>['_output'];
      title?: ZodOptional<ZodString>['_output'];
      tmdbId: ZodNumber['_output'];
    };
    user: User;
  }): Promise<RecentSearches> {
    const recentSearchesRepository = getRepository(this);
    const mediaRepository = getRepository(Media);
    const tmdb = new TheMovieDb();

    const tmdbMedia =
      recentSearchesRequest.mediaType === MediaType.MOVIE
        ? await tmdb.getMovie({ movieId: recentSearchesRequest.tmdbId })
        : await tmdb.getTvShow({ tvId: recentSearchesRequest.tmdbId });

    let media = await mediaRepository.findOne({
      where: {
        tmdbId: recentSearchesRequest.tmdbId,
        mediaType: recentSearchesRequest.mediaType,
      },
    });

    if (!media) {
      media = new Media({
        tmdbId: tmdbMedia.id,
        tvdbId: tmdbMedia.external_ids.tvdb_id,
        mediaType: recentSearchesRequest.mediaType,
      });
    }

    // Get the oldest existing entry to set our new entry before it
    const oldestEntry = await recentSearchesRepository.findOne({
      where: { requestedBy: { id: user.id } },
      order: { createdAt: 'ASC' },
    });

    const newCreatedAt = oldestEntry
      ? new Date(oldestEntry.createdAt.getTime() - 1)
      : new Date('1970-01-01');

    const recentSearches = new this({
      ...recentSearchesRequest,
      requestedBy: user,
      media,
      createdAt: newCreatedAt,
    });

    await mediaRepository.save(media);
    await recentSearchesRepository.save(recentSearches);
    return recentSearches;
  }

  public static async clearRecentSearches(
    user: User
  ): Promise<RecentSearches | null> {
    const recentSearchesRepository = getRepository(this);
    const recentSearches = await recentSearchesRepository.findOneBy({
      requestedBy: { id: user.id },
    });
    if (!recentSearches) {
      throw new NotFoundError('not Found');
    }

    if (recentSearches) {
      await recentSearchesRepository.clear();
    }

    return recentSearches;
  }
}
