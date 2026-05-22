import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './User';

@Entity()
@Unique(['user', 'key'])
export class UserMetadata {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  key: string;

  @Column()
  value: string;

  @Column({ default: false })
  isSensitive: boolean;

  @ManyToOne(() => User, (user) => user.metadata, { onDelete: 'CASCADE' })
  user: User;
}
