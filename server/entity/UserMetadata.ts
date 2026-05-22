import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class UserMetadata {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  key: string;

  @Column()
  value: string;

  @Column({ default: false })
  isSensitive: boolean;

  @ManyToOne(() => User, (user) => user.metadata, { onDelete: 'CASCADE' })
  user: User;
}
