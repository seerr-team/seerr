import type { MediaType } from '@server/constants/media';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './User';

@Entity('ai_recommendation')
@Index(['userId', 'mediaType'])
@Index(['updatedAt'])
@Unique(['userId', 'tmdbId', 'mediaType'])
export class AiRecommendation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

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
