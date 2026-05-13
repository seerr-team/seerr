import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { NotFoundError } from '@server/entity/Watchlist';
import logger from '@server/logger';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { ZodNumber, ZodOptional, ZodString } from 'zod';

export class DuplicateFavoriteError extends Error {}

@Entity()
@Unique('UNIQUE_USER_FAVORITES', ['tmdbId', 'mediaType', 'requestedBy'])
export class Favorites {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  public mediaType: MediaType;

  @Column({ type: 'varchar' })
  title = '';

  @Column()
  @Index()
  public tmdbId: number;

  @ManyToOne(() => User, (user) => user.favorites, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @Index()
  public requestedBy: User;

  @ManyToOne(() => Media, (media) => media.favorites, {
    eager: true,
    nullable: true,
    onDelete: 'CASCADE',
  })
  @Index()
  public media: Media;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<Favorites>) {
    Object.assign(this, init);
  }

  public static async createFavorite({
    favoriteRequest,
    user,
  }: {
    favoriteRequest: {
      mediaType: MediaType;
      title?: ZodOptional<ZodString>['_output'];
      tmdbId: ZodNumber['_output'];
    };
    user: User;
  }): Promise<Favorites> {
    const favoritesRepository = getRepository(this);
    const mediaRepository = getRepository(Media);
    const tmdb = new TheMovieDb();

    const tmdbMedia =
      favoriteRequest.mediaType === MediaType.MOVIE
        ? await tmdb.getMovie({ movieId: favoriteRequest.tmdbId })
        : await tmdb.getTvShow({ tvId: favoriteRequest.tmdbId });

    const existing = await favoritesRepository
      .createQueryBuilder('favorites')
      .leftJoinAndSelect('favorites.requestedBy', 'user')
      .where('user.id = :userId', { userId: user.id })
      .andWhere('favorites.tmdbId = :tmdbId', {
        tmdbId: favoriteRequest.tmdbId,
      })
      .andWhere('favorites.mediaType = :mediaType', {
        mediaType: favoriteRequest.mediaType,
      })
      .getMany();

    if (existing && existing.length > 0) {
      logger.warn('Duplicate request for favorites blocked', {
        tmdbId: favoriteRequest.tmdbId,
        mediaType: favoriteRequest.mediaType,
        label: 'Favorites',
      });

      throw new DuplicateFavoriteError();
    }

    let media = await mediaRepository.findOne({
      where: {
        tmdbId: favoriteRequest.tmdbId,
        mediaType: favoriteRequest.mediaType,
      },
    });

    if (!media) {
      media = new Media({
        tmdbId: tmdbMedia.id,
        tvdbId: tmdbMedia.external_ids.tvdb_id,
        mediaType: favoriteRequest.mediaType,
      });
    }

    const favorite = new this({
      ...favoriteRequest,
      requestedBy: user,
      media,
    });

    await mediaRepository.save(media);
    await favoritesRepository.save(favorite);
    return favorite;
  }

  public static async deleteFavorite(
    tmdbId: Favorites['tmdbId'],
    mediaType: MediaType,
    user: User
  ): Promise<Favorites | null> {
    const favoritesRepository = getRepository(this);
    const favorite = await favoritesRepository.findOneBy({
      tmdbId,
      mediaType,
      requestedBy: { id: user.id },
    });
    if (!favorite) {
      throw new NotFoundError('not Found');
    }

    if (favorite) {
      await favoritesRepository.delete(favorite.id);
    }

    return favorite;
  }
}
