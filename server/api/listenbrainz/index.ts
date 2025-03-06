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
          maxRPS: 25,
          id: 'listenbrainz',
        },
      }
    );
  }

  public async getAlbum(mbid: string): Promise<LbAlbumDetails> {
    try {
      return await this.getRolling<LbAlbumDetails>(
        `/album/${mbid}`,
        {},
        43200,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
        'https://listenbrainz.org'
      );
    } catch (e) {
      throw new Error(
        `[ListenBrainz] Failed to fetch album details: ${e.message}`
      );
    }
  }

  public async getArtist(mbid: string): Promise<LbArtistDetails> {
    try {
      return await this.getRolling<LbArtistDetails>(
        `/artist/${mbid}`,
        {},
        43200,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
        'https://listenbrainz.org'
      );
    } catch (e) {
      throw new Error(
        `[ListenBrainz] Failed to fetch artist details: ${e.message}`
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
        offset: offset.toString(),
        range,
        count: count.toString(),
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
        offset: offset.toString(),
        range,
        count: count.toString(),
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
        days: days.toString(),
        sort,
        offset: offset.toString(),
        count: count.toString(),
      },
      43200
    );
  }
}

export default ListenBrainzAPI;
