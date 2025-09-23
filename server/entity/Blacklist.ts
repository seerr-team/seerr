import { MediaStatus, MediaType } from '@server/constants/media';
import dataSource from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import type { BlacklistItem } from '@server/interfaces/api/blacklistInterfaces';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import type { EntityManager } from 'typeorm';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { ZodNumber, ZodOptional, ZodString } from 'zod';

@Entity()
@Unique(['externalId', 'mediaType'])
export class Blacklist implements BlacklistItem {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar' })
  public mediaType: MediaType;

  @Column({ nullable: true, type: 'varchar' })
  title?: string;

  @Column()
  @Index()
  public externalId: number;

  @ManyToOne(() => User, (user) => user.id, {
    eager: true,
  })
  user?: User;

  @OneToOne(() => Media, (media) => media.blacklist, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  public media: Media;

  @Column({ nullable: true, type: 'varchar' })
  public blacklistedTags?: string;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  constructor(init?: Partial<Blacklist>) {
    Object.assign(this, init);
  }

  public static async addToBlacklist(
    {
      blacklistRequest,
    }: {
      blacklistRequest: {
        mediaType: MediaType;
        title?: ZodOptional<ZodString>['_output'];
        externalId: ZodNumber['_output'];
        blacklistedTags?: string;
      };
    },
    entityManager?: EntityManager
  ): Promise<void> {
    const em = entityManager ?? dataSource;
    const blacklist = new this({
      ...blacklistRequest,
    });

    const mediaRepository = em.getRepository(Media);

    const whereCondition =
      blacklistRequest.mediaType === MediaType.BOOK
        ? { hcId: blacklistRequest.externalId }
        : { tmdbId: blacklistRequest.externalId };

    let media = await mediaRepository.findOne({
      where: whereCondition,
    });

    const blacklistRepository = em.getRepository(this);

    await blacklistRepository.save(blacklist);

    if (!media) {
      media = new Media({
        status: MediaStatus.BLACKLISTED,
        statusAlt: MediaStatus.BLACKLISTED,
        mediaType: blacklistRequest.mediaType,
        blacklist: Promise.resolve(blacklist),
        ...(blacklistRequest.mediaType === MediaType.BOOK
          ? { hcId: blacklistRequest.externalId }
          : { tmdbId: blacklistRequest.externalId }),
      });

      await mediaRepository.save(media);
    } else {
      media.blacklist = Promise.resolve(blacklist);
      media.status = MediaStatus.BLACKLISTED;
      media.statusAlt = MediaStatus.BLACKLISTED;

      await mediaRepository.save(media);
    }
  }
}
