import { User } from '@server/entity/User';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

export enum TraktOAuthTransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

@Entity('trakt_oauth_transaction')
export class TraktOAuthTransaction {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  public id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  public stateHash: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actorUserId' })
  public actorUser: User;

  @Column({ type: 'int' })
  public actorUserId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'targetUserId' })
  public targetUser?: User | null;

  @Column({ type: 'int', nullable: true })
  public targetUserId?: number | null;

  @Column({ type: 'varchar' })
  public origin: string;

  @Column({ type: 'varchar', default: TraktOAuthTransactionStatus.PENDING })
  public status: TraktOAuthTransactionStatus;

  @Column({ type: 'varchar', nullable: true })
  public resultCode?: string | null;

  @DbAwareColumn({ type: 'datetime' })
  public expiresAt: Date;

  @DbAwareColumn({ type: 'datetime', nullable: true })
  public consumedAt?: Date | null;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;
}
