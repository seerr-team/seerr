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
    this.jellyfinMediaId = null;
    this.jellyfinMediaId4k = null;
  }

  @AfterLoad()
  public setPlexUrls(): void {
    const settings = getSettings();
    const { externalUrl: tautulliUrl } = getSettings().tautulli;
    const mediaServerTypes = settings.getMediaServerTypes();
    const preferredMediaServerType =
      mediaServerTypes[0] ?? MediaServerType.NOT_CONFIGURED;

    const buildPlexUrls = (
      ratingKey: string,
      serverId?: string | null
    ): MediaLink | null => {
      const server =
        settings.plexServers.find((plex) => plex.id === serverId) ??
        settings.getPrimaryPlexServer();

      if (!server?.machineId) {
        return null;
      }

      return {
        mediaServerId: server.id,
        mediaServerName: server.name,
        mediaServerType: MediaServerType.PLEX,
        url: `${
          server.webAppUrl ? server.webAppUrl : 'https://app.plex.tv/desktop'
        }#!/server/${server.machineId}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`,
        iOSPlexUrl: `plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F${ratingKey}&server=${server.machineId}`,
        tautulliUrl: tautulliUrl
          ? `${tautulliUrl}/info?rating_key=${ratingKey}`
          : undefined,
      };
    };

    const buildJellyfinUrls = (
      jellyfinMediaId: string,
      serverId?: string | null
    ): MediaLink | null => {
      const server =
        settings.jellyfinServers.find((jellyfin) => jellyfin.id === serverId) ??
        settings.getPrimaryJellyfinLikeServer();

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
        url: `${jellyfinHost}/web/index.html#!/${pageName}?id=${jellyfinMediaId}&context=home&serverId=${server.serverId}`,
      };
    };

    const preferredFamilies =
      preferredMediaServerType === MediaServerType.PLEX
        ? ['plex', 'jellyfin']
        : ['jellyfin', 'plex'];

    const getAvailableUrls = (
      ratingKey?: string | null,
      plexServerId?: string | null,
      jellyfinMediaId?: string | null,
      jellyfinServerId?: string | null
    ): MediaLink[] => {
      const availableUrls: MediaLink[] = [];

      for (const family of preferredFamilies) {
        if (family === 'plex' && ratingKey) {
          const plexUrls = buildPlexUrls(ratingKey, plexServerId);
          if (plexUrls) {
            availableUrls.push(plexUrls);
          }
        }

        if (family === 'jellyfin' && jellyfinMediaId) {
          const jellyfinUrls = buildJellyfinUrls(
            jellyfinMediaId,
            jellyfinServerId
          );
          if (jellyfinUrls) {
            availableUrls.push(jellyfinUrls);
          }
        }
      }

      return availableUrls;
    };

    const standardUrls = getAvailableUrls(
      this.ratingKey,
      this.plexServerId,
      this.jellyfinMediaId,
      this.jellyfinServerId
    );

    if (standardUrls.length > 0) {
      this.mediaUrls = standardUrls;
      this.mediaServerType = standardUrls[0].mediaServerType;
      this.mediaUrl = standardUrls[0].url;
      this.iOSPlexUrl = standardUrls[0].iOSPlexUrl;
      this.tautulliUrl = standardUrls[0].tautulliUrl;
    }

    const fourKUrls = getAvailableUrls(
      this.ratingKey4k,
      this.plexServerId4k,
      this.jellyfinMediaId4k,
      this.jellyfinServerId4k
    );

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
