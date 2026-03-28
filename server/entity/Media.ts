import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaStatus, MediaType } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import type { User } from '@server/entity/User';
import { Watchlist } from '@server/entity/Watchlist';
import type { DownloadingItem } from '@server/lib/downloadtracker';
import downloadTracker from '@server/lib/downloadtracker';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { getHostname } from '@server/utils/getHostname';
import {
  AfterLoad,
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Issue from './Issue';
import { MediaRequest } from './MediaRequest';
import Season from './Season';

export interface MediaLink {
  mediaServerId: string;
  mediaServerName: string;
  mediaServerType: MediaServerType;
  url: string;
  iOSPlexUrl?: string;
  tautulliUrl?: string;
}

export interface MediaSource {
  mediaServerId?: string | null;
  mediaServerType: MediaServerType;
  ratingKey?: string | null;
  jellyfinMediaId?: string | null;
}

@Entity()
@Index(['tmdbId', 'mediaType'])
class Media {
  public static async getRelatedMedia(
    user: User | undefined,
    items: { tmdbId: number; mediaType: string }[]
  ): Promise<Media[]> {
    const mediaRepository = getRepository(Media);

    try {
      if (items.length === 0) {
        return [];
      }

      const finalIds = [...new Set(items.map((i) => i.tmdbId))];

      const media = await mediaRepository
        .createQueryBuilder('media')
        .leftJoinAndSelect(
          'media.watchlists',
          'watchlist',
          'media.id= watchlist.media and watchlist.requestedBy = :userId',
          { userId: user?.id }
        ) //,
        .where(' media.tmdbId in (:...finalIds)', { finalIds })
        .getMany();

      return media.filter((m) =>
        items.some((i) => i.tmdbId === m.tmdbId && i.mediaType === m.mediaType)
      );
    } catch (e) {
      logger.error(e.message);
      return [];
    }
  }

  public static async getMedia(
    id: number,
    mediaType: MediaType
  ): Promise<Media | undefined> {
    const mediaRepository = getRepository(Media);

    try {
      const media = await mediaRepository.findOne({
        where: { tmdbId: id, mediaType: mediaType },
        relations: { requests: true, issues: true },
      });

      return media ?? undefined;
    } catch (e) {
      logger.error(e.message);
      return undefined;
    }
  }

  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar' })
  public mediaType: MediaType;

  @Column()
  @Index()
  public tmdbId: number;

  @Column({ unique: true, nullable: true })
  @Index()
  public tvdbId?: number;

  @Column({ nullable: true })
  @Index()
  public imdbId?: string;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  @Index()
  public status: MediaStatus;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  @Index()
  public status4k: MediaStatus;

  @OneToMany(() => MediaRequest, (request) => request.media, {
    cascade: ['insert', 'remove'],
  })
  public requests: MediaRequest[];

  @OneToMany(() => Watchlist, (watchlist) => watchlist.media)
  public watchlists: null | Watchlist[];

  @OneToMany(() => Season, (season) => season.media, {
    cascade: true,
    eager: true,
  })
  public seasons: Season[];

  @OneToMany(() => Issue, (issue) => issue.media, { cascade: true })
  public issues: Issue[];

  @OneToOne(() => Blocklist, (blocklist) => blocklist.media)
  public blocklist: Promise<Blocklist>;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  /**
   * The `lastSeasonChange` column stores the date and time when the media was added to the library.
   * It needs to be database-aware because SQLite supports `datetime` while PostgreSQL supports `timestamp with timezone (timestampz)`.
   */
  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public lastSeasonChange: Date;

  /**
   * The `mediaAddedAt` column stores the date and time when the media was added to the library.
   * It needs to be database-aware because SQLite supports `datetime` while PostgreSQL supports `timestamp with timezone (timestampz)`.
   * This column is nullable because it can be null when the media is not yet synced to the library.
   */
  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    nullable: true,
  })
  public mediaAddedAt: Date;

  @Column({ nullable: true, type: 'int' })
  public serviceId?: number | null;

  @Column({ nullable: true, type: 'int' })
  public serviceId4k?: number | null;

  @Column({ nullable: true, type: 'int' })
  public externalServiceId?: number | null;

  @Column({ nullable: true, type: 'int' })
  public externalServiceId4k?: number | null;

  @Column({ nullable: true, type: 'varchar' })
  public externalServiceSlug?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public externalServiceSlug4k?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public ratingKey?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public ratingKey4k?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public plexServerId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public plexServerId4k?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public jellyfinMediaId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public jellyfinMediaId4k?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public jellyfinServerId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public jellyfinServerId4k?: string | null;

  @Column({ nullable: true, type: 'simple-json' })
  public mediaSources?: MediaSource[] | null;

  @Column({ nullable: true, type: 'simple-json' })
  public mediaSources4k?: MediaSource[] | null;

  public serviceUrl?: string;
  public serviceUrl4k?: string;
  public downloadStatus?: DownloadingItem[] = [];
  public downloadStatus4k?: DownloadingItem[] = [];

  public mediaUrl?: string;
  public mediaUrl4k?: string;
  public mediaUrls?: MediaLink[] = [];
  public mediaUrls4k?: MediaLink[] = [];

  public mediaServerType?: MediaServerType;
  public mediaServerType4k?: MediaServerType;

  public iOSPlexUrl?: string;
  public iOSPlexUrl4k?: string;

  public tautulliUrl?: string;
  public tautulliUrl4k?: string;

  constructor(init?: Partial<Media>) {
    Object.assign(this, init);
  }

  public resetServiceData(): void {
    this.serviceId = null;
    this.serviceId4k = null;
    this.externalServiceId = null;
    this.externalServiceId4k = null;
    this.externalServiceSlug = null;
    this.externalServiceSlug4k = null;
    this.ratingKey = null;
    this.ratingKey4k = null;
    this.plexServerId = null;
    this.plexServerId4k = null;
    this.jellyfinMediaId = null;
    this.jellyfinMediaId4k = null;
    this.jellyfinServerId = null;
    this.jellyfinServerId4k = null;
    this.mediaSources = null;
    this.mediaSources4k = null;
  }

  private getLegacyMediaSources(is4k: boolean): MediaSource[] {
    const legacySources: MediaSource[] = [];
    const ratingKey = is4k ? this.ratingKey4k : this.ratingKey;
    const plexServerId = is4k ? this.plexServerId4k : this.plexServerId;
    const jellyfinMediaId = is4k
      ? this.jellyfinMediaId4k
      : this.jellyfinMediaId;
    const jellyfinServerId = is4k
      ? this.jellyfinServerId4k
      : this.jellyfinServerId;

    if (ratingKey) {
      legacySources.push({
        mediaServerId: plexServerId,
        mediaServerType: MediaServerType.PLEX,
        ratingKey,
      });
    }

    if (jellyfinMediaId) {
      legacySources.push({
        mediaServerId: jellyfinServerId,
        mediaServerType:
          this.getPrimaryJellyfinLikeMediaServerType(is4k) ??
          MediaServerType.JELLYFIN,
        jellyfinMediaId,
      });
    }

    return legacySources;
  }

  private normalizeMediaSources(
    sources: MediaSource[] | null | undefined,
    is4k: boolean
  ): MediaSource[] {
    const normalized = [...(sources ?? []), ...this.getLegacyMediaSources(is4k)]
      .filter((source): source is MediaSource =>
        Boolean(
          source &&
          source.mediaServerType &&
          (source.ratingKey || source.jellyfinMediaId)
        )
      )
      .map((source) => ({
        mediaServerId:
          typeof source.mediaServerId === 'string' &&
          source.mediaServerId.length > 0
            ? source.mediaServerId
            : null,
        mediaServerType:
          source.mediaServerType === MediaServerType.EMBY
            ? MediaServerType.EMBY
            : source.mediaServerType === MediaServerType.PLEX
              ? MediaServerType.PLEX
              : MediaServerType.JELLYFIN,
        ratingKey: source.ratingKey ?? null,
        jellyfinMediaId: source.jellyfinMediaId ?? null,
      }));

    const deduped = new Map<string, MediaSource>();

    for (const source of normalized) {
      const key = [
        source.mediaServerType,
        source.mediaServerId ?? '',
        source.ratingKey ?? '',
        source.jellyfinMediaId ?? '',
      ].join(':');
      deduped.set(key, source);
    }

    return [...deduped.values()];
  }

  private getPrimaryJellyfinLikeMediaServerType(
    is4k: boolean
  ): MediaServerType | undefined {
    const sources = is4k ? this.mediaSources4k : this.mediaSources;
    const jellyfinLikeSource = sources?.find(
      (source) =>
        source.mediaServerType === MediaServerType.JELLYFIN ||
        source.mediaServerType === MediaServerType.EMBY
    );

    if (jellyfinLikeSource) {
      return jellyfinLikeSource.mediaServerType;
    }

    if (this.mediaServerType === MediaServerType.EMBY) {
      return MediaServerType.EMBY;
    }

    if (this.mediaServerType4k === MediaServerType.EMBY) {
      return MediaServerType.EMBY;
    }

    return undefined;
  }

  public getMediaSources(is4k = false): MediaSource[] {
    return this.normalizeMediaSources(
      is4k ? this.mediaSources4k : this.mediaSources,
      is4k
    );
  }

  public getPlexMediaSources(is4k = false): MediaSource[] {
    return this.getMediaSources(is4k).filter(
      (source) => source.mediaServerType === MediaServerType.PLEX
    );
  }

  public getJellyfinMediaSources(is4k = false): MediaSource[] {
    return this.getMediaSources(is4k).filter(
      (source) =>
        source.mediaServerType === MediaServerType.JELLYFIN ||
        source.mediaServerType === MediaServerType.EMBY
    );
  }

  public upsertMediaSource(source: MediaSource & { is4k?: boolean }): boolean {
    const { is4k = false, ...nextSource } = source;
    const sources = this.getMediaSources(is4k);
    const sourceIndex = sources.findIndex(
      (existingSource) =>
        existingSource.mediaServerType === nextSource.mediaServerType &&
        existingSource.mediaServerId === (nextSource.mediaServerId ?? null) &&
        existingSource.ratingKey === (nextSource.ratingKey ?? null) &&
        existingSource.jellyfinMediaId === (nextSource.jellyfinMediaId ?? null)
    );

    if (sourceIndex >= 0) {
      return false;
    }

    const updatedSources = this.normalizeMediaSources(
      [...sources, nextSource],
      is4k
    );

    if (is4k) {
      this.mediaSources4k = updatedSources;
    } else {
      this.mediaSources = updatedSources;
    }

    this.syncLegacyMediaSourceFields();
    return true;
  }

  public clearMediaSources(is4k = false): void {
    if (is4k) {
      this.mediaSources4k = [];
    } else {
      this.mediaSources = [];
    }

    this.syncLegacyMediaSourceFields();
  }

  @BeforeInsert()
  @BeforeUpdate()
  public syncLegacyMediaSourceFields(): void {
    this.mediaSources = this.normalizeMediaSources(this.mediaSources, false);
    this.mediaSources4k = this.normalizeMediaSources(this.mediaSources4k, true);

    const primaryPlexSource = this.getPlexMediaSources(false)[0];
    const primaryPlexSource4k = this.getPlexMediaSources(true)[0];
    const primaryJellyfinSource = this.getJellyfinMediaSources(false)[0];
    const primaryJellyfinSource4k = this.getJellyfinMediaSources(true)[0];

    this.ratingKey = primaryPlexSource?.ratingKey ?? null;
    this.ratingKey4k = primaryPlexSource4k?.ratingKey ?? null;
    this.plexServerId = primaryPlexSource?.mediaServerId ?? null;
    this.plexServerId4k = primaryPlexSource4k?.mediaServerId ?? null;
    this.jellyfinMediaId = primaryJellyfinSource?.jellyfinMediaId ?? null;
    this.jellyfinMediaId4k = primaryJellyfinSource4k?.jellyfinMediaId ?? null;
    this.jellyfinServerId = primaryJellyfinSource?.mediaServerId ?? null;
    this.jellyfinServerId4k = primaryJellyfinSource4k?.mediaServerId ?? null;
  }

  @AfterLoad()
  public setPlexUrls(): void {
    this.syncLegacyMediaSourceFields();

    const settings = getSettings();
    const { externalUrl: tautulliUrl } = getSettings().tautulli;
    const mediaServerTypes = settings.getMediaServerTypes();
    const preferredMediaServerType =
      mediaServerTypes[0] ?? MediaServerType.NOT_CONFIGURED;

    this.mediaUrls = [];
    this.mediaUrls4k = [];
    this.mediaUrl = undefined;
    this.mediaUrl4k = undefined;
    this.iOSPlexUrl = undefined;
    this.iOSPlexUrl4k = undefined;
    this.tautulliUrl = undefined;
    this.tautulliUrl4k = undefined;
    this.mediaServerType = undefined;
    this.mediaServerType4k = undefined;

    const buildPlexUrls = (source: MediaSource): MediaLink | null => {
      if (!source.ratingKey) {
        return null;
      }

      const server = source.mediaServerId
        ? settings.plexServers.find((plex) => plex.id === source.mediaServerId)
        : settings.getPrimaryPlexServer();

      if (!server?.machineId) {
        return null;
      }

      return {
        mediaServerId: server.id,
        mediaServerName: server.name,
        mediaServerType: MediaServerType.PLEX,
        url: `${
          server.webAppUrl ? server.webAppUrl : 'https://app.plex.tv/desktop'
        }#!/server/${server.machineId}/details?key=%2Flibrary%2Fmetadata%2F${source.ratingKey}`,
        iOSPlexUrl: `plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F${source.ratingKey}&server=${server.machineId}`,
        tautulliUrl: tautulliUrl
          ? `${tautulliUrl}/info?rating_key=${source.ratingKey}`
          : undefined,
      };
    };

    const buildJellyfinUrls = (source: MediaSource): MediaLink | null => {
      if (!source.jellyfinMediaId) {
        return null;
      }

      const server = source.mediaServerId
        ? settings.jellyfinServers.find(
            (jellyfin) => jellyfin.id === source.mediaServerId
          )
        : settings.getPrimaryJellyfinLikeServer();

      if (!server?.serverId) {
        return null;
      }

      const pageName =
        server.mediaServerType === MediaServerType.EMBY ? 'item' : 'details';
      const jellyfinHost =
        server.externalHostname && server.externalHostname.length > 0
          ? server.externalHostname
          : getHostname(server);

      return {
        mediaServerId: server.id,
        mediaServerName: server.name,
        mediaServerType: server.mediaServerType,
        url: `${jellyfinHost}/web/index.html#!/${pageName}?id=${source.jellyfinMediaId}&context=home&serverId=${server.serverId}`,
      };
    };

    const preferredFamilies =
      preferredMediaServerType === MediaServerType.PLEX
        ? ['plex', 'jellyfin']
        : ['jellyfin', 'plex'];

    const getAvailableUrls = (sources: MediaSource[]): MediaLink[] => {
      const availableUrls: MediaLink[] = [];

      for (const family of preferredFamilies) {
        const matchingSources = sources.filter((source) =>
          family === 'plex'
            ? source.mediaServerType === MediaServerType.PLEX
            : source.mediaServerType === MediaServerType.JELLYFIN ||
              source.mediaServerType === MediaServerType.EMBY
        );

        for (const source of matchingSources) {
          const mediaLink =
            family === 'plex'
              ? buildPlexUrls(source)
              : buildJellyfinUrls(source);

          if (mediaLink) {
            availableUrls.push(mediaLink);
          }
        }
      }

      return availableUrls;
    };

    const standardUrls = getAvailableUrls(this.getMediaSources(false));

    if (standardUrls.length > 0) {
      this.mediaUrls = standardUrls;
      this.mediaServerType = standardUrls[0].mediaServerType;
      this.mediaUrl = standardUrls[0].url;
      this.iOSPlexUrl = standardUrls[0].iOSPlexUrl;
      this.tautulliUrl = standardUrls[0].tautulliUrl;
    }

    const fourKUrls = getAvailableUrls(this.getMediaSources(true));

    if (fourKUrls.length > 0) {
      this.mediaUrls4k = fourKUrls;
      this.mediaServerType4k = fourKUrls[0].mediaServerType;
      this.mediaUrl4k = fourKUrls[0].url;
      this.iOSPlexUrl4k = fourKUrls[0].iOSPlexUrl;
      this.tautulliUrl4k = fourKUrls[0].tautulliUrl;
    }
  }

  @AfterLoad()
  public setServiceUrl(): void {
    if (this.mediaType === MediaType.MOVIE) {
      if (this.serviceId !== null && this.externalServiceSlug !== null) {
        const settings = getSettings();
        const server = settings.radarr.find(
          (radarr) => radarr.id === this.serviceId
        );

        if (server) {
          this.serviceUrl = server.externalUrl
            ? `${server.externalUrl}/movie/${this.externalServiceSlug}`
            : RadarrAPI.buildUrl(server, `/movie/${this.externalServiceSlug}`);
        }
      }

      if (this.serviceId4k !== null && this.externalServiceSlug4k !== null) {
        const settings = getSettings();
        const server = settings.radarr.find(
          (radarr) => radarr.id === this.serviceId4k
        );

        if (server) {
          this.serviceUrl4k = server.externalUrl
            ? `${server.externalUrl}/movie/${this.externalServiceSlug4k}`
            : RadarrAPI.buildUrl(
                server,
                `/movie/${this.externalServiceSlug4k}`
              );
        }
      }
    }

    if (this.mediaType === MediaType.TV) {
      if (this.serviceId !== null && this.externalServiceSlug !== null) {
        const settings = getSettings();
        const server = settings.sonarr.find(
          (sonarr) => sonarr.id === this.serviceId
        );

        if (server) {
          this.serviceUrl = server.externalUrl
            ? `${server.externalUrl}/series/${this.externalServiceSlug}`
            : SonarrAPI.buildUrl(server, `/series/${this.externalServiceSlug}`);
        }
      }

      if (this.serviceId4k !== null && this.externalServiceSlug4k !== null) {
        const settings = getSettings();
        const server = settings.sonarr.find(
          (sonarr) => sonarr.id === this.serviceId4k
        );

        if (server) {
          this.serviceUrl4k = server.externalUrl
            ? `${server.externalUrl}/series/${this.externalServiceSlug4k}`
            : SonarrAPI.buildUrl(
                server,
                `/series/${this.externalServiceSlug4k}`
              );
        }
      }
    }
  }

  @AfterLoad()
  public getDownloadingItem(): void {
    if (this.mediaType === MediaType.MOVIE) {
      if (
        this.externalServiceId !== undefined &&
        this.externalServiceId !== null &&
        this.serviceId !== undefined &&
        this.serviceId !== null
      ) {
        this.downloadStatus = downloadTracker.getMovieProgress(
          this.serviceId,
          this.externalServiceId
        );
      }

      if (
        this.externalServiceId4k !== undefined &&
        this.externalServiceId4k !== null &&
        this.serviceId4k !== undefined &&
        this.serviceId4k !== null
      ) {
        this.downloadStatus4k = downloadTracker.getMovieProgress(
          this.serviceId4k,
          this.externalServiceId4k
        );
      }
    }

    if (this.mediaType === MediaType.TV) {
      if (
        this.externalServiceId !== undefined &&
        this.externalServiceId !== null &&
        this.serviceId !== undefined &&
        this.serviceId !== null
      ) {
        this.downloadStatus = downloadTracker.getSeriesProgress(
          this.serviceId,
          this.externalServiceId
        );
      }

      if (
        this.externalServiceId4k !== undefined &&
        this.externalServiceId4k !== null &&
        this.serviceId4k !== undefined &&
        this.serviceId4k !== null
      ) {
        this.downloadStatus4k = downloadTracker.getSeriesProgress(
          this.serviceId4k,
          this.externalServiceId4k
        );
      }
    }
  }
}

export default Media;
