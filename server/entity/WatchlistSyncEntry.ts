import type { MediaType } from '@server/constants/media';
import { User } from '@server/entity/User';
import { WatchlistSyncEntrySeason } from '@server/entity/WatchlistSyncEntrySeason';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Unique('UNIQUE_WATCHLIST_SYNC_ENTRY', ['requestedBy', 'tmdbId', 'mediaType'])
export class WatchlistSyncEntry {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  @Index()
  public tmdbId: number;

  @Column({ type: 'varchar' })
  public mediaType: MediaType;

  // Unix seconds, verbatim from Plex.
  @Column({ type: 'int' })
  public watchlistedAt: number;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @Index()
  public requestedBy: User;

  @OneToMany(() => WatchlistSyncEntrySeason, (season) => season.entry, {
    cascade: true,
    eager: true,
  })
  public seasons: WatchlistSyncEntrySeason[];

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<WatchlistSyncEntry>) {
    Object.assign(this, init);
  }
}
