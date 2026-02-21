import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
class RoutingRule {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar' })
  public name: string;

  @Column({ type: 'varchar' })
  public serviceType: 'radarr' | 'sonarr';

  @Column({ default: false })
  public is4k: boolean;

  @Column({ type: 'int', default: 0 })
  public priority: number;

  @Column({ nullable: true })
  public users?: string;

  @Column({ nullable: true })
  public genres?: string;

  @Column({ nullable: true })
  public languages?: string;

  @Column({ nullable: true })
  public keywords?: string;

  @Column({ type: 'int' })
  public targetServiceId: number;

  @Column({ type: 'int', nullable: true })
  public activeProfileId?: number;

  @Column({ nullable: true })
  public rootFolder?: string;

  @Column({ nullable: true })
  public seriesType?: string;

  @Column({ nullable: true })
  public tags?: string;

  @Column({ type: 'varchar', nullable: true })
  public minimumAvailability?: 'announced' | 'inCinemas' | 'released';

  @Column({ default: false })
  public isFallback: boolean;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<RoutingRule>) {
    Object.assign(this, init);
  }
}

export default RoutingRule;
