import { MediaStatus } from '@server/constants/media';
import type { DownloadingItem } from '@server/lib/downloadtracker';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Media from './Media';

@Entity()
@Index(['mediaId', 'serviceId'], { unique: true })
class MediaServiceStatus {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  @Index()
  public mediaId: number;

  @ManyToOne(() => Media, (media) => media.serviceStatuses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'mediaId' })
  public media: Media;

  @Column({ type: 'int' })
  @Index()
  public serviceId: number;

  @Column({ type: 'varchar' })
  public serviceType: 'radarr' | 'sonarr';

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status: MediaStatus;

  @Column({ nullable: true, type: 'int' })
  public externalServiceId: number | null;

  @Column({ nullable: true, type: 'varchar' })
  public externalServiceSlug: string | null;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      from: (value: string | null): Record<number, MediaStatus> | null => {
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      },
      to: (value: Record<number, MediaStatus> | null): string | null => {
        if (!value || Object.keys(value).length === 0) return null;
        return JSON.stringify(value);
      },
    },
  })
  public seasonStatuses: Record<number, MediaStatus> | null;

  public downloadStatus?: DownloadingItem[] = [];

  constructor(init?: Partial<MediaServiceStatus>) {
    Object.assign(this, init);
  }
}

export default MediaServiceStatus;
