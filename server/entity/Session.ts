import type { ISession } from 'connect-typeorm';
import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity()
export class Session implements ISession {
  @Index()
  @Column('bigint')
  public expiredAt = Date.now();

  @PrimaryColumn('varchar', { length: 255 })
  public id = '';

  @Column('text')
  public json = '';

  @DeleteDateColumn()
  public destroyedAt?: Date;
}
