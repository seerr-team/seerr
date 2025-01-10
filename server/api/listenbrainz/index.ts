import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';
import type {
  LbSimilarArtistResponse,
  LbTopAlbumsResponse,
} from './interfaces';

class ListenBrainzAPI extends ExternalAPI {
  constructor() {
    super(
      'https://api.listenbrainz.org/1',
      {},
      {
        nodeCache: cacheManager.getCache('listenbrainz').data,
        rateLimit: {
          maxRPS: 50,
          id: 'listenbrainz',
        },
      }
    );
  }

  public async getSimilarArtists(
    artistMbid: string,
    options: {
      days?: number;
      session?: number;
      contribution?: number;
      threshold?: number;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<LbSimilarArtistResponse[]> {
    const {
      days = 9000,
      session = 300,
      contribution = 5,
      threshold = 15,
      limit = 50,
      skip = 30,
    } = options;

    return this.getRolling<LbSimilarArtistResponse[]>(
      '/similar-artists/json',
      {
        artist_mbids: artistMbid,
        algorithm: `session_based_days_${days}_session_${session}_contribution_${contribution}_threshold_${threshold}_limit_${limit}_skip_${skip}`,
      },
      43200,
      undefined,
      'https://labs.api.listenbrainz.org'
    );
  }

  public async getTopAlbums({
    offset = 0,
    range = 'week',
    count = 20,
  }: {
    offset?: number;
    range?: string;
    count?: number;
  }): Promise<LbTopAlbumsResponse> {
    return this.get<LbTopAlbumsResponse>(
      '/stats/sitewide/release-groups',
      {
        offset: offset.toString(),
        range,
        count: count.toString(),
      },
      43200
    );
  }
}

export default ListenBrainzAPI;
