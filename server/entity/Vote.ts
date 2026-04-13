import type { MediaType } from '@server/constants/media';
import { User } from '@server/entity/User';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum VoteActionType {
  INTERESTED = 'interested',
  NOT_INTERESTED = 'not_interested',
}

@Entity()
@Index(['user', 'tmdbId', 'mediaType'], { unique: true })
@Index(['tmdbId', 'mediaType'])
@Index(['user', 'createdAt'])
export class Vote {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => User, (user) => user.votes, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @Index()
  public user: User;

  @Column({ type: 'integer' })
  public tmdbId: number;

  @Column({ type: 'varchar' })
  public mediaType: MediaType;

  @Column({ type: 'varchar' })
  public actionType: VoteActionType;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<Vote>) {
    Object.assign(this, init);
  }
}
