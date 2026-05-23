import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ExternalProviderAuthType {
  NONE = 'none',
  API_KEY = 'apiKey',
  BEARER = 'bearer',
}

export enum ExternalProviderIdType {
  TMDB = 'tmdb',
  TVDB = 'tvdb',
  MIXED = 'mixed',
}

export enum ExternalProviderMediaType {
  MOVIE = 'movie',
  TV = 'tv',
  MIXED = 'mixed',
}

@Entity()
class ExternalProvider {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public name: string;

  @Column()
  public url: string;

  @Column({
    type: 'varchar',
    default: ExternalProviderAuthType.NONE,
  })
  public authType: ExternalProviderAuthType;

  @Column({ nullable: true })
  public apiKey?: string;

  @Column({ nullable: true })
  public apiKeyHeader?: string;

  @Column({ nullable: true })
  public bearerToken?: string;

  @Column({ type: 'int', default: 60 })
  public cacheMinutes: number;

  @Column({
    type: 'varchar',
    default: ExternalProviderIdType.TMDB,
  })
  public idType: ExternalProviderIdType;

  @Column({
    type: 'varchar',
    default: ExternalProviderMediaType.MIXED,
  })
  public mediaType: ExternalProviderMediaType;

  @Column({ nullable: true })
  public itemsPath?: string;

  @Column({ nullable: true })
  public tmdbIdPath?: string;

  @Column({ nullable: true })
  public tvdbIdPath?: string;

  @Column({ nullable: true })
  public mediaTypePath?: string;

  @Column({ nullable: true })
  public defaultMediaType?: string;

  @Column({ default: true })
  public enabled: boolean;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<ExternalProvider>) {
    Object.assign(this, init);
  }
}

export default ExternalProvider;
