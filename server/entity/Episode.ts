import { MediaStatus } from '@server/constants/media';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import Season from './Season';

@Entity()
class Episode {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public episodeNumber: number;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status: MediaStatus;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status4k: MediaStatus;

  @ManyToOne(() => Season, (season: Season) => season.episodes, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  public season?: Promise<Season>;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<Episode>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export default Episode;
