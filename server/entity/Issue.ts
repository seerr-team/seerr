import type { IssueType } from '@server/constants/issue';
import { IssueStatus } from '@server/constants/issue';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  AfterLoad,
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import IssueComment from './IssueComment';
import Media from './Media';
import { User } from './User';

@Entity()
class Issue {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'int' })
  public issueType: IssueType;

  @Column({ type: 'int', default: IssueStatus.OPEN })
  public status: IssueStatus;

  @Column({ type: 'int', default: 0 })
  public problemSeason: number;

  @Column({ type: 'int', default: 0 })
  public problemEpisode: number;

  @ManyToOne(() => Media, (media) => media.issues, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public media: Media;

  @ManyToOne(() => User, (user) => user.createdIssues, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public createdBy: User;

  @ManyToOne(() => User, {
    eager: true,
    onDelete: 'CASCADE',
    nullable: true,
  })
  public modifiedBy?: User;

  @OneToMany(() => IssueComment, (comment) => comment.issue, {
    cascade: true,
    eager: true,
  })
  public comments: IssueComment[];

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  @AfterLoad()
  sortComments() {
    this.comments?.sort((a, b) => a.id - b.id);
  }

  constructor(init?: Partial<Issue>) {
    Object.assign(this, init);
  }
}

export default Issue;
