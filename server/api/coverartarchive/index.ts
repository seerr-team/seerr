import ExternalAPI from '@server/api/externalapi';
import { getRepository } from '@server/datasource';
import MetadataAlbum from '@server/entity/MetadataAlbum';
import cacheManager from '@server/lib/cache';
import logger from '@server/logger';
import { In } from 'typeorm';
import type { CoverArtResponse } from './interfaces';

class CoverArtArchive extends ExternalAPI {
  private static instance: CoverArtArchive;
  private readonly CACHE_TTL = 43200;
  private readonly STALE_THRESHOLD = 30 * 24 * 60 * 60 * 1000;

  public static getInstance(): CoverArtArchive {
    if (!CoverArtArchive.instance) {
      CoverArtArchive.instance = new CoverArtArchive();
    }
    return CoverArtArchive.instance;
  }

  private constructor() {
    super(
      'https://coverartarchive.org',
      {},
      {
        nodeCache: cacheManager.getCache('covertartarchive').data,
        rateLimit: {
          maxRPS: 50,
          id: 'covertartarchive',
        },
      }
    );
  }

  private isMetadataStale(metadata: MetadataAlbum | null): boolean {
    if (!metadata) return true;
    return Date.now() - metadata.updatedAt.getTime() > this.STALE_THRESHOLD;
  }

  private createEmptyResponse(id: string): CoverArtResponse {
    return { images: [], release: `/release/${id}` };
  }

  private createCachedResponse(url: string, id: string): CoverArtResponse {
    return {
      images: [
        {
          approved: true,
          front: true,
          id: 0,
          thumbnails: { 250: url },
        },
      ],
      release: `/release/${id}`,
    };
  }

  public async getCoverArtFromCache(
    id: string
  ): Promise<string | null | undefined> {
    try {
      const metadata = await getRepository(MetadataAlbum).findOne({
        where: { mbAlbumId: id },
        select: ['caaUrl'],
      });
      return metadata?.caaUrl;
    } catch (error) {
      logger.error('Failed to fetch cover art from cache', {
        label: 'CoverArtArchive',
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async getCoverArt(id: string): Promise<CoverArtResponse> {
    try {
      const metadata = await getRepository(MetadataAlbum).findOne({
        where: { mbAlbumId: id },
        select: ['caaUrl', 'updatedAt'],
      });

      if (metadata?.caaUrl) {
        return this.createCachedResponse(metadata.caaUrl, id);
      }

      if (metadata && !this.isMetadataStale(metadata)) {
        return this.createEmptyResponse(id);
      }

      return await this.fetchCoverArt(id);
    } catch (error) {
      logger.error('Failed to get cover art', {
        label: 'CoverArtArchive',
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createEmptyResponse(id);
    }
  }

  private async fetchCoverArt(id: string): Promise<CoverArtResponse> {
    try {
      const data = await this.get<CoverArtResponse>(
        `/release-group/${id}`,
        undefined,
        this.CACHE_TTL
      );

      const releaseMBID = data.release.split('/').pop();

      data.images = data.images.map((image) => {
        const fullUrl = `https://archive.org/download/mbid-${releaseMBID}/mbid-${releaseMBID}-${image.id}_thumb250.jpg`;

        if (image.front) {
          getRepository(MetadataAlbum)
            .upsert(
              { mbAlbumId: id, caaUrl: fullUrl },
              { conflictPaths: ['mbAlbumId'] }
            )
            .catch((e) => {
              logger.error('Failed to save album metadata', {
                label: 'CoverArtArchive',
                error: e instanceof Error ? e.message : 'Unknown error',
              });
            });
        }

        return {
          approved: image.approved,
          front: image.front,
          id: image.id,
          thumbnails: { 250: fullUrl },
        };
      });

      return data;
    } catch (error) {
      await getRepository(MetadataAlbum).upsert(
        { mbAlbumId: id, caaUrl: null },
        { conflictPaths: ['mbAlbumId'] }
      );
      return this.createEmptyResponse(id);
    }
  }

  public async batchGetCoverArt(
    ids: string[]
  ): Promise<Record<string, string | null>> {
    if (!ids.length) return {};

    const metadataRepository = getRepository(MetadataAlbum);
    const existingMetadata = await metadataRepository.find({
      where: { mbAlbumId: In(ids) },
      select: ['mbAlbumId', 'caaUrl', 'updatedAt'],
    });

    const results: Record<string, string | null> = {};
    const idsToFetch: string[] = [];

    ids.forEach((id) => {
      const metadata = existingMetadata.find((m) => m.mbAlbumId === id);

      if (metadata?.caaUrl) {
        results[id] = metadata.caaUrl;
      } else if (metadata && !this.isMetadataStale(metadata)) {
        results[id] = null;
      } else {
        idsToFetch.push(id);
      }
    });

    if (idsToFetch.length > 0) {
      const batchPromises = idsToFetch.map((id) =>
        this.fetchCoverArt(id)
          .then((response) => {
            const frontImage = response.images.find((img) => img.front);
            results[id] = frontImage?.thumbnails?.[250] || null;
            return true;
          })
          .catch(() => {
            results[id] = null;
            return false;
          })
      );

      await Promise.all(batchPromises);
    }

    return results;
  }
}

export default CoverArtArchive;
