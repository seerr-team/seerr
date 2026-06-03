import { MediaStatus, type MediaType } from '@server/constants/media';
import dataSource from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import type { BlocklistItem } from '@server/interfaces/api/blocklistInterfaces';
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
@Unique(['tmdbId', 'mediaType'])
export class Blocklist implements BlocklistItem {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar' })
  public mediaType: MediaType;

  @Column({ nullable: true, type: 'varchar' })
  title?: string;

  @Column()
  @Index()
  public tmdbId: number;

  @ManyToOne(() => User, (user) => user.id, {
    eager: true,
  })
  @Index()
  user?: User;

  @OneToOne(() => Media, (media) => media.blocklist, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  public media: Media;

  @Column({ nullable: true, type: 'varchar' })
  public blocklistedTags?: string;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  constructor(init?: Partial<Blocklist>) {
    Object.assign(this, init);
  }

  public static async addToBlocklist(
    {
      blocklistRequest,
    }: {
      blocklistRequest: {
        mediaType: MediaType;
        title?: ZodOptional<ZodString>['_output'];
        tmdbId: ZodNumber['_output'];
        blocklistedTags?: string;
      };
    },
    entityManager?: EntityManager
  ): Promise<void> {
    const em = entityManager ?? dataSource;
    const blocklist = new this({
      ...blocklistRequest,
    });

    const mediaRepository = em.getRepository(Media);
    let media = await mediaRepository.findOne({
      where: {
        tmdbId: blocklistRequest.tmdbId,
        mediaType: blocklistRequest.mediaType,
      },
    });

    const blocklistRepository = em.getRepository(this);

    await blocklistRepository.save(blocklist);

    if (!media) {
      media = new Media({
        tmdbId: blocklistRequest.tmdbId,
        status: MediaStatus.BLOCKLISTED,
        status4k: MediaStatus.BLOCKLISTED,
        mediaType: blocklistRequest.mediaType,
        blocklist: Promise.resolve(blocklist),
      });

      await mediaRepository.save(media);
    } else {
      media.blocklist = Promise.resolve(blocklist);
      media.status = MediaStatus.BLOCKLISTED;
      media.status4k = MediaStatus.BLOCKLISTED;

      await mediaRepository.save(media);
    }
  }
}
