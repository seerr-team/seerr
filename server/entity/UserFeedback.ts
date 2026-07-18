import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './User';
import { MediaType } from '../constants/media';
import { DbAwareColumn } from '../utils/DbColumnHelper';

@Entity('user_feedback')
@Unique(['userId', 'tmdbId', 'mediaType'])
export class UserFeedback {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column()
  tmdbId: number;

  @Column({ type: 'varchar' })
  mediaType: MediaType;

  @Column({ type: 'varchar' })
  feedbackType: 'like' | 'dislike' | 'seen';

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
