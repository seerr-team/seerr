import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { CoverArtResponse } from './interfaces';

export const COVER_ART_ARCHIVE_BASE_URL = 'https://coverartarchive.org';
export const COVER_ART_ARCHIVE_DEFAULT_MAX_RPS = 50;
export const COVER_ART_ARCHIVE_DEFAULT_MAX_REQUESTS = 20;

class CoverArtArchive extends ExternalAPI {
  // 6 hours, matching the cache's stdTtl and the public docs.
  private readonly CACHE_TTL = 21600;

  constructor() {
    const { coverArtArchive } = getSettings().artworkProviders;
    const maxRPS =
      coverArtArchive.maxRPS > 0
        ? coverArtArchive.maxRPS
        : COVER_ART_ARCHIVE_DEFAULT_MAX_RPS;
    const maxRequests =
      coverArtArchive.maxRequests > 0
        ? coverArtArchive.maxRequests
        : COVER_ART_ARCHIVE_DEFAULT_MAX_REQUESTS;

    super(
      COVER_ART_ARCHIVE_BASE_URL,
      {},
      {
        nodeCache: cacheManager.getCache('coverartarchive').data,
        rateLimit: {
          maxRequests,
          maxRPS,
        },
      }
    );
  }

  private createEmptyResponse(id: string): CoverArtResponse {
    return { images: [], release: `/release/${id}` };
  }

  public async getCoverArt(id: string): Promise<CoverArtResponse> {
    try {
      const data = await this.get<CoverArtResponse>(
        `/release-group/${id}`,
        undefined,
        this.CACHE_TTL
      );

      const releaseMBID = data.release.split('/').pop();

      data.images = data.images.map((image) => {
        const fullUrl = `https://archive.org/download/mbid-${releaseMBID}/mbid-${releaseMBID}-${image.id}_thumb250.jpg`;
        return {
          approved: image.approved,
          front: image.front,
          id: image.id,
          thumbnails: { 250: fullUrl },
        };
      });

      return data;
    } catch (error) {
      logger.error('Failed to fetch cover art', {
        label: 'CoverArtArchive',
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createEmptyResponse(id);
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      // Hit a known release-group MBID (Pink Floyd – The Dark Side of the Moon)
      // to verify the endpoint responds with a valid JSON payload.
      await this.get<CoverArtResponse>(
        '/release-group/f5093c06-23e3-404f-aeaa-40f72885ee3a',
        undefined,
        0
      );
      return true;
    } catch (error) {
      logger.error('Cover Art Archive connection test failed', {
        label: 'CoverArtArchive',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

export default CoverArtArchive;
