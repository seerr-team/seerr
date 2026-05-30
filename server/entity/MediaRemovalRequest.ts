import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import {
  MediaRemovalRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import dataSource, { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import type { DVRSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  In,
  Index,
  ManyToOne,
  Not,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type EntityManager,
} from 'typeorm';

export { MediaRemovalRequestStatus };

@Entity()
export class MediaRemovalRequest {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'integer' })
  @Index()
  public status: MediaRemovalRequestStatus;

  @ManyToOne(() => Media, { eager: true, nullable: true, onDelete: 'SET NULL' })
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

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<MediaRemovalRequest>) {
    Object.assign(this, init);
  }

  /**
   * Perform the actual media removal from Sonarr/Radarr and clear seerr data.
   *
   * If multiple users have requested this media, only the requesting user's
   * tag is removed from the *arr service (partial removal). Full deletion
   * only occurs when every requester has an approved/partially-removed
   * removal request, or when the requester used REMOVAL_ALL (force).
   */
  public async executeRemoval(): Promise<void> {
    const settings = getSettings();

    const media = this.media;
    const isMovie = media.mediaType === MediaType.MOVIE;
    const isSeasonRemoval =
      !isMovie && !!this.seasons && this.seasons.length > 0;
    const targetSeasons = this.seasons ?? [];

    const specificServiceId = this.is4k ? media.serviceId4k : media.serviceId;

    // Determine which users must consent before this media (or these seasons)
    // can be fully removed. The consent set is scoped to the same quality
    // version (is4k) and, for season-level removals, to requesters of the
    // specific seasons being removed — so a requester of a different quality
    // version or of unrelated seasons neither blocks nor triggers this removal.
    const mediaRequestRepository = getRepository(MediaRequest);
    const mediaRequests = await mediaRequestRepository.find({
      where: { media: { id: media.id }, is4k: this.is4k },
      relations: ['requestedBy', 'seasons'],
    });
    const relevantRequests = isSeasonRemoval
      ? mediaRequests.filter((r) =>
          (r.seasons ?? []).some((s) => targetSeasons.includes(s.seasonNumber))
        )
      : mediaRequests;
    const uniqueRequesterIds = new Set(
      relevantRequests.map((r) => r.requestedBy.id)
    );

    // Check whether every other relevant requester already has an
    // approved/partially-removed removal request. For season-level removals,
    // only other removals that overlap the same seasons count as consent.
    const removalRequestRepository = getRepository(MediaRemovalRequest);
    const otherRemovalsForMedia = await removalRequestRepository.find({
      where: {
        media: { id: media.id },
        is4k: this.is4k,
        id: Not(this.id),
        status: In([
          MediaRemovalRequestStatus.APPROVED,
          MediaRemovalRequestStatus.PARTIALLY_REMOVED,
        ]),
      },
      relations: ['requestedBy'],
    });
    const otherRemovals = isSeasonRemoval
      ? otherRemovalsForMedia.filter((r) =>
          (r.seasons ?? []).some((s) => targetSeasons.includes(s))
        )
      : otherRemovalsForMedia;
    const removedRequesterIds = new Set(
      otherRemovals.map((r) => r.requestedBy.id)
    );
    // Include the current requester
    removedRequesterIds.add(this.requestedBy.id);

    // Force removal if the requester used REMOVAL_ALL and has no original MediaRequest
    const isForceRemoval =
      this.requestedBy.hasPermission(
        [Permission.REMOVAL_ALL, Permission.ADMIN],
        { type: 'or' }
      ) && !uniqueRequesterIds.has(this.requestedBy.id);

    // All original requesters accounted for?
    const allRequestersWantRemoval =
      uniqueRequesterIds.size === 0 ||
      [...uniqueRequesterIds].every((id) => removedRequesterIds.has(id));

    const shouldFullyDelete = isForceRemoval || allRequestersWantRemoval;

    // Resolve service settings once
    let serviceSettings;
    if (specificServiceId != null) {
      serviceSettings = isMovie
        ? settings.radarr.find((r) => r.id === specificServiceId)
        : settings.sonarr.find((s) => s.id === specificServiceId);
    }

    if (shouldFullyDelete) {
      // ── Full deletion (current behaviour) ────────────────────────
      if (specificServiceId != null) {
        if (serviceSettings) {
          if (isMovie) {
            const service = new RadarrAPI({
              apiKey: serviceSettings.apiKey,
              url: RadarrAPI.buildUrl(serviceSettings, '/api/v3'),
            });
            await service.removeMovie(media.tmdbId);
          } else {
            const tvdbId = await this.resolveTvdbId(media);
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
        const txMediaRepository = em.getRepository(Media);

        if (isSeasonRemoval) {
          await this.updateSeasonStatuses(em, media);
        } else {
          await txMediaRepository.remove(media);
          logger.info('Media removal request executed successfully', {
            label: 'MediaRemovalRequest',
            mediaId: media.id,
            tmdbId: media.tmdbId,
            requestId: this.id,
          });
        }
      });
    } else {
      // ── Partial removal: keep the media for the remaining requesters ──
      // For full movie/series removals we drop just this user's *arr tag.
      // Season-level requests must NOT touch the (series-level) tag — removing
      // it would wrongly signal the user no longer wants ANY of the series.
      if (!isSeasonRemoval && specificServiceId != null && serviceSettings) {
        if (serviceSettings.tagRequests) {
          await this.removeUserTag(media, serviceSettings, isMovie);
        } else {
          logger.info(
            'tagRequests is disabled; skipping tag removal for partial removal.',
            { label: 'MediaRemovalRequest', requestId: this.id }
          );
        }
      }

      this.status = MediaRemovalRequestStatus.PARTIALLY_REMOVED;
      logger.info('Partial removal: media kept for remaining requesters.', {
        label: 'MediaRemovalRequest',
        mediaId: media.id,
        tmdbId: media.tmdbId,
        requestId: this.id,
        userId: this.requestedBy.id,
        isSeasonRemoval,
      });
    }
  }

  /**
   * Resolve the TVDB ID for a TV show, checking TMDb first then falling back
   * to the stored value.
   */
  private async resolveTvdbId(media: Media): Promise<number> {
    // Prefer the stored TVDB ID to avoid an unnecessary TMDB lookup.
    if (media.tvdbId) {
      return media.tvdbId;
    }
    const tmdb = new TheMovieDb();
    const series = await tmdb.getTvShow({ tvId: media.tmdbId });
    const tvdbId = series.external_ids.tvdb_id;
    if (!tvdbId) {
      throw new Error('TVDB ID not found');
    }
    return tvdbId;
  }

  /**
   * Remove the requesting user's tag from the media in Radarr/Sonarr.
   */
  private async removeUserTag(
    media: Media,
    serviceSettings: DVRSettings,
    isMovie: boolean
  ): Promise<void> {
    const service = isMovie
      ? new RadarrAPI({
          apiKey: serviceSettings.apiKey,
          url: RadarrAPI.buildUrl(serviceSettings, '/api/v3'),
        })
      : new SonarrAPI({
          apiKey: serviceSettings.apiKey,
          url: SonarrAPI.buildUrl(serviceSettings, '/api/v3'),
        });

    const allTags = await service.getTags();
    const userId = this.requestedBy.id;

    // Match by userId prefix (handles both old `id - name` and new `id-name` format)
    const userTag = allTags.find(
      (t) =>
        t.label.startsWith(userId + '-') || t.label.startsWith(userId + ' - ')
    );

    if (!userTag) {
      logger.warn(
        `No tag found for user ${userId} in ${isMovie ? 'Radarr' : 'Sonarr'}; skipping tag removal.`,
        { label: 'MediaRemovalRequest', requestId: this.id }
      );
      return;
    }

    if (isMovie) {
      await (service as RadarrAPI).removeTagFromMovie(media.tmdbId, userTag.id);
    } else {
      const tvdbId = await this.resolveTvdbId(media);
      await (service as SonarrAPI).removeTagFromSeries(tvdbId, userTag.id);
    }
  }

  /**
   * Update season statuses for a season-level removal.
   */
  private async updateSeasonStatuses(
    em: EntityManager,
    media: Media
  ): Promise<void> {
    const seasonRepository = em.getRepository(Season);
    const mediaRepository = em.getRepository(Media);

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
