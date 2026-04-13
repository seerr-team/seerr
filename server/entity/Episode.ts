import { MediaStatus } from '@server/constants/media';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import Season from './Season';

/**
 * Tracks the availability status of individual TV episodes.
 * Each episode belongs to a Season and records whether it is available
 * in standard and/or 4K quality. This entity enables per-episode
 * notifications rather than waiting for an entire season to complete.
 *
 * Originally introduced in PR #1671 by 0xSysR3ll.
 */
@Entity()
@Unique(['season', 'episodeNumber'])
class Episode {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public episodeNumber: number;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status: MediaStatus;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status4k: MediaStatus;

  @Index()
  @ManyToOne(() => Season, (season: Season) => season.episodes, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  public season?: Promise<Season>;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<Episode>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export default Episode;
