import type { MediaType } from '@server/constants/media';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

@Entity('ai_recommendation')
@Index(['userId', 'mediaType'])
@Index(['createdAt'])
export class AiRecommendation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @Column()
  tmdbId: number;

  @Column({ type: 'varchar' })
  mediaType: MediaType;

  @Column({ type: 'int', nullable: true })
  tvdbId: number | null;

  @Column({ type: 'float', nullable: true })
  score: number | null;

  @Column({ type: 'text', nullable: true })
  rationale: string | null;

  @DbAwareColumn({ type: 'simple-json', nullable: true })
  metadata: {
    source: 'ai' | 'tmdb' | 'hybrid';
    keywords?: string[];
    genres?: string[];
    relatedTitles?: number[];
    modelUsed: string;
    generatedAt: string;
  } | null;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User | null;
}
