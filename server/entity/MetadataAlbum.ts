import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
class MetadataAlbum {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ unique: true })
  public mbAlbumId: string;

  @Column({ nullable: true, type: 'varchar' })
  public caaUrl: string | null;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<MetadataAlbum>) {
    Object.assign(this, init);
  }
}

export default MetadataAlbum;
