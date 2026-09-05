import { WatchlistSyncEntry } from '@server/entity/WatchlistSyncEntry';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity()
@Unique('UNIQUE_WATCHLIST_SYNC_ENTRY_SEASON', ['entry', 'seasonNumber'])
export class WatchlistSyncEntrySeason {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public seasonNumber: number;

  @ManyToOne(() => WatchlistSyncEntry, (entry) => entry.seasons, {
    onDelete: 'CASCADE',
    nullable: false,
    orphanedRowAction: 'delete',
  })
  @Index()
  public entry: WatchlistSyncEntry;

  constructor(init?: Partial<WatchlistSyncEntrySeason>) {
    Object.assign(this, init);
  }
}
