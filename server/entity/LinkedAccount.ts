import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

@Index('IDX_linked_accounts_provider_sub', ['provider', 'sub'], {
  unique: true,
})
@Entity('linked_accounts')
export class LinkedAccount {
  constructor(options: Omit<LinkedAccount, 'id'>) {
    Object.assign(this, options);
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @ManyToOne(() => User, (user) => user.linkedAccounts, { onDelete: 'CASCADE' })
  user: User;

  /** Slug of the OIDC provider. */
  @Column({ type: 'varchar', length: 255 })
  provider: string;

  /** Unique ID from the OAuth provider */
  @Column({ type: 'varchar', length: 255 })
  sub: string;

  /** Account username from the OAuth provider */
  @Column()
  username: string;
}
