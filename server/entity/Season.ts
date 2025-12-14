import { MediaStatus } from '@server/constants/media';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Episode from './Episode';
import Media from './Media';

@Entity()
class Season {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public seasonNumber: number;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status: MediaStatus;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status4k: MediaStatus;

  @ManyToOne(() => Media, (media) => media.seasons, {
    onDelete: 'CASCADE',
  })
  @Index()
  public media: Promise<Media>;

  @OneToMany(() => Episode, (episode) => episode.season, {
    cascade: true,
  })
  public episodes?: Episode[];

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<Season>) {
    Object.assign(this, init);
  }
}

export default Season;
