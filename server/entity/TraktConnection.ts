import { User } from '@server/entity/User';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TraktConnectionStatus {
  ACTIVE = 'active',
  RECONNECT_REQUIRED = 'reconnect_required',
}

@Entity('trakt_connection')
@Check(
  'CHK_trakt_connection_active_tokens',
  `"status" != 'active' OR ("accessToken" IS NOT NULL AND "refreshToken" IS NOT NULL AND "expiresAt" IS NOT NULL)`
)
export class TraktConnection {
  @PrimaryGeneratedColumn()
  public id: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  public user: User;

  @Column({ unique: true })
  public userId: number;

  @Column({ type: 'varchar', unique: true })
  public traktUserId: string;

  @Column({ type: 'varchar', nullable: true })
  public username?: string | null;

  @Column({ type: 'varchar', nullable: true })
  public slug?: string | null;

  @Column({ type: 'varchar', nullable: true })
  public displayName?: string | null;

  @Column({ type: 'varchar', default: TraktConnectionStatus.ACTIVE })
  public status: TraktConnectionStatus;

  @Column({ type: 'text', nullable: true, select: false })
  public accessToken?: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  public refreshToken?: string | null;

  @DbAwareColumn({ type: 'datetime', nullable: true })
  public expiresAt?: Date | null;

  @Column({ type: 'int', default: 1 })
  public tokenVersion: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'connectedByUserId' })
  public connectedByUser?: User | null;

  @Column({ type: 'int', nullable: true })
  public connectedByUserId?: number | null;

  @DbAwareColumn({ type: 'datetime', nullable: true })
  public lastValidatedAt?: Date | null;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;
}
