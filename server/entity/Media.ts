import RadarrAPI from '@server/api/servarr/radarr';
import ReadarrAPI from '@server/api/servarr/readarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaStatus, MediaType } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import { Blacklist } from '@server/entity/Blacklist';
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

@Entity()
class Media {
  public static async getRelatedMedia(
    user: User | undefined,
    ids: number | number[],
    type?: MediaType
  ): Promise<Media[]> {
    const mediaRepository = getRepository(Media);

    try {
      let finalIds: number[];
      if (!Array.isArray(ids)) {
        finalIds = [ids];
      } else {
        finalIds = ids;
      }

      if (finalIds.length === 0) {
        return [];
      }

      const key = type === 'book' ? 'hcId' : 'tmdbId';
      const media = await mediaRepository
        .createQueryBuilder('media')
        .leftJoinAndSelect(
          'media.watchlists',
          'watchlist',
          'media.id= watchlist.media and watchlist.requestedBy = :userId',
          { userId: user?.id }
        )
        .where(`media.${key} in (:...finalIds)`, { finalIds })
        .getMany();

      return media;
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
      const key = mediaType === 'book' ? 'hcId' : 'tmdbId';
      const media = await mediaRepository.findOne({
        where: { [key]: id, mediaType: mediaType },
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

  @Column({ nullable: true })
  @Index()
  public tmdbId?: number;

  @Column({ unique: true, nullable: true })
  @Index()
  public tvdbId?: number;

  @Column({ nullable: true })
  @Index()
  public imdbId?: string;

  @Column({ nullable: true })
  @Index()
  public hcId?: number;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status: MediaStatus;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public statusAlt: MediaStatus;

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

  @OneToOne(() => Blacklist, (blacklist) => blacklist.media)
  public blacklist: Promise<Blacklist>;

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
  public serviceIdAlt?: number | null;

  @Column({ nullable: true, type: 'int' })
  public externalServiceId?: number | null;

  @Column({ nullable: true, type: 'int' })
  public externalServiceIdAlt?: number | null;

  @Column({ nullable: true, type: 'varchar' })
  public externalServiceSlug?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public externalServiceSlugAlt?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public ratingKey?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public ratingKeyAlt?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public jellyfinMediaId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public jellyfinMediaIdAlt?: string | null;

  public serviceUrl?: string;
  public serviceUrlAlt?: string;
  public downloadStatus?: DownloadingItem[] = [];
  public downloadStatusAlt?: DownloadingItem[] = [];

  public mediaUrl?: string;
  public mediaUrlAlt?: string;

  public iOSPlexUrl?: string;
  public iOSPlexUrlAlt?: string;

  public tautulliUrl?: string;
  public tautulliUrlAlt?: string;

  constructor(init?: Partial<Media>) {
    Object.assign(this, init);
  }

  public hasTmdbId(): this is Media & { tmdbId: number } {
    return typeof this.tmdbId === 'number';
  }

  public hasHcId(): this is Media & { hcId: number } {
    return typeof this.hcId === 'number';
  }

  @AfterLoad()
  public setPlexUrls(): void {
    const { machineId, webAppUrl } = getSettings().plex;
    const { externalUrl: tautulliUrl } = getSettings().tautulli;

    if (getSettings().main.mediaServerType == MediaServerType.PLEX) {
      if (this.ratingKey) {
        this.mediaUrl = `${
          webAppUrl ? webAppUrl : 'https://app.plex.tv/desktop'
        }#!/server/${machineId}/details?key=%2Flibrary%2Fmetadata%2F${
          this.ratingKey
        }`;

        this.iOSPlexUrl = `plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F${this.ratingKey}&server=${machineId}`;

        if (tautulliUrl) {
          this.tautulliUrl = `${tautulliUrl}/info?rating_key=${this.ratingKey}`;
        }

        if (this.ratingKeyAlt) {
          this.mediaUrlAlt = `${
            webAppUrl ? webAppUrl : 'https://app.plex.tv/desktop'
          }#!/server/${machineId}/details?key=%2Flibrary%2Fmetadata%2F${
            this.ratingKeyAlt
          }`;

          this.iOSPlexUrlAlt = `plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F${this.ratingKeyAlt}&server=${machineId}`;

          if (tautulliUrl) {
            this.tautulliUrlAlt = `${tautulliUrl}/info?rating_key=${this.ratingKeyAlt}`;
          }
        }
      }
    } else {
      const pageName =
        getSettings().main.mediaServerType == MediaServerType.EMBY
          ? 'item'
          : 'details';
      const { serverId, externalHostname } = getSettings().jellyfin;
      const jellyfinHost =
        externalHostname && externalHostname.length > 0
          ? externalHostname
          : getHostname();

      if (this.jellyfinMediaId) {
        this.mediaUrl = `${jellyfinHost}/web/index.html#!/${pageName}?id=${this.jellyfinMediaId}&context=home&serverId=${serverId}`;
      }
      if (this.jellyfinMediaIdAlt) {
        this.mediaUrlAlt = `${jellyfinHost}/web/index.html#!/${pageName}?id=${this.jellyfinMediaIdAlt}&context=home&serverId=${serverId}`;
      }
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

      if (this.serviceIdAlt !== null && this.externalServiceSlugAlt !== null) {
        const settings = getSettings();
        const server = settings.radarr.find(
          (radarr) => radarr.id === this.serviceIdAlt
        );

        if (server) {
          this.serviceUrlAlt = server.externalUrl
            ? `${server.externalUrl}/movie/${this.externalServiceSlugAlt}`
            : RadarrAPI.buildUrl(
                server,
                `/movie/${this.externalServiceSlugAlt}`
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

      if (this.serviceIdAlt !== null && this.externalServiceSlugAlt !== null) {
        const settings = getSettings();
        const server = settings.sonarr.find(
          (sonarr) => sonarr.id === this.serviceIdAlt
        );

        if (server) {
          this.serviceUrlAlt = server.externalUrl
            ? `${server.externalUrl}/series/${this.externalServiceSlugAlt}`
            : SonarrAPI.buildUrl(
                server,
                `/series/${this.externalServiceSlugAlt}`
              );
        }
      }
    }

    if (this.mediaType === MediaType.BOOK) {
      if (this.serviceId !== null && this.externalServiceSlug !== null) {
        const settings = getSettings();
        const server = settings.readarr.find(
          (readarr) => readarr.id === this.serviceId
        );

        if (server) {
          this.serviceUrl = server.externalUrl
            ? `${server.externalUrl}/book/${this.externalServiceSlug}`
            : ReadarrAPI.buildUrl(server, `/book/${this.externalServiceSlug}`);
        }
      }

      if (this.serviceIdAlt !== null && this.externalServiceSlugAlt !== null) {
        const settings = getSettings();
        const server = settings.readarr.find(
          (readarr) => readarr.id === this.serviceIdAlt
        );

        if (server) {
          this.serviceUrlAlt = server.externalUrl
            ? `${server.externalUrl}/book/${this.externalServiceSlugAlt}`
            : ReadarrAPI.buildUrl(
                server,
                `/book/${this.externalServiceSlugAlt}`
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
        this.externalServiceIdAlt !== undefined &&
        this.externalServiceIdAlt !== null &&
        this.serviceIdAlt !== undefined &&
        this.serviceIdAlt !== null
      ) {
        this.downloadStatusAlt = downloadTracker.getMovieProgress(
          this.serviceIdAlt,
          this.externalServiceIdAlt
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
        this.externalServiceIdAlt !== undefined &&
        this.externalServiceIdAlt !== null &&
        this.serviceIdAlt !== undefined &&
        this.serviceIdAlt !== null
      ) {
        this.downloadStatusAlt = downloadTracker.getSeriesProgress(
          this.serviceIdAlt,
          this.externalServiceIdAlt
        );
      }
    }

    if (this.mediaType === MediaType.BOOK) {
      if (
        this.externalServiceId !== undefined &&
        this.externalServiceId !== null &&
        this.serviceId !== undefined &&
        this.serviceId !== null
      ) {
        this.downloadStatus = downloadTracker.getBookProgress(
          this.serviceId,
          this.externalServiceId
        );
      }

      if (
        this.externalServiceIdAlt !== undefined &&
        this.externalServiceIdAlt !== null &&
        this.serviceIdAlt !== undefined &&
        this.serviceIdAlt !== null
      ) {
        this.downloadStatusAlt = downloadTracker.getBookProgress(
          this.serviceIdAlt,
          this.externalServiceIdAlt
        );
      }
    }
  }
}

export default Media;
