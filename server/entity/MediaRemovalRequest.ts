import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import {
  MediaRemovalRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import dataSource from '@server/datasource';
import Media from '@server/entity/Media';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export { MediaRemovalRequestStatus };

@Entity()
export class MediaRemovalRequest {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'integer' })
  @Index()
  public status: MediaRemovalRequestStatus;

  @ManyToOne(() => Media, { eager: true, onDelete: 'CASCADE' })
  @Index()
  public media: Media;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @Index()
  public requestedBy: User;

  @ManyToOne(() => User, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @Index()
  public modifiedBy?: User;

  @Column({ default: false })
  public is4k: boolean;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value?: number[]) => (value ? JSON.stringify(value) : null),
      from: (value?: string) =>
        value ? (JSON.parse(value) as number[]) : undefined,
    },
  })
  public seasons?: number[];

  @Column({ type: 'varchar', nullable: true })
  public reason?: string;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<MediaRemovalRequest>) {
    Object.assign(this, init);
  }

  /**
   * Perform the actual media removal from Sonarr/Radarr and clear seerr data.
   */
  public async executeRemoval(): Promise<void> {
    const settings = getSettings();

    const media = this.media;
    const isMovie = media.mediaType === MediaType.MOVIE;
    const isSeasonRemoval = !isMovie && this.seasons && this.seasons.length > 0;

    const specificServiceId = this.is4k ? media.serviceId4k : media.serviceId;

    // Only attempt *arr removal if the media is tracked in a service
    if (specificServiceId != null) {
      let serviceSettings;
      if (isMovie) {
        serviceSettings = settings.radarr.find(
          (radarr) => radarr.id === specificServiceId
        );
      } else {
        serviceSettings = settings.sonarr.find(
          (sonarr) => sonarr.id === specificServiceId
        );
      }

      if (serviceSettings) {
        if (isMovie) {
          const service = new RadarrAPI({
            apiKey: serviceSettings.apiKey,
            url: RadarrAPI.buildUrl(serviceSettings, '/api/v3'),
          });
          await service.removeMovie(media.tmdbId);
        } else {
          const tmdb = new TheMovieDb();
          const series = await tmdb.getTvShow({ tvId: media.tmdbId });
          const tvdbId = series.external_ids.tvdb_id ?? media.tvdbId;
          if (!tvdbId) {
            throw new Error('TVDB ID not found');
          }
          const service = new SonarrAPI({
            apiKey: serviceSettings.apiKey,
            url: SonarrAPI.buildUrl(serviceSettings, '/api/v3'),
          });

          if (isSeasonRemoval) {
            await service.removeSeasonFiles(tvdbId, this.seasons!);
          } else {
            await service.removeSeries(tvdbId);
          }
        }
      } else {
        logger.warn(
          `No ${this.is4k ? '4K ' : ''}${isMovie ? 'Radarr' : 'Sonarr'} server found for service ID ${specificServiceId}; clearing seerr data only.`,
          { label: 'MediaRemovalRequest', requestId: this.id }
        );
      }
    } else {
      logger.info(
        'Media has no associated service; clearing seerr data only.',
        { label: 'MediaRemovalRequest', requestId: this.id }
      );
    }

    // Update seerr data in a transaction
    await dataSource.transaction(async (em) => {
      const mediaRepository = em.getRepository(Media);

      if (isSeasonRemoval) {
        // Per-season removal: update season statuses, don't delete the whole media
        const seasonRepository = em.getRepository(Season);
        for (const seasonNumber of this.seasons!) {
          const season = media.seasons?.find(
            (s) => s.seasonNumber === seasonNumber
          );
          if (season) {
            if (this.is4k) {
              season.status4k = MediaStatus.DELETED;
            } else {
              season.status = MediaStatus.DELETED;
            }
            await seasonRepository.save(season);
          }
        }

        // Check if all seasons are now deleted/unknown — if so, reset media status
        const updatedMedia = await mediaRepository.findOne({
          where: { id: media.id },
          relations: { seasons: true },
        });
        if (updatedMedia) {
          const statusField = this.is4k ? 'status4k' : 'status';
          const hasRemaining = updatedMedia.seasons.some(
            (s) =>
              s[statusField] !== MediaStatus.UNKNOWN &&
              s[statusField] !== MediaStatus.DELETED
          );
          if (!hasRemaining) {
            updatedMedia[statusField] = MediaStatus.DELETED;
            await mediaRepository.save(updatedMedia);
          } else {
            updatedMedia[statusField] = MediaStatus.PARTIALLY_AVAILABLE;
            await mediaRepository.save(updatedMedia);
          }
        }

        logger.info(
          `Season removal request executed for seasons ${this.seasons!.join(', ')}`,
          {
            label: 'MediaRemovalRequest',
            mediaId: media.id,
            tmdbId: media.tmdbId,
            requestId: this.id,
          }
        );
      } else {
        // Full media removal
        await mediaRepository.remove(media);

        logger.info('Media removal request executed successfully', {
          label: 'MediaRemovalRequest',
          mediaId: media.id,
          tmdbId: media.tmdbId,
          requestId: this.id,
        });
      }
    });
  }

  /**
   * Check if a user should get auto-approval for removal requests.
   */
  public static shouldAutoApprove(user: User): boolean {
    return user.hasPermission(
      [Permission.AUTO_APPROVE_REMOVAL, Permission.MANAGE_REQUESTS],
      { type: 'or' }
    );
  }
}

export default MediaRemovalRequest;
