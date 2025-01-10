import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';
import type { CoverArtResponse } from './interfaces';

class CoverArtArchive extends ExternalAPI {
  constructor() {
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

  public async getCoverArt(id: string): Promise<CoverArtResponse> {
    try {
      const data = await this.get<CoverArtResponse>(
        `/release-group/${id}`,
        undefined,
        43200
      );
      return data;
    } catch (e) {
      throw new Error(
        `[CoverArtArchive] Failed to fetch cover art: ${e.message}`
      );
    }
  }
}

export default CoverArtArchive;
