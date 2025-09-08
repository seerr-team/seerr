import { MediaStatus } from '@server/constants/media';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
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
  public media: Promise<Media>;

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
