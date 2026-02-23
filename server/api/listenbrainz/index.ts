import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';
import type {
  LbAlbumDetails,
  LbArtistDetails,
  LbFreshReleasesResponse,
  LbTopAlbumsResponse,
  LbTopArtistsResponse,
} from './interfaces';

class ListenBrainzAPI extends ExternalAPI {
  constructor() {
    super(
      'https://api.listenbrainz.org/1',
      {},
      {
        nodeCache: cacheManager.getCache('listenbrainz').data,
        rateLimit: {
          maxRequests: 20,
          maxRPS: 25,
        },
      }
    );
  }

  public async getAlbum(mbid: string): Promise<LbAlbumDetails> {
    try {
      return await this.post<LbAlbumDetails>(
        `/album/${mbid}`,
        {},
        {
          baseURL: 'https://listenbrainz.org',
        },
        43200
      );
    } catch (e) {
      throw new Error(
        `[ListenBrainz] Failed to fetch album details: ${
          e instanceof Error ? e.message : 'Unknown error'
        }`
      );
    }
  }

  public async getArtist(mbid: string): Promise<LbArtistDetails> {
    try {
      return await this.post<LbArtistDetails>(
        `/artist/${mbid}`,
        {},
        {
          baseURL: 'https://listenbrainz.org',
        },
        43200
      );
    } catch (e) {
      throw new Error(
        `[ListenBrainz] Failed to fetch artist details: ${
          e instanceof Error ? e.message : 'Unknown error'
        }`
      );
    }
  }

  public async getTopAlbums({
    offset = 0,
    range = 'month',
    count = 20,
  }: {
    offset?: number;
    range?: string;
    count?: number;
  }): Promise<LbTopAlbumsResponse> {
    return this.get<LbTopAlbumsResponse>(
      '/stats/sitewide/release-groups',
      {
        params: {
          offset: offset.toString(),
          range,
          count: count.toString(),
        },
      },
      43200
    );
  }

  public async getTopArtists({
    offset = 0,
    range = 'month',
    count = 20,
  }: {
    offset?: number;
    range?: string;
    count?: number;
  }): Promise<LbTopArtistsResponse> {
    return this.get<LbTopArtistsResponse>(
      '/stats/sitewide/artists',
      {
        params: {
          offset: offset.toString(),
          range,
          count: count.toString(),
        },
      },
      43200
    );
  }

  public async getFreshReleases({
    days = 7,
    sort = 'release_date',
    offset = 0,
    count = 20,
  }: {
    days?: number;
    sort?: string;
    offset?: number;
    count?: number;
  } = {}): Promise<LbFreshReleasesResponse> {
    return this.get<LbFreshReleasesResponse>(
      '/explore/fresh-releases',
      {
        params: {
          days: days.toString(),
          sort,
          offset: offset.toString(),
          count: count.toString(),
        },
      },
      43200
    );
  }
}

export default ListenBrainzAPI;
