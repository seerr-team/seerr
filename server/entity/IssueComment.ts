import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import Issue from './Issue';
import { User } from './User';

@Entity()
class IssueComment {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => User, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public user: User;

  @ManyToOne(() => Issue, (issue) => issue.comments, {
    onDelete: 'CASCADE',
  })
  public issue: Issue;

  @Column({ type: 'text' })
  public message: string;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<IssueComment>) {
    Object.assign(this, init);
  }
}

export default IssueComment;
