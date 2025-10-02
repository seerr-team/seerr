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
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import path from 'path';
import { default as generatePassword } from 'secure-random-password';
import {
  AfterLoad,
  Column,
  Entity,
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

  @Column({ nullable: true })
  public combinedQuotaLimit?: number;

  @Column({ nullable: true })
  public combinedQuotaDays?: number;

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

    const hasValue = (value?: number | null): boolean =>
      value !== null && value !== undefined;

    const userCombinedConfigured =
      hasValue(this.combinedQuotaLimit) || hasValue(this.combinedQuotaDays);
    const userSplitConfigured =
      hasValue(this.movieQuotaLimit) ||
      hasValue(this.movieQuotaDays) ||
      hasValue(this.tvQuotaLimit) ||
      hasValue(this.tvQuotaDays);
    const globalCombinedConfigured =
      hasValue(defaultQuotas.combined?.quotaLimit) ||
      hasValue(defaultQuotas.combined?.quotaDays);

    const mode = userCombinedConfigured
      ? 'combined'
      : userSplitConfigured
      ? 'split'
      : globalCombinedConfigured
      ? 'combined'
      : 'split';

    const effectiveMovieLimit =
      this.movieQuotaLimit ?? defaultQuotas.movie.quotaLimit;
    const effectiveMovieDays =
      this.movieQuotaDays ?? defaultQuotas.movie.quotaDays;
    const effectiveTvLimit = this.tvQuotaLimit ?? defaultQuotas.tv.quotaLimit;
    const effectiveTvDays = this.tvQuotaDays ?? defaultQuotas.tv.quotaDays;
    const effectiveCombinedLimit = userCombinedConfigured
      ? this.combinedQuotaLimit
      : defaultQuotas.combined?.quotaLimit;
    const effectiveCombinedDays = userCombinedConfigured
      ? this.combinedQuotaDays
      : defaultQuotas.combined?.quotaDays;

    const movieQuotaLimit =
      !canBypass && mode === 'split' ? effectiveMovieLimit ?? 0 : 0;
    const movieQuotaDays =
      mode === 'split' ? effectiveMovieDays : defaultQuotas.movie.quotaDays;

    const tvQuotaLimit =
      !canBypass && mode === 'split' ? effectiveTvLimit ?? 0 : 0;
    const tvQuotaDays =
      mode === 'split' ? effectiveTvDays : defaultQuotas.tv.quotaDays;

    const combinedQuotaLimit =
      !canBypass && mode === 'combined' ? effectiveCombinedLimit ?? 0 : 0;
    const combinedQuotaDays =
      mode === 'combined' ? effectiveCombinedDays : undefined;

    const buildDateIsoString = (days?: number | null): string | undefined => {
      if (!days) {
        return undefined;
      }

      const date = new Date();
      date.setDate(date.getDate() - days);
      return date.toJSON();
    };

    const fetchMovieUsage = async (dateIso?: string): Promise<number> => {
      const query = requestRepository
        .createQueryBuilder('request')
        .leftJoin('request.requestedBy', 'requestedBy')
        .where('requestedBy.id = :userId', {
          userId: this.id,
        })
        .andWhere('request.type = :requestType', {
          requestType: MediaType.MOVIE,
        })
        .andWhere('request.status != :declinedStatus', {
          declinedStatus: MediaRequestStatus.DECLINED,
        });

      if (dateIso) {
        query.andWhere('request.createdAt > :movieDate', {
          movieDate: dateIso,
        });
      }

      return query.getCount();
    };

    const fetchTvUsage = async (dateIso?: string): Promise<number> => {
      const query = requestRepository
        .createQueryBuilder('request')
        .leftJoin('request.seasons', 'seasons')
        .leftJoin('request.requestedBy', 'requestedBy')
        .where('request.type = :requestType', {
          requestType: MediaType.TV,
        })
        .andWhere('requestedBy.id = :userId', {
          userId: this.id,
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
        }, 'seasonCount');

      if (dateIso) {
        query.andWhere('request.createdAt > :tvDate', {
          tvDate: dateIso,
        });
      }

      const requests = await query.getMany();

      return requests.reduce(
        (sum: number, req: MediaRequest) => sum + req.seasonCount,
        0
      );
    };

    let movieQuotaUsed = 0;
    if (mode === 'split' && movieQuotaLimit) {
      movieQuotaUsed = await fetchMovieUsage(
        buildDateIsoString(movieQuotaDays)
      );
    }

    let tvQuotaUsed = 0;
    if (mode === 'split' && tvQuotaLimit) {
      tvQuotaUsed = await fetchTvUsage(buildDateIsoString(tvQuotaDays));
    }

    let combinedQuotaUsed = 0;
    let combinedRemaining: number | undefined;
    let combinedRestricted = false;

    if (mode === 'combined' && combinedQuotaLimit) {
      const combinedDateIso = buildDateIsoString(combinedQuotaDays ?? null);

      const [combinedMovieUsage, combinedTvUsage] = await Promise.all([
        fetchMovieUsage(combinedDateIso),
        fetchTvUsage(combinedDateIso),
      ]);

      combinedQuotaUsed = combinedMovieUsage + combinedTvUsage;
      combinedRemaining = Math.max(0, combinedQuotaLimit - combinedQuotaUsed);
      combinedRestricted = combinedQuotaLimit - combinedQuotaUsed <= 0;

      // Update per-type usage for downstream consumers when split fields are disabled.
      movieQuotaUsed = combinedMovieUsage;
      tvQuotaUsed = combinedTvUsage;
    }

    return {
      mode,
      movie: {
        days: mode === 'split' ? movieQuotaDays : undefined,
        limit: mode === 'split' ? movieQuotaLimit : undefined,
        used: mode === 'split' ? movieQuotaUsed : 0,
        remaining:
          mode === 'split' && movieQuotaLimit
            ? Math.max(0, movieQuotaLimit - movieQuotaUsed)
            : undefined,
        restricted:
          mode === 'split' && movieQuotaLimit
            ? movieQuotaLimit - movieQuotaUsed <= 0
            : false,
      },
      tv: {
        days: mode === 'split' ? tvQuotaDays : undefined,
        limit: mode === 'split' ? tvQuotaLimit : undefined,
        used: mode === 'split' ? tvQuotaUsed : 0,
        remaining:
          mode === 'split' && tvQuotaLimit
            ? Math.max(0, tvQuotaLimit - tvQuotaUsed)
            : undefined,
        restricted:
          mode === 'split' && tvQuotaLimit
            ? tvQuotaLimit - tvQuotaUsed <= 0
            : false,
      },
      combined: {
        days: mode === 'combined' ? combinedQuotaDays ?? undefined : undefined,
        limit: mode === 'combined' ? combinedQuotaLimit : undefined,
        used: mode === 'combined' ? combinedQuotaUsed : 0,
        remaining: mode === 'combined' ? combinedRemaining : undefined,
        restricted: mode === 'combined' ? combinedRestricted : false,
      },
    };
  }
}
