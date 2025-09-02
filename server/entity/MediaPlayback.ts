import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class MediaPlayback {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => Media, (media) => media.requests, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public media: Media;

  @ManyToOne(() => User, (user) => user.requests, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public playedBy: User;

  @DbAwareColumn({ type: 'datetime' })
  public playedAt: Date;
}
