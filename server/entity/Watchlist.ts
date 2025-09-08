import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import type { WatchlistItem } from '@server/interfaces/api/discoverInterfaces';
import logger from '@server/logger';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
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
@Unique('UNIQUE_USER_DB', ['tmdbId', 'requestedBy'])
export class Watchlist implements WatchlistItem {
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

  @ManyToOne(() => User, (user) => user.watchlists, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public requestedBy: User;

  @ManyToOne(() => Media, (media) => media.watchlists, {
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

  constructor(init?: Partial<Watchlist>) {
    Object.assign(this, init);
  }

  public static async createWatchlist({
    watchlistRequest,
    user,
  }: {
    watchlistRequest: {
      mediaType: MediaType;
      ratingKey?: ZodOptional<ZodString>['_output'];
      title?: ZodOptional<ZodString>['_output'];
      tmdbId: ZodNumber['_output'];
    };
    user: User;
  }): Promise<Watchlist> {
    const watchlistRepository = getRepository(this);
    const mediaRepository = getRepository(Media);
    const tmdb = new TheMovieDb();

    const tmdbMedia =
      watchlistRequest.mediaType === MediaType.MOVIE
        ? await tmdb.getMovie({ movieId: watchlistRequest.tmdbId })
        : await tmdb.getTvShow({ tvId: watchlistRequest.tmdbId });

    const existing = await watchlistRepository
      .createQueryBuilder('watchlist')
      .leftJoinAndSelect('watchlist.requestedBy', 'user')
      .where('user.id = :userId', { userId: user.id })
      .andWhere('watchlist.tmdbId = :tmdbId', {
        tmdbId: watchlistRequest.tmdbId,
      })
      .andWhere('watchlist.mediaType = :mediaType', {
        mediaType: watchlistRequest.mediaType,
      })
      .getMany();

    if (existing && existing.length > 0) {
      logger.warn('Duplicate request for watchlist blocked', {
        tmdbId: watchlistRequest.tmdbId,
        mediaType: watchlistRequest.mediaType,
        label: 'Watchlist',
      });

      throw new DuplicateWatchlistRequestError();
    }

    let media = await mediaRepository.findOne({
      where: {
        tmdbId: watchlistRequest.tmdbId,
        mediaType: watchlistRequest.mediaType,
      },
    });

    if (!media) {
      media = new Media({
        tmdbId: tmdbMedia.id,
        tvdbId: tmdbMedia.external_ids.tvdb_id,
        mediaType: watchlistRequest.mediaType,
      });
    }

    const watchlist = new this({
      ...watchlistRequest,
      requestedBy: user,
      media,
    });

    await mediaRepository.save(media);
    await watchlistRepository.save(watchlist);
    return watchlist;
  }

  public static async deleteWatchlist(
    tmdbId: Watchlist['tmdbId'],
    user: User
  ): Promise<Watchlist | null> {
    const watchlistRepository = getRepository(this);
    const watchlist = await watchlistRepository.findOneBy({
      tmdbId,
      requestedBy: { id: user.id },
    });
    if (!watchlist) {
      throw new NotFoundError('not Found');
    }

    if (watchlist) {
      await watchlistRepository.delete(watchlist.id);
    }

    return watchlist;
  }
}
