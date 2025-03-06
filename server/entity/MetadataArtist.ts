import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
class MetadataArtist {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ unique: true })
  public mbArtistId: string;

  @Column({ nullable: true, type: 'varchar' })
  public tmdbPersonId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public tmdbThumb: string | null;

  @Column({ nullable: true, type: 'datetime' })
  public tmdbUpdatedAt: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  public tadbThumb: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public tadbCover: string | null;

  @Column({ nullable: true, type: 'datetime' })
  public tadbUpdatedAt: Date | null;

  @CreateDateColumn()
  public createdAt: Date;

  constructor(init?: Partial<MetadataArtist>) {
    Object.assign(this, init);
  }
}

export default MetadataArtist;
