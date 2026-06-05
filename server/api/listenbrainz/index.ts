import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';
import { getSettings, type ListenBrainzSettings } from '@server/lib/settings';
import type {
  LbAlbumMetadata,
  LbArtistMetadataLookup,
  LbFreshReleasesResponse,
  LbTopAlbumsResponse,
  LbTopArtistsResponse,
} from './interfaces';

/**
 * Normalize a user-supplied ListenBrainz API base URL so it always points at
 * the versioned API root. Accepts host-only URLs (e.g.
 * "https://api.listenbrainz.org") and fully-qualified ones (e.g.
 * "https://api.listenbrainz.org/1"); appends "/1" when no "/<digits>" suffix
 * is present.
 */
export const resolveListenBrainzApiUrl = (apiBaseUrl: string): string => {
  const trimmed = (apiBaseUrl || 'https://api.listenbrainz.org').replace(
    /\/+$/,
    ''
  );
  if (/\/\d+$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}/1`;
};

/**
 * Normalize a user-supplied ListenBrainz web base URL. The web endpoints
 * live at the host root, so we only strip trailing slashes (and fall back to
 * the public site when no value is configured).
 */
export const resolveListenBrainzWebUrl = (webBaseUrl: string): string => {
  return (webBaseUrl || 'https://listenbrainz.org').replace(/\/+$/, '');
};

class ListenBrainzAPI extends ExternalAPI {
  private webBaseUrl: string;

  constructor(overrideSettings?: ListenBrainzSettings) {
    const listenbrainz =
      overrideSettings ?? getSettings().musicMetadata.listenbrainz;
    const headers: Record<string, string> = {};
    if (listenbrainz.userToken) {
      headers.Authorization = `Token ${listenbrainz.userToken}`;
    }
    super(
      resolveListenBrainzApiUrl(listenbrainz.apiBaseUrl),
      {},
      {
        headers,
        nodeCache: cacheManager.getCache('listenbrainz').data,
        rateLimit: {
          maxRequests: 20,
          maxRPS: 25,
        },
      }
    );
    this.webBaseUrl = resolveListenBrainzWebUrl(listenbrainz.webBaseUrl);
  }

  /**
   * Look up release-group metadata via the documented
   * `GET /1/metadata/release_group/` endpoint. Returns the entry for the
   * requested MBID, or `null` if the upstream service has no record of it.
   */
  public async getAlbum(mbid: string): Promise<LbAlbumMetadata | null> {
    try {
      const data = await this.get<Record<string, LbAlbumMetadata>>(
        '/metadata/release_group/',
        {
          params: {
            release_group_mbids: mbid,
            inc: 'artist tag release',
          },
        },
        43200
      );
      return data?.[mbid] ?? null;
    } catch (e) {
      throw new Error(
        `[ListenBrainz] Failed to fetch album details: ${
          e instanceof Error ? e.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Look up artist metadata via the documented `GET /1/metadata/artist/`
   * endpoint. Returns the first entry for the requested MBID, or `null` if
   * the upstream service has no record of it.
   */
  public async getArtist(mbid: string): Promise<LbArtistMetadataLookup | null> {
    try {
      const data = await this.get<LbArtistMetadataLookup[]>(
        '/metadata/artist/',
        {
          params: {
            artist_mbids: mbid,
            inc: 'tag',
          },
        },
        43200
      );
      return Array.isArray(data)
        ? (data.find((entry) => entry?.artist_mbid === mbid) ?? data[0] ?? null)
        : null;
    } catch (e) {
      throw new Error(
        `[ListenBrainz] Failed to fetch artist details: ${
          e instanceof Error ? e.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Absolute URL to the ListenBrainz website page for an album. Useful for
   * "View on ListenBrainz" links — the underlying page is HTML, not JSON.
   */
  public getAlbumWebUrl(mbid: string): string {
    return `${this.webBaseUrl}/album/${mbid}`;
  }

  /**
   * Absolute URL to the ListenBrainz website page for an artist.
   */
  public getArtistWebUrl(mbid: string): string {
    return `${this.webBaseUrl}/artist/${mbid}`;
  }

  public async getTopAlbums({
    offset = 0,
    range = 'month',
    count = 20,
  }: {
    offset?: number;
    range?: string;
    count?: number;
  } = {}): Promise<LbTopAlbumsResponse> {
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
  } = {}): Promise<LbTopArtistsResponse> {
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
