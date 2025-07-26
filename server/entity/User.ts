import { MediaRequestStatus, MediaType } from '@server/constants/media';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { Watchlist } from '@server/entity/Watchlist';
import type { QuotaResponse } from '@server/interfaces/api/userInterfaces';
import PreparedEmail from '@server/lib/email';
import type { PermissionCheckOptions } from '@server/lib/permissions';
import { hasPermission, Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { AfterDate } from '@server/utils/dateHelpers';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import path from 'path';
import { default as generatePassword } from 'secure-random-password';
import {
  AfterLoad,
  Column,
  Entity,
  Not,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationCount,
} from 'typeorm';
import Issue from './Issue';
import { MediaRequest } from './MediaRequest';
import SeasonRequest from './SeasonRequest';
import { UserPushSubscription } from './UserPushSubscription';
import { UserSettings } from './UserSettings';

@Entity()
export class User {
  public static filterMany(
    users: User[],
    showFiltered?: boolean
  ): Partial<User>[] {
    return users.map((u) => u.filter(showFiltered));
  }

  static readonly filteredFields: string[] = ['email', 'plexId'];

  public displayName: string;

  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    unique: true,
    transformer: {
      from: (value: string): string => (value ?? '').toLowerCase(),
      to: (value: string): string => (value ?? '').toLowerCase(),
    },
  })
  public email: string;

  @Column({ type: 'varchar', nullable: true })
  public plexUsername?: string | null;

  @Column({ type: 'varchar', nullable: true })
  public jellyfinUsername?: string | null;

  @Column({ nullable: true })
  public username?: string;

  @Column({ nullable: true, select: false })
  public password?: string;

  @Column({ nullable: true, select: false })
  public resetPasswordGuid?: string;

  @Column({ type: 'date', nullable: true })
  public recoveryLinkExpirationDate?: Date | null;

  @Column({ type: 'integer', default: UserType.PLEX })
  public userType: UserType;

  @Column({ type: 'integer', nullable: true, select: true })
  public plexId?: number | null;

  @Column({ type: 'varchar', nullable: true })
  public jellyfinUserId?: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  public jellyfinDeviceId?: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  public jellyfinAuthToken?: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  public plexToken?: string | null;

  @Column({ type: 'varchar', nullable: true })
  public plexProfileId?: string | null;

  @Column({ type: 'integer', nullable: true })
  public plexProfileNumericId?: number | null;

  @Column({ type: 'boolean', default: false })
  public isPlexProfile?: boolean;

  @Column({ type: 'integer', nullable: true })
  public mainPlexUserId?: number | null;

  @Column({ type: 'integer', default: 0 })
  public permissions = 0;

  @Column()
  public avatar: string;

  @Column({ type: 'varchar', nullable: true })
  public avatarETag?: string | null;

  @Column({ type: 'varchar', nullable: true })
  public avatarVersion?: string | null;

  @RelationCount((user: User) => user.requests)
  public requestCount: number;

  @OneToMany(() => MediaRequest, (request) => request.requestedBy)
  public requests: MediaRequest[];

  @OneToMany(() => Watchlist, (watchlist) => watchlist.requestedBy)
  public watchlists: Watchlist[];

  @Column({ nullable: true })
  public movieQuotaLimit?: number;

  @Column({ nullable: true })
  public movieQuotaDays?: number;

  @Column({ nullable: true })
  public tvQuotaLimit?: number;

  @Column({ nullable: true })
  public tvQuotaDays?: number;

  @OneToOne(() => UserSettings, (settings) => settings.user, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  public settings?: UserSettings;

  @OneToMany(() => UserPushSubscription, (pushSub) => pushSub.user)
  public pushSubscriptions: UserPushSubscription[];

  @OneToMany(() => Issue, (issue) => issue.createdBy, { cascade: true })
  public createdIssues: Issue[];

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  public warnings: string[] = [];

  constructor(init?: Partial<User>) {
    Object.assign(this, init);
  }

  public filter(showFiltered?: boolean): Partial<User> {
    const filtered: Partial<User> = Object.assign(
      {},
      ...(Object.keys(this) as (keyof User)[])
        .filter((k) => showFiltered || !User.filteredFields.includes(k))
        .map((k) => ({ [k]: this[k] }))
    );

    return filtered;
  }

  public hasPermission(
    permissions: Permission | Permission[],
    options?: PermissionCheckOptions
  ): boolean {
    return !!hasPermission(permissions, this.permissions, options);
  }

  public passwordMatch(password: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.password) {
        resolve(bcrypt.compare(password, this.password));
      } else {
        return resolve(false);
      }
    });
  }

  public async setPassword(password: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(password, 12);
    this.password = hashedPassword;
  }

  public async generatePassword(): Promise<void> {
    const password = generatePassword.randomPassword({ length: 16 });
    this.setPassword(password);

    const { applicationTitle, applicationUrl } = getSettings().main;
    try {
      logger.info(`Sending generated password email for ${this.email}`, {
        label: 'User Management',
      });

      const email = new PreparedEmail(getSettings().notifications.agents.email);
      await email.send({
        template: path.join(__dirname, '../templates/email/generatedpassword'),
        message: {
          to: this.email,
        },
        locals: {
          password: password,
          applicationUrl,
          applicationTitle,
          recipientName: this.username,
        },
      });
    } catch (e) {
      logger.error('Failed to send out generated password email', {
        label: 'User Management',
        message: e.message,
      });
    }
  }

  public async resetPassword(): Promise<void> {
    const guid = randomUUID();
    this.resetPasswordGuid = guid;

    // 24 hours into the future
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    this.recoveryLinkExpirationDate = targetDate;

    const { applicationTitle, applicationUrl } = getSettings().main;
    const resetPasswordLink = `${applicationUrl}/resetpassword/${guid}`;

    try {
      logger.info(`Sending reset password email for ${this.email}`, {
        label: 'User Management',
      });
      const email = new PreparedEmail(getSettings().notifications.agents.email);
      await email.send({
        template: path.join(__dirname, '../templates/email/resetpassword'),
        message: {
          to: this.email,
        },
        locals: {
          resetPasswordLink,
          applicationUrl,
          applicationTitle,
          recipientName: this.displayName,
          recipientEmail: this.email,
        },
      });
    } catch (e) {
      logger.error('Failed to send out reset password email', {
        label: 'User Management',
        message: e.message,
      });
    }
  }

  @AfterLoad()
  public setDisplayName(): void {
    this.displayName =
      this.username || this.plexUsername || this.jellyfinUsername || this.email;
  }

  public async getQuota(): Promise<QuotaResponse> {
    const {
      main: { defaultQuotas },
    } = getSettings();
    const requestRepository = getRepository(MediaRequest);
    const canBypass = this.hasPermission([Permission.MANAGE_USERS], {
      type: 'or',
    });

    const movieQuotaLimit = !canBypass
      ? this.movieQuotaLimit ?? defaultQuotas.movie.quotaLimit
      : 0;
    const movieQuotaDays = this.movieQuotaDays ?? defaultQuotas.movie.quotaDays;

    // Count movie requests made during quota period
    const movieDate = new Date();
    if (movieQuotaDays) {
      movieDate.setDate(movieDate.getDate() - movieQuotaDays);
    }

    const movieQuotaUsed = movieQuotaLimit
      ? await requestRepository.count({
          where: {
            requestedBy: {
              id: this.id,
            },
            createdAt: AfterDate(movieDate),
            type: MediaType.MOVIE,
            status: Not(MediaRequestStatus.DECLINED),
          },
        })
      : 0;

    const tvQuotaLimit = !canBypass
      ? this.tvQuotaLimit ?? defaultQuotas.tv.quotaLimit
      : 0;
    const tvQuotaDays = this.tvQuotaDays ?? defaultQuotas.tv.quotaDays;

    // Count tv season requests made during quota period
    const tvDate = new Date();
    if (tvQuotaDays) {
      tvDate.setDate(tvDate.getDate() - tvQuotaDays);
    }
    const tvQuotaStartDate = tvDate.toJSON();
    const tvQuotaUsed = tvQuotaLimit
      ? (
          await requestRepository
            .createQueryBuilder('request')
            .leftJoin('request.seasons', 'seasons')
            .leftJoin('request.requestedBy', 'requestedBy')
            .where('request.type = :requestType', {
              requestType: MediaType.TV,
            })
            .andWhere('requestedBy.id = :userId', {
              userId: this.id,
            })
            .andWhere('request.createdAt > :date', {
              date: tvQuotaStartDate,
            })
            .andWhere('request.status != :declinedStatus', {
              declinedStatus: MediaRequestStatus.DECLINED,
            })
            .addSelect((subQuery) => {
              return subQuery
                .select('COUNT(season.id)', 'seasonCount')
                .from(SeasonRequest, 'season')
                .leftJoin('season.request', 'parentRequest')
                .where('parentRequest.id = request.id');
            }, 'seasonCount')
            .getMany()
        ).reduce((sum: number, req: MediaRequest) => sum + req.seasonCount, 0)
      : 0;

    return {
      movie: {
        days: movieQuotaDays,
        limit: movieQuotaLimit,
        used: movieQuotaUsed,
        remaining: movieQuotaLimit
          ? Math.max(0, movieQuotaLimit - movieQuotaUsed)
          : undefined,
        restricted:
          movieQuotaLimit && movieQuotaLimit - movieQuotaUsed <= 0
            ? true
            : false,
      },
      tv: {
        days: tvQuotaDays,
        limit: tvQuotaLimit,
        used: tvQuotaUsed,
        remaining: tvQuotaLimit
          ? Math.max(0, tvQuotaLimit - tvQuotaUsed)
          : undefined,
        restricted:
          tvQuotaLimit && tvQuotaLimit - tvQuotaUsed <= 0 ? true : false,
      },
    };
  }
}
