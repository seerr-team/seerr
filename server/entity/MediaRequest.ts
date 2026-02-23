import type { RadarrMovieOptions } from '@server/api/servarr/radarr';
import RadarrAPI from '@server/api/servarr/radarr';
import type {
  AddSeriesOptions,
  SonarrSeries,
} from '@server/api/servarr/sonarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type { TmdbKeyword } from '@server/api/themoviedb/interfaces';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import OverrideRule from '@server/entity/OverrideRule';
import type { MediaRequestBody } from '@server/interfaces/api/requestInterfaces';
import notificationManager, { Notification } from '@server/lib/notifications';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isEqual, truncate } from 'lodash';
import {
  AfterInsert,
  AfterRemove,
  AfterUpdate,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationCount,
  UpdateDateColumn,
} from 'typeorm';
import Media from './Media';
import SeasonRequest from './SeasonRequest';
import { User } from './User';

export class RequestPermissionError extends Error {}
export class QuotaRestrictedError extends Error {}
export class DuplicateMediaRequestError extends Error {}
export class NoSeasonsAvailableError extends Error {}
export class BlacklistedMediaError extends Error {}

type MediaRequestOptions = {
  isAutoRequest?: boolean;
};

@Entity()
export class MediaRequest {
  public static async request(
    requestBody: MediaRequestBody,
    user: User,
    options: MediaRequestOptions = {}
  ): Promise<MediaRequest> {
    const tmdb = new TheMovieDb();
    const mediaRepository = getRepository(Media);
    const requestRepository = getRepository(MediaRequest);
    const userRepository = getRepository(User);
    const settings = getSettings();

    let requestUser = user;

    if (
      requestBody.userId &&
      !requestUser.hasPermission([
        Permission.MANAGE_USERS,
        Permission.MANAGE_REQUESTS,
      ])
    ) {
      throw new RequestPermissionError(
        'You do not have permission to modify the request user.'
      );
    } else if (requestBody.userId) {
      requestUser = await userRepository.findOneOrFail({
        where: { id: requestBody.userId },
      });
    }

    if (!requestUser) {
      throw new Error('User missing from request context.');
    }

    if (
      requestBody.mediaType === MediaType.MOVIE &&
      !requestUser.hasPermission(
        requestBody.is4k
          ? [Permission.REQUEST_4K, Permission.REQUEST_4K_MOVIE]
          : [Permission.REQUEST, Permission.REQUEST_MOVIE],
        {
          type: 'or',
        }
      )
    ) {
      throw new RequestPermissionError(
        `You do not have permission to make ${
          requestBody.is4k ? '4K ' : ''
        }movie requests.`
      );
    } else if (
      requestBody.mediaType === MediaType.TV &&
      !requestUser.hasPermission(
        requestBody.is4k
          ? [Permission.REQUEST_4K, Permission.REQUEST_4K_TV]
          : [Permission.REQUEST, Permission.REQUEST_TV],
        {
          type: 'or',
        }
      )
    ) {
      throw new RequestPermissionError(
        `You do not have permission to make ${
          requestBody.is4k ? '4K ' : ''
        }series requests.`
      );
    }

    const quotas = await requestUser.getQuota();

    if (requestBody.mediaType === MediaType.MOVIE && quotas.movie.restricted) {
      throw new QuotaRestrictedError('Movie Quota exceeded.');
    } else if (requestBody.mediaType === MediaType.TV && quotas.tv.restricted) {
      throw new QuotaRestrictedError('Series Quota exceeded.');
    }

    const tmdbMedia =
      requestBody.mediaType === MediaType.MOVIE
        ? await tmdb.getMovie({ movieId: requestBody.mediaId })
        : await tmdb.getTvShow({ tvId: requestBody.mediaId });

    let media = await mediaRepository.findOne({
      where: {
        tmdbId: requestBody.mediaId,
        mediaType: requestBody.mediaType,
      },
      relations: ['requests'],
    });

    if (!media) {
      media = new Media({
        tmdbId: tmdbMedia.id,
        tvdbId: requestBody.tvdbId ?? tmdbMedia.external_ids.tvdb_id,
        status: !requestBody.is4k ? MediaStatus.PENDING : MediaStatus.UNKNOWN,
        status4k: requestBody.is4k ? MediaStatus.PENDING : MediaStatus.UNKNOWN,
        mediaType: requestBody.mediaType,
      });
    } else {
      if (media.status === MediaStatus.BLACKLISTED) {
        logger.warn('Request for media blocked due to being blacklisted', {
          tmdbId: tmdbMedia.id,
          mediaType: requestBody.mediaType,
          label: 'Media Request',
        });

        throw new BlacklistedMediaError('This media is blacklisted.');
      }

      if (media.status === MediaStatus.UNKNOWN && !requestBody.is4k) {
        media.status = MediaStatus.PENDING;
      }

      if (media.status4k === MediaStatus.UNKNOWN && requestBody.is4k) {
        media.status4k = MediaStatus.PENDING;
      }
    }

    const existing = await requestRepository
      .createQueryBuilder('request')
      .leftJoin('request.media', 'media')
      .leftJoinAndSelect('request.requestedBy', 'user')
      .where('request.is4k = :is4k', { is4k: requestBody.is4k })
      .andWhere('media.tmdbId = :tmdbId', { tmdbId: tmdbMedia.id })
      .andWhere('media.mediaType = :mediaType', {
        mediaType: requestBody.mediaType,
      })
      .getMany();

    if (existing && existing.length > 0) {
      // If there is an existing movie request that isn't declined, don't allow a new one.
      if (
        requestBody.mediaType === MediaType.MOVIE &&
        existing[0].status !== MediaRequestStatus.DECLINED
      ) {
        logger.warn('Duplicate request for media blocked', {
          tmdbId: tmdbMedia.id,
          mediaType: requestBody.mediaType,
          is4k: requestBody.is4k,
          label: 'Media Request',
        });

        throw new DuplicateMediaRequestError(
          'Request for this media already exists.'
        );
      }

      // If an existing auto-request for this media exists from the same user,
      // don't allow a new one.
      if (
        existing.find(
          (r) => r.requestedBy.id === requestUser.id && r.isAutoRequest
        )
      ) {
        throw new DuplicateMediaRequestError(
          'Auto-request for this media and user already exists.'
        );
      }
    }

    // Apply overrides if the user is not an admin or has the "advanced request" permission
    const useOverrides = !user.hasPermission([Permission.MANAGE_REQUESTS], {
      type: 'or',
    });

    let rootFolder = requestBody.rootFolder;
    let profileId = requestBody.profileId;
    let tags = requestBody.tags;

    if (useOverrides) {
      const defaultRadarrId = requestBody.is4k
        ? settings.radarr.findIndex((r) => r.is4k && r.isDefault)
        : settings.radarr.findIndex((r) => !r.is4k && r.isDefault);
      const defaultSonarrId = requestBody.is4k
        ? settings.sonarr.findIndex((s) => s.is4k && s.isDefault)
        : settings.sonarr.findIndex((s) => !s.is4k && s.isDefault);

      const overrideRuleRepository = getRepository(OverrideRule);
      const overrideRules = await overrideRuleRepository.find({
        where:
          requestBody.mediaType === MediaType.MOVIE
            ? { radarrServiceId: defaultRadarrId }
            : { sonarrServiceId: defaultSonarrId },
      });

      const appliedOverrideRules = overrideRules.filter((rule) => {
        const hasAnimeKeyword =
          'results' in tmdbMedia.keywords &&
          tmdbMedia.keywords.results.some(
            (keyword: TmdbKeyword) => keyword.id === ANIME_KEYWORD_ID
          );

        // Skip override rules if the media is an anime TV show as anime TV
        // is handled by default and override rules do not explicitly include
        // the anime keyword
        if (
          requestBody.mediaType === MediaType.TV &&
          hasAnimeKeyword &&
          (!rule.keywords ||
            !rule.keywords.split(',').map(Number).includes(ANIME_KEYWORD_ID))
        ) {
          return false;
        }

        if (
          rule.users &&
          !rule.users
            .split(',')
            .some((userId) => Number(userId) === requestUser.id)
        ) {
          return false;
        }
        if (
          rule.genre &&
          !rule.genre
            .split(',')
            .some((genreId) =>
              tmdbMedia.genres
                .map((genre) => genre.id)
                .includes(Number(genreId))
            )
        ) {
          return false;
        }
        if (
          rule.language &&
          !rule.language
            .split('|')
            .some((languageId) => languageId === tmdbMedia.original_language)
        ) {
          return false;
        }
        if (
          rule.keywords &&
          !rule.keywords.split(',').some((keywordId) => {
            let keywordList: TmdbKeyword[] = [];

            if ('keywords' in tmdbMedia.keywords) {
              keywordList = tmdbMedia.keywords.keywords;
            } else if ('results' in tmdbMedia.keywords) {
              keywordList = tmdbMedia.keywords.results;
            }

            return keywordList
              .map((keyword: TmdbKeyword) => keyword.id)
              .includes(Number(keywordId));
          })
        ) {
          return false;
        }
        return true;
      });

      // hacky way to prioritize rules
      // TODO: make this better
      const prioritizedRule = appliedOverrideRules.sort((a, b) => {
        const keys: (keyof OverrideRule)[] = ['genre', 'language', 'keywords'];

        const aSpecificity = keys.filter((key) => a[key] !== null).length;
        const bSpecificity = keys.filter((key) => b[key] !== null).length;

        // Take the rule with the most specific condition first
        return bSpecificity - aSpecificity;
      })[0];

      if (prioritizedRule) {
        if (prioritizedRule.rootFolder) {
          rootFolder = prioritizedRule.rootFolder;
        }
        if (prioritizedRule.profileId) {
          profileId = prioritizedRule.profileId;
        }
        if (prioritizedRule.tags) {
          tags = [
            ...new Set([
              ...(tags || []),
              ...prioritizedRule.tags.split(',').map((tag) => Number(tag)),
            ]),
          ];
        }

        logger.debug('Override rule applied.', {
          label: 'Media Request',
          overrides: prioritizedRule,
        });
      }
    }

    if (requestBody.mediaType === MediaType.MOVIE) {
      await mediaRepository.save(media);

      const request = new MediaRequest({
        type: MediaType.MOVIE,
        media,
        requestedBy: requestUser,
        // If the user is an admin or has the "auto approve" permission, automatically approve the request
        status: user.hasPermission(
          [
            requestBody.is4k
              ? Permission.AUTO_APPROVE_4K
              : Permission.AUTO_APPROVE,
            requestBody.is4k
              ? Permission.AUTO_APPROVE_4K_MOVIE
              : Permission.AUTO_APPROVE_MOVIE,
            Permission.MANAGE_REQUESTS,
          ],
          { type: 'or' }
        )
          ? MediaRequestStatus.APPROVED
          : MediaRequestStatus.PENDING,
        modifiedBy: user.hasPermission(
          [
            requestBody.is4k
              ? Permission.AUTO_APPROVE_4K
              : Permission.AUTO_APPROVE,
            requestBody.is4k
              ? Permission.AUTO_APPROVE_4K_MOVIE
              : Permission.AUTO_APPROVE_MOVIE,
            Permission.MANAGE_REQUESTS,
          ],
          { type: 'or' }
        )
          ? user
          : undefined,
        is4k: requestBody.is4k,
        serverId: requestBody.serverId,
        profileId: profileId,
        rootFolder: rootFolder,
        tags: tags,
        isAutoRequest: options.isAutoRequest ?? false,
      });

      await requestRepository.save(request);
      return request;
    } else {
      const tmdbMediaShow = tmdbMedia as Awaited<
        ReturnType<typeof tmdb.getTvShow>
      >;
      let requestedSeasons =
        requestBody.seasons === 'all'
          ? tmdbMediaShow.seasons.map((season) => season.season_number)
          : (requestBody.seasons as number[]);
      if (!settings.main.enableSpecialEpisodes) {
        requestedSeasons = requestedSeasons.filter((sn) => sn > 0);
      }

      let existingSeasons: number[] = [];

      // We need to check existing requests on this title to make sure we don't double up on seasons that were
      // already requested. In the case they were, we just throw out any duplicates but still approve the request.
      // (Unless there are no seasons, in which case we abort)
      if (media.requests) {
        existingSeasons = media.requests
          .filter(
            (request) =>
              request.is4k === requestBody.is4k &&
              request.status !== MediaRequestStatus.DECLINED
          )
          .reduce((seasons, request) => {
            const combinedSeasons = request.seasons.map(
              (season) => season.seasonNumber
            );

            return [...seasons, ...combinedSeasons];
          }, [] as number[]);
      }

      // We should also check seasons that are available/partially available but don't have existing requests
      if (media.seasons) {
        existingSeasons = [
          ...existingSeasons,
          ...media.seasons
            .filter(
              (season) =>
                season[requestBody.is4k ? 'status4k' : 'status'] !==
                MediaStatus.UNKNOWN
            )
            .map((season) => season.seasonNumber),
        ];
      }

      const finalSeasons = requestedSeasons.filter(
        (rs) => !existingSeasons.includes(rs)
      );

      if (finalSeasons.length === 0) {
        throw new NoSeasonsAvailableError('No seasons available to request');
      } else if (
        quotas.tv.limit &&
        finalSeasons.length > (quotas.tv.remaining ?? 0)
      ) {
        throw new QuotaRestrictedError('Series Quota exceeded.');
      }

      await mediaRepository.save(media);

      const request = new MediaRequest({
        type: MediaType.TV,
        media,
        requestedBy: requestUser,
        // If the user is an admin or has the "auto approve" permission, automatically approve the request
        status: user.hasPermission(
          [
            requestBody.is4k
              ? Permission.AUTO_APPROVE_4K
              : Permission.AUTO_APPROVE,
            requestBody.is4k
              ? Permission.AUTO_APPROVE_4K_TV
              : Permission.AUTO_APPROVE_TV,
            Permission.MANAGE_REQUESTS,
          ],
          { type: 'or' }
        )
          ? MediaRequestStatus.APPROVED
          : MediaRequestStatus.PENDING,
        modifiedBy: user.hasPermission(
          [
            requestBody.is4k
              ? Permission.AUTO_APPROVE_4K
              : Permission.AUTO_APPROVE,
            requestBody.is4k
              ? Permission.AUTO_APPROVE_4K_TV
              : Permission.AUTO_APPROVE_TV,
            Permission.MANAGE_REQUESTS,
          ],
          { type: 'or' }
        )
          ? user
          : undefined,
        is4k: requestBody.is4k,
        serverId: requestBody.serverId,
        profileId: profileId,
        rootFolder: rootFolder,
        languageProfileId: requestBody.languageProfileId,
        tags: tags,
        seasons: finalSeasons.map(
          (sn) =>
            new SeasonRequest({
              seasonNumber: sn,
              status: user.hasPermission(
                [
                  requestBody.is4k
                    ? Permission.AUTO_APPROVE_4K
                    : Permission.AUTO_APPROVE,
                  requestBody.is4k
                    ? Permission.AUTO_APPROVE_4K_TV
                    : Permission.AUTO_APPROVE_TV,
                  Permission.MANAGE_REQUESTS,
                ],
                { type: 'or' }
              )
                ? MediaRequestStatus.APPROVED
                : MediaRequestStatus.PENDING,
            })
        ),
        isAutoRequest: options.isAutoRequest ?? false,
      });

      await requestRepository.save(request);
      return request;
    }
  }

  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'integer' })
  public status: MediaRequestStatus;

  @ManyToOne(() => Media, (media) => media.requests, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public media: Media;

  @ManyToOne(() => User, (user) => user.requests, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public requestedBy: User;

  @ManyToOne(() => User, {
    nullable: true,
    cascade: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  public modifiedBy?: User;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;

  @Column({ type: 'varchar' })
  public type: MediaType;

  @RelationCount((request: MediaRequest) => request.seasons)
  public seasonCount: number;

  @OneToMany(() => SeasonRequest, (season) => season.request, {
    eager: true,
    cascade: true,
  })
  public seasons: SeasonRequest[];

  @Column({ default: false })
  public is4k: boolean;

  @Column({ nullable: true })
  public serverId: number;

  @Column({ nullable: true })
  public profileId: number;

  @Column({ nullable: true })
  public rootFolder: string;

  @Column({ nullable: true })
  public languageProfileId: number;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      from: (value: string | null): number[] | null => {
        if (value) {
          if (value === 'none') {
            return [];
          }
          return value.split(',').map((v) => Number(v));
        }
        return null;
      },
      to: (value: number[] | null): string | null => {
        if (value) {
          const finalValue = value.join(',');

          // We want to keep the actual state of an "empty array" so we use
          // the keyword "none" to track this.
          if (!finalValue) {
            return 'none';
          }

          return finalValue;
        }
        return null;
      },
    },
  })
  public tags?: number[];

  @Column({ default: false })
  public isAutoRequest: boolean;

  constructor(init?: Partial<MediaRequest>) {
    Object.assign(this, init);
  }

  @AfterUpdate()
  @AfterInsert()
  public async sendMedia(): Promise<void> {
    await Promise.all([this.sendToRadarr(), this.sendToSonarr()]);
  }

  @AfterInsert()
  public async notifyNewRequest(): Promise<void> {
    if (this.status === MediaRequestStatus.PENDING) {
      const mediaRepository = getRepository(Media);
      const media = await mediaRepository.findOne({
        where: { id: this.media.id },
      });
      if (!media) {
        logger.error('Media data not found', {
          label: 'Media Request',
          requestId: this.id,
          mediaId: this.media.id,
        });
        return;
      }

      this.sendNotification(media, Notification.MEDIA_PENDING);

      if (this.isAutoRequest) {
        this.sendNotification(media, Notification.MEDIA_AUTO_REQUESTED);
      }
    }
  }

  /**
   * Notification for approval
   *
   * We only check on AfterUpdate as to not trigger this for
   * auto approved content
   */
  @AfterUpdate()
  public async notifyApprovedOrDeclined(autoApproved = false): Promise<void> {
    if (
      this.status === MediaRequestStatus.APPROVED ||
      this.status === MediaRequestStatus.DECLINED
    ) {
      const mediaRepository = getRepository(Media);
      const media = await mediaRepository.findOne({
        where: { id: this.media.id },
      });
      if (!media) {
        logger.error('Media data not found', {
          label: 'Media Request',
          requestId: this.id,
          mediaId: this.media.id,
        });
        return;
      }

      if (media[this.is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE) {
        logger.warn(
          'Media became available before request was approved. Skipping approval notification',
          { label: 'Media Request', requestId: this.id, mediaId: this.media.id }
        );
        return;
      }

      this.sendNotification(
        media,
        this.status === MediaRequestStatus.APPROVED
          ? autoApproved
            ? Notification.MEDIA_AUTO_APPROVED
            : Notification.MEDIA_APPROVED
          : Notification.MEDIA_DECLINED
      );

      if (
        this.status === MediaRequestStatus.APPROVED &&
        autoApproved &&
        this.isAutoRequest
      ) {
        this.sendNotification(media, Notification.MEDIA_AUTO_REQUESTED);
      }
    }
  }

  @AfterInsert()
  public async autoapprovalNotification(): Promise<void> {
    if (this.status === MediaRequestStatus.APPROVED) {
      this.notifyApprovedOrDeclined(true);
    }
  }

  @AfterUpdate()
  @AfterInsert()
  public async updateParentStatus(): Promise<void> {
    const mediaRepository = getRepository(Media);
    const media = await mediaRepository.findOne({
      where: { id: this.media.id },
      relations: { requests: true },
    });
    if (!media) {
      logger.error('Media data not found', {
        label: 'Media Request',
        requestId: this.id,
        mediaId: this.media.id,
      });
      return;
    }
    const seasonRequestRepository = getRepository(SeasonRequest);
    if (
      this.status === MediaRequestStatus.APPROVED &&
      // Do not update the status if the item is already partially available or available
      media[this.is4k ? 'status4k' : 'status'] !== MediaStatus.AVAILABLE &&
      media[this.is4k ? 'status4k' : 'status'] !==
        MediaStatus.PARTIALLY_AVAILABLE &&
      media[this.is4k ? 'status4k' : 'status'] !== MediaStatus.PROCESSING
    ) {
      const statusField = this.is4k ? 'status4k' : 'status';

      await mediaRepository.update(
        { id: this.media.id },
        { [statusField]: MediaStatus.PROCESSING }
      );
    }

    if (
      media.mediaType === MediaType.MOVIE &&
      this.status === MediaRequestStatus.DECLINED
    ) {
      const statusField = this.is4k ? 'status4k' : 'status';
      await mediaRepository.update(
        { id: this.media.id },
        { [statusField]: MediaStatus.UNKNOWN }
      );
    }

    /**
     * If the media type is TV, and we are declining a request,
     * we must check if its the only pending request and that
     * there the current media status is just pending (meaning no
     * other requests have yet to be approved)
     */
    if (
      media.mediaType === MediaType.TV &&
      this.status === MediaRequestStatus.DECLINED &&
      media.requests.filter(
        (request) => request.status === MediaRequestStatus.PENDING
      ).length === 0 &&
      media[this.is4k ? 'status4k' : 'status'] === MediaStatus.PENDING
    ) {
      const statusField = this.is4k ? 'status4k' : 'status';
      mediaRepository.update(
        { id: this.media.id },
        { [statusField]: MediaStatus.UNKNOWN }
      );
    }

    // Approve child seasons if parent is approved
    if (
      media.mediaType === MediaType.TV &&
      this.status === MediaRequestStatus.APPROVED
    ) {
      this.seasons.forEach((season) => {
        season.status = MediaRequestStatus.APPROVED;
        seasonRequestRepository.save(season);
      });
    }
  }

  @AfterRemove()
  public async handleRemoveParentUpdate(): Promise<void> {
    const mediaRepository = getRepository(Media);
    const fullMedia = await mediaRepository.findOneOrFail({
      where: { id: this.media.id },
      relations: { requests: true },
    });

    if (
      !fullMedia.requests.some((request) => !request.is4k) &&
      fullMedia.status !== MediaStatus.AVAILABLE
    ) {
      fullMedia.status = MediaStatus.UNKNOWN;
    }

    if (
      !fullMedia.requests.some((request) => request.is4k) &&
      fullMedia.status4k !== MediaStatus.AVAILABLE
    ) {
      fullMedia.status4k = MediaStatus.UNKNOWN;
    }

    mediaRepository.save(fullMedia);
  }

  public async sendToRadarr(): Promise<void> {
    if (
      this.status === MediaRequestStatus.APPROVED &&
      this.type === MediaType.MOVIE
    ) {
      try {
        const mediaRepository = getRepository(Media);
        const settings = getSettings();
        if (settings.radarr.length === 0 && !settings.radarr[0]) {
          logger.info(
            'No Radarr server configured, skipping request processing',
            {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
            }
          );
          return;
        }

        let radarrSettings = settings.radarr.find(
          (radarr) => radarr.isDefault && radarr.is4k === this.is4k
        );

        if (
          this.serverId !== null &&
          this.serverId >= 0 &&
          radarrSettings?.id !== this.serverId
        ) {
          radarrSettings = settings.radarr.find(
            (radarr) => radarr.id === this.serverId
          );
          logger.info(
            `Request has an override server: ${radarrSettings?.name}`,
            {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
            }
          );
        }

        if (!radarrSettings) {
          logger.warn(
            `There is no default ${
              this.is4k ? '4K ' : ''
            }Radarr server configured. Did you set any of your ${
              this.is4k ? '4K ' : ''
            }Radarr servers as default?`,
            {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
            }
          );
          return;
        }

        let rootFolder = radarrSettings.activeDirectory;
        let qualityProfile = radarrSettings.activeProfileId;
        let tags = radarrSettings.tags ? [...radarrSettings.tags] : [];

        if (
          this.rootFolder &&
          this.rootFolder !== '' &&
          this.rootFolder !== radarrSettings.activeDirectory
        ) {
          rootFolder = this.rootFolder;
          logger.info(`Request has an override root folder: ${rootFolder}`, {
            label: 'Media Request',
            requestId: this.id,
            mediaId: this.media.id,
          });
        }

        if (
          this.profileId &&
          this.profileId !== radarrSettings.activeProfileId
        ) {
          qualityProfile = this.profileId;
          logger.info(
            `Request has an override quality profile ID: ${qualityProfile}`,
            {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
            }
          );
        }

        if (this.tags && !isEqual(this.tags, radarrSettings.tags)) {
          tags = this.tags;
          logger.info(`Request has override tags`, {
            label: 'Media Request',
            requestId: this.id,
            mediaId: this.media.id,
            tagIds: tags,
          });
        }

        const tmdb = new TheMovieDb();
        const radarr = new RadarrAPI({
          apiKey: radarrSettings.apiKey,
          url: RadarrAPI.buildUrl(radarrSettings, '/api/v3'),
        });
        const movie = await tmdb.getMovie({ movieId: this.media.tmdbId });

        const media = await mediaRepository.findOne({
          where: { id: this.media.id },
        });

        if (!media) {
          logger.error('Media data not found', {
            label: 'Media Request',
            requestId: this.id,
            mediaId: this.media.id,
          });
          return;
        }

        if (radarrSettings.tagRequests) {
          let userTag = (await radarr.getTags()).find((v) =>
            v.label.startsWith(this.requestedBy.id + ' - ')
          );
          if (!userTag) {
            logger.info(`Requester has no active tag. Creating new`, {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
              userId: this.requestedBy.id,
              newTag:
                this.requestedBy.id + ' - ' + this.requestedBy.displayName,
            });
            userTag = await radarr.createTag({
              label: this.requestedBy.id + ' - ' + this.requestedBy.displayName,
            });
          }
          if (userTag.id) {
            if (!tags?.find((v) => v === userTag?.id)) {
              tags?.push(userTag.id);
            }
          } else {
            logger.warn(`Requester has no tag and failed to add one`, {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
              userId: this.requestedBy.id,
              radarrServer: radarrSettings.hostname + ':' + radarrSettings.port,
            });
          }
        }

        if (
          media[this.is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE
        ) {
          logger.warn('Media already exists, marking request as APPROVED', {
            label: 'Media Request',
            requestId: this.id,
            mediaId: this.media.id,
          });

          const requestRepository = getRepository(MediaRequest);

          await requestRepository.update(this.id, {
            status: MediaRequestStatus.APPROVED,
          });
          return;
        }

        const radarrMovieOptions: RadarrMovieOptions = {
          profileId: qualityProfile,
          qualityProfileId: qualityProfile,
          rootFolderPath: rootFolder,
          minimumAvailability: radarrSettings.minimumAvailability,
          title: movie.title,
          tmdbId: movie.id,
          year: Number(movie.release_date.slice(0, 4)),
          monitored: true,
          tags,
          searchNow: !radarrSettings.preventSearch,
        };

        // Run this asynchronously so we don't wait for it on the UI side
        radarr
          .addMovie(radarrMovieOptions)
          .then(async (radarrMovie) => {
            // We grab media again here to make sure we have the latest version of it
            const media = await mediaRepository.findOne({
              where: { id: this.media.id },
            });

            if (!media) {
              throw new Error('Media data not found');
            }

            const updateFields = {
              [this.is4k ? 'externalServiceId4k' : 'externalServiceId']:
                radarrMovie.id,
              [this.is4k ? 'externalServiceSlug4k' : 'externalServiceSlug']:
                radarrMovie.titleSlug,
              [this.is4k ? 'serviceId4k' : 'serviceId']: radarrSettings?.id,
            };

            await mediaRepository.update({ id: this.media.id }, updateFields);
          })
          .catch(async () => {
            const requestRepository = getRepository(MediaRequest);

            await requestRepository.update(this.id, {
              status: MediaRequestStatus.FAILED,
            });

            logger.warn(
              'Something went wrong sending movie request to Radarr, marking status as FAILED',
              {
                label: 'Media Request',
                requestId: this.id,
                mediaId: this.media.id,
                radarrMovieOptions,
              }
            );

            this.sendNotification(media, Notification.MEDIA_FAILED);
          })
          .finally(() => {
            radarr.clearCache({
              tmdbId: movie.id,
              externalId: this.is4k
                ? media.externalServiceId4k
                : media.externalServiceId,
            });
          });
        logger.info('Sent request to Radarr', {
          label: 'Media Request',
          requestId: this.id,
          mediaId: this.media.id,
        });
      } catch (e) {
        logger.error('Something went wrong sending request to Radarr', {
          label: 'Media Request',
          errorMessage: e.message,
          requestId: this.id,
          mediaId: this.media.id,
        });
        throw new Error(e.message);
      }
    }
  }

  public async sendToSonarr(): Promise<void> {
    if (
      this.status === MediaRequestStatus.APPROVED &&
      this.type === MediaType.TV
    ) {
      try {
        const mediaRepository = getRepository(Media);
        const settings = getSettings();
        if (settings.sonarr.length === 0 && !settings.sonarr[0]) {
          logger.warn(
            'No Sonarr server configured, skipping request processing',
            {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
            }
          );
          return;
        }

        let sonarrSettings = settings.sonarr.find(
          (sonarr) => sonarr.isDefault && sonarr.is4k === this.is4k
        );

        if (
          this.serverId !== null &&
          this.serverId >= 0 &&
          sonarrSettings?.id !== this.serverId
        ) {
          sonarrSettings = settings.sonarr.find(
            (sonarr) => sonarr.id === this.serverId
          );
          logger.info(
            `Request has an override server: ${sonarrSettings?.name}`,
            {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
            }
          );
        }

        if (!sonarrSettings) {
          logger.warn(
            `There is no default ${
              this.is4k ? '4K ' : ''
            }Sonarr server configured. Did you set any of your ${
              this.is4k ? '4K ' : ''
            }Sonarr servers as default?`,
            {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
            }
          );
          return;
        }

        const media = await mediaRepository.findOne({
          where: { id: this.media.id },
          relations: { requests: true },
        });

        if (!media) {
          throw new Error('Media data not found');
        }

        if (
          media[this.is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE
        ) {
          logger.warn('Media already exists, marking request as APPROVED', {
            label: 'Media Request',
            requestId: this.id,
            mediaId: this.media.id,
          });

          const requestRepository = getRepository(MediaRequest);
          await requestRepository.update(this.id, {
            status: MediaRequestStatus.APPROVED,
          });
          return;
        }

        const tmdb = new TheMovieDb();
        const sonarr = new SonarrAPI({
          apiKey: sonarrSettings.apiKey,
          url: SonarrAPI.buildUrl(sonarrSettings, '/api/v3'),
        });
        const series = await tmdb.getTvShow({ tvId: media.tmdbId });
        const tvdbId = series.external_ids.tvdb_id ?? media.tvdbId;

        if (!tvdbId) {
          const requestRepository = getRepository(MediaRequest);
          await mediaRepository.remove(media);
          await requestRepository.remove(this);
          throw new Error('TVDB ID not found');
        }

        let seriesType: SonarrSeries['seriesType'] = 'standard';

        // Change series type to anime if the anime keyword is present on tmdb
        if (
          series.keywords.results.some(
            (keyword) => keyword.id === ANIME_KEYWORD_ID
          )
        ) {
          seriesType = sonarrSettings.animeSeriesType ?? 'anime';
        }

        let rootFolder =
          seriesType === 'anime' && sonarrSettings.activeAnimeDirectory
            ? sonarrSettings.activeAnimeDirectory
            : sonarrSettings.activeDirectory;
        let qualityProfile =
          seriesType === 'anime' && sonarrSettings.activeAnimeProfileId
            ? sonarrSettings.activeAnimeProfileId
            : sonarrSettings.activeProfileId;
        let languageProfile =
          seriesType === 'anime' && sonarrSettings.activeAnimeLanguageProfileId
            ? sonarrSettings.activeAnimeLanguageProfileId
            : sonarrSettings.activeLanguageProfileId;
        let tags =
          seriesType === 'anime'
            ? sonarrSettings.animeTags
              ? [...sonarrSettings.animeTags]
              : []
            : sonarrSettings.tags
            ? [...sonarrSettings.tags]
            : [];

        if (
          this.rootFolder &&
          this.rootFolder !== '' &&
          this.rootFolder !== rootFolder
        ) {
          rootFolder = this.rootFolder;
          logger.info(`Request has an override root folder: ${rootFolder}`, {
            label: 'Media Request',
            requestId: this.id,
            mediaId: this.media.id,
          });
        }

        if (this.profileId && this.profileId !== qualityProfile) {
          qualityProfile = this.profileId;
          logger.info(
            `Request has an override quality profile ID: ${qualityProfile}`,
            {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
            }
          );
        }

        if (
          this.languageProfileId &&
          this.languageProfileId !== languageProfile
        ) {
          languageProfile = this.languageProfileId;
          logger.info(
            `Request has an override language profile ID: ${languageProfile}`,
            {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
            }
          );
        }

        if (this.tags && !isEqual(this.tags, tags)) {
          tags = this.tags;
          logger.info(`Request has override tags`, {
            label: 'Media Request',
            requestId: this.id,
            mediaId: this.media.id,
            tagIds: tags,
          });
        }

        if (sonarrSettings.tagRequests) {
          let userTag = (await sonarr.getTags()).find((v) =>
            v.label.startsWith(this.requestedBy.id + ' - ')
          );
          if (!userTag) {
            logger.info(`Requester has no active tag. Creating new`, {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
              userId: this.requestedBy.id,
              newTag:
                this.requestedBy.id + ' - ' + this.requestedBy.displayName,
            });
            userTag = await sonarr.createTag({
              label: this.requestedBy.id + ' - ' + this.requestedBy.displayName,
            });
          }
          if (userTag.id) {
            if (!tags?.find((v) => v === userTag?.id)) {
              tags?.push(userTag.id);
            }
          } else {
            logger.warn(`Requester has no tag and failed to add one`, {
              label: 'Media Request',
              requestId: this.id,
              mediaId: this.media.id,
              userId: this.requestedBy.id,
              sonarrServer: sonarrSettings.hostname + ':' + sonarrSettings.port,
            });
          }
        }

        const sonarrSeriesOptions: AddSeriesOptions = {
          profileId: qualityProfile,
          languageProfileId: languageProfile,
          rootFolderPath: rootFolder,
          title: series.name,
          tvdbid: tvdbId,
          seasons: this.seasons.map((season) => season.seasonNumber),
          seasonFolder: sonarrSettings.enableSeasonFolders,
          seriesType,
          tags,
          monitored: true,
          searchNow: !sonarrSettings.preventSearch,
          monitorNewItems: sonarrSettings.monitorNewItems,
        };

        // Run this asynchronously so we don't wait for it on the UI side
        sonarr
          .addSeries(sonarrSeriesOptions)
          .then(async (sonarrSeries) => {
            // We grab media again here to make sure we have the latest version of it
            const media = await mediaRepository.findOne({
              where: { id: this.media.id },
              relations: { requests: true },
            });

            if (!media) {
              throw new Error('Media data not found');
            }

            const updateFields = {
              [this.is4k ? 'externalServiceId4k' : 'externalServiceId']:
                sonarrSeries.id,
              [this.is4k ? 'externalServiceSlug4k' : 'externalServiceSlug']:
                sonarrSeries.titleSlug,
              [this.is4k ? 'serviceId4k' : 'serviceId']: sonarrSettings?.id,
            };

            await mediaRepository.update({ id: this.media.id }, updateFields);
          })
          .catch(async () => {
            const requestRepository = getRepository(MediaRequest);

            await requestRepository.update(
              { id: this.id },
              { status: MediaRequestStatus.FAILED }
            );

            logger.warn(
              'Something went wrong sending series request to Sonarr, marking status as FAILED',
              {
                label: 'Media Request',
                requestId: this.id,
                mediaId: this.media.id,
                sonarrSeriesOptions,
              }
            );

            this.sendNotification(media, Notification.MEDIA_FAILED);
          })
          .finally(() => {
            sonarr.clearCache({
              tvdbId,
              externalId: this.is4k
                ? media.externalServiceId4k
                : media.externalServiceId,
              title: series.name,
            });
          });
        logger.info('Sent request to Sonarr', {
          label: 'Media Request',
          requestId: this.id,
          mediaId: this.media.id,
        });
      } catch (e) {
        logger.error('Something went wrong sending request to Sonarr', {
          label: 'Media Request',
          errorMessage: e.message,
          requestId: this.id,
          mediaId: this.media.id,
        });
        throw new Error(e.message);
      }
    }
  }

  private async sendNotification(media: Media, type: Notification) {
    const tmdb = new TheMovieDb();

    try {
      const mediaType = this.type === MediaType.MOVIE ? 'Movie' : 'Series';
      let event: string | undefined;
      let notifyAdmin = true;
      let notifySystem = true;

      switch (type) {
        case Notification.MEDIA_APPROVED:
          event = `${this.is4k ? '4K ' : ''}${mediaType} Request Approved`;
          notifyAdmin = false;
          break;
        case Notification.MEDIA_DECLINED:
          event = `${this.is4k ? '4K ' : ''}${mediaType} Request Declined`;
          notifyAdmin = false;
          break;
        case Notification.MEDIA_PENDING:
          event = `New ${this.is4k ? '4K ' : ''}${mediaType} Request`;
          break;
        case Notification.MEDIA_AUTO_REQUESTED:
          event = `${
            this.is4k ? '4K ' : ''
          }${mediaType} Request Automatically Submitted`;
          notifyAdmin = false;
          notifySystem = false;
          break;
        case Notification.MEDIA_AUTO_APPROVED:
          event = `${
            this.is4k ? '4K ' : ''
          }${mediaType} Request Automatically Approved`;
          break;
        case Notification.MEDIA_FAILED:
          event = `${this.is4k ? '4K ' : ''}${mediaType} Request Failed`;
          break;
      }

      if (this.type === MediaType.MOVIE) {
        const movie = await tmdb.getMovie({ movieId: media.tmdbId });
        notificationManager.sendNotification(type, {
          media,
          request: this,
          notifyAdmin,
          notifySystem,
          notifyUser: notifyAdmin ? undefined : this.requestedBy,
          event,
          subject: `${movie.title}${
            movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ''
          }`,
          message: truncate(movie.overview, {
            length: 500,
            separator: /\s/,
            omission: '…',
          }),
          image: `https://image.tmdb.org/t/p/w600_and_h900_bestv2${movie.poster_path}`,
        });
      } else if (this.type === MediaType.TV) {
        const tv = await tmdb.getTvShow({ tvId: media.tmdbId });
        notificationManager.sendNotification(type, {
          media,
          request: this,
          notifyAdmin,
          notifySystem,
          notifyUser: notifyAdmin ? undefined : this.requestedBy,
          event,
          subject: `${tv.name}${
            tv.first_air_date ? ` (${tv.first_air_date.slice(0, 4)})` : ''
          }`,
          message: truncate(tv.overview, {
            length: 500,
            separator: /\s/,
            omission: '…',
          }),
          image: `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tv.poster_path}`,
          extra: [
            {
              name: 'Requested Seasons',
              value: this.seasons
                .map((season) => season.seasonNumber)
                .join(', '),
            },
          ],
        });
      }
    } catch (e) {
      logger.error('Something went wrong sending media notification(s)', {
        label: 'Notifications',
        errorMessage: e.message,
        requestId: this.id,
        mediaId: this.media.id,
      });
    }
  }
}

export default MediaRequest;
