import ExternalAPI from '@server/api/externalapi';
import type { IMDBRating } from '@server/api/rating/imdbRadarrProxy';
import cacheManager from '@server/lib/cache';

interface AgregarrRatingResponse {
  imdbId: string;
  rating: number | null;
  votes: number;
}

/**
 * Agregarr hosts a free IMDb ratings proxy that supports both movies and TV.
 * We use it for TV Shows only as Radarr's IMDb ratings proxy is proven and reliable.
 */
class IMDBAgregarrProxy extends ExternalAPI {
  constructor() {
    super(
      'https://api.agregarr.org',
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        nodeCache: cacheManager.getCache('imdb').data,
      }
    );
  }

  public async getTvRatings(imdbId: string): Promise<IMDBRating | null> {
    if (!imdbId) {
      return null;
    }

    try {
      const data = await this.get<AgregarrRatingResponse[]>(
        `/api/ratings?id=${encodeURIComponent(imdbId)}`
      );

      const rating = data?.find((result) => result.imdbId === imdbId);

      if (!rating || rating.rating === null) {
        return null;
      }

      return {
        title: rating.imdbId,
        url: `https://www.imdb.com/title/${rating.imdbId}`,
        criticsScore: rating.rating,
        criticsScoreCount: rating.votes,
      };
    } catch (e) {
      throw new Error(
        `[AGREGARR API] Failed to retrieve TV ratings: ${e.message}`
      );
    }
  }
}

export default IMDBAgregarrProxy;
