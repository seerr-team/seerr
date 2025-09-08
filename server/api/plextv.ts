import type { PlexDevice } from '@server/interfaces/api/plexInterfaces';
import cacheManager from '@server/lib/cache';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { randomUUID } from 'node:crypto';
import xml2js from 'xml2js';
import ExternalAPI from './externalapi';

interface PlexAccountResponse {
  user: PlexUser;
}

interface PlexUser {
  id: number;
  uuid: string;
  email: string;
  joined_at: string;
  username: string;
  title: string;
  thumb: string;
  hasPassword: boolean;
  authToken: string;
  subscription: {
    active: boolean;
    status: string;
    plan: string;
    features: string[];
  };
  roles: {
    roles: string[];
  };
  entitlements: string[];
}

interface ConnectionResponse {
  $: {
    protocol: string;
    address: string;
    port: string;
    uri: string;
    local: string;
  };
}

interface DeviceResponse {
  $: {
    name: string;
    product: string;
    productVersion: string;
    platform: string;
    platformVersion: string;
    device: string;
    clientIdentifier: string;
    createdAt: string;
    lastSeenAt: string;
    provides: string;
    owned: string;
    accessToken?: string;
    publicAddress?: string;
    httpsRequired?: string;
    synced?: string;
    relay?: string;
    dnsRebindingProtection?: string;
    natLoopbackSupported?: string;
    publicAddressMatches?: string;
    presence?: string;
    ownerID?: string;
    home?: string;
    sourceTitle?: string;
  };
  Connection: ConnectionResponse[];
}

interface ServerResponse {
  $: {
    id: string;
    serverId: string;
    machineIdentifier: string;
    name: string;
    lastSeenAt: string;
    numLibraries: string;
    owned: string;
  };
}

interface UsersResponse {
  MediaContainer: {
    User: {
      $: {
        id: string;
        title: string;
        username: string;
        email: string;
        thumb: string;
      };
      Server: ServerResponse[];
    }[];
  };
}

interface WatchlistResponse {
  MediaContainer: {
    totalSize: number;
    Metadata?: {
      ratingKey: string;
    }[];
  };
}

interface MetadataResponse {
  MediaContainer: {
    Metadata: {
      ratingKey: string;
      type: 'movie' | 'show';
      title: string;
      Guid: {
        id: `imdb://tt${number}` | `tmdb://${number}` | `tvdb://${number}`;
      }[];
    }[];
  };
}

export interface PlexWatchlistItem {
  ratingKey: string;
  tmdbId: number;
  tvdbId?: number;
  type: 'movie' | 'show';
  title: string;
}

export interface PlexWatchlistCache {
  etag: string;
  response: WatchlistResponse;
}

class PlexTvAPI extends ExternalAPI {
  private authToken: string;

  constructor(authToken: string) {
    super(
      'https://plex.tv',
      {},
      {
        headers: {
          'X-Plex-Token': authToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        nodeCache: cacheManager.getCache('plextv').data,
      }
    );

    this.authToken = authToken;
  }

  public async getDevices(): Promise<PlexDevice[]> {
    try {
      const devicesResp = await this.axios.get(
        '/api/resources?includeHttps=1',
        {
          transformResponse: [],
          responseType: 'text',
        }
      );
      const parsedXml = await xml2js.parseStringPromise(
        devicesResp.data as DeviceResponse
      );
      return parsedXml?.MediaContainer?.Device?.map((pxml: DeviceResponse) => ({
        name: pxml.$.name,
        product: pxml.$.product,
        productVersion: pxml.$.productVersion,
        platform: pxml.$?.platform,
        platformVersion: pxml.$?.platformVersion,
        device: pxml.$?.device,
        clientIdentifier: pxml.$.clientIdentifier,
        createdAt: new Date(parseInt(pxml.$?.createdAt, 10) * 1000),
        lastSeenAt: new Date(parseInt(pxml.$?.lastSeenAt, 10) * 1000),
        provides: pxml.$.provides.split(','),
        owned: pxml.$.owned == '1' ? true : false,
        accessToken: pxml.$?.accessToken,
        publicAddress: pxml.$?.publicAddress,
        publicAddressMatches:
          pxml.$?.publicAddressMatches == '1' ? true : false,
        httpsRequired: pxml.$?.httpsRequired == '1' ? true : false,
        synced: pxml.$?.synced == '1' ? true : false,
        relay: pxml.$?.relay == '1' ? true : false,
        dnsRebindingProtection:
          pxml.$?.dnsRebindingProtection == '1' ? true : false,
        natLoopbackSupported:
          pxml.$?.natLoopbackSupported == '1' ? true : false,
        presence: pxml.$?.presence == '1' ? true : false,
        ownerID: pxml.$?.ownerID,
        home: pxml.$?.home == '1' ? true : false,
        sourceTitle: pxml.$?.sourceTitle,
        connection: pxml?.Connection?.map((conn: ConnectionResponse) => ({
          protocol: conn.$.protocol,
          address: conn.$.address,
          port: parseInt(conn.$.port, 10),
          uri: conn.$.uri,
          local: conn.$.local == '1' ? true : false,
        })),
      }));
    } catch (e) {
      logger.error('Something went wrong getting the devices from plex.tv', {
        label: 'Plex.tv API',
        errorMessage: e.message,
      });
      throw new Error('Invalid auth token');
    }
  }

  public async getUser(): Promise<PlexUser> {
    try {
      const account = await this.axios.get<PlexAccountResponse>(
        '/users/account.json'
      );

      return account.data.user;
    } catch (e) {
      logger.error(
        `Something went wrong while getting the account from plex.tv: ${e.message}`,
        { label: 'Plex.tv API' }
      );
      throw new Error('Invalid auth token');
    }
  }

  public async checkUserAccess(userId: number): Promise<boolean> {
    const settings = getSettings();

    try {
      if (!settings.plex.machineId) {
        throw new Error('Plex is not configured!');
      }

      const usersResponse = await this.getUsers();

      const users = usersResponse.MediaContainer.User;

      const user = users.find((u) => parseInt(u.$.id) === userId);

      if (!user) {
        throw new Error(
          "This user does not exist on the main Plex account's shared list"
        );
      }

      return !!user.Server?.find(
        (server) => server.$.machineIdentifier === settings.plex.machineId
      );
    } catch (e) {
      logger.error(`Error checking user access: ${e.message}`);
      return false;
    }
  }

  public async getUsers(): Promise<UsersResponse> {
    const response = await this.axios.get('/api/users', {
      transformResponse: [],
      responseType: 'text',
    });

    const parsedXml = (await xml2js.parseStringPromise(
      response.data
    )) as UsersResponse;
    return parsedXml;
  }

  public async getWatchlist({
    offset = 0,
    size = 20,
  }: { offset?: number; size?: number } = {}): Promise<{
    offset: number;
    size: number;
    totalSize: number;
    items: PlexWatchlistItem[];
  }> {
    try {
      const watchlistCache = cacheManager.getCache('plexwatchlist');
      let cachedWatchlist = watchlistCache.data.get<PlexWatchlistCache>(
        this.authToken
      );

      const response = await this.axios.get<WatchlistResponse>(
        '/library/sections/watchlist/all',
        {
          params: {
            'X-Plex-Container-Start': offset,
            'X-Plex-Container-Size': size,
          },
          headers: {
            'If-None-Match': cachedWatchlist?.etag,
          },
          baseURL: 'https://discover.provider.plex.tv',
          validateStatus: (status) => status < 400, // Allow HTTP 304 to return without error
        }
      );

      // If we don't recieve HTTP 304, the watchlist has been updated and we need to update the cache.
      if (response.status >= 200 && response.status <= 299) {
        cachedWatchlist = {
          etag: response.headers.etag,
          response: response.data,
        };

        watchlistCache.data.set<PlexWatchlistCache>(
          this.authToken,
          cachedWatchlist
        );
      }

      const watchlistDetails = await Promise.all(
        (cachedWatchlist?.response.MediaContainer.Metadata ?? []).map(
          async (watchlistItem) => {
            const detailedResponse = await this.getRolling<MetadataResponse>(
              `/library/metadata/${watchlistItem.ratingKey}`,
              {
                baseURL: 'https://discover.provider.plex.tv',
              }
            );

            const metadata = detailedResponse.MediaContainer.Metadata[0];

            const tmdbString = metadata.Guid.find((guid) =>
              guid.id.startsWith('tmdb')
            );
            const tvdbString = metadata.Guid.find((guid) =>
              guid.id.startsWith('tvdb')
            );

            return {
              ratingKey: metadata.ratingKey,
              // This should always be set? But I guess it also cannot be?
              // We will filter out the 0's afterwards
              tmdbId: tmdbString ? Number(tmdbString.id.split('//')[1]) : 0,
              tvdbId: tvdbString
                ? Number(tvdbString.id.split('//')[1])
                : undefined,
              title: metadata.title,
              type: metadata.type,
            };
          }
        )
      );

      const filteredList = watchlistDetails.filter((detail) => detail.tmdbId);

      return {
        offset,
        size,
        totalSize: cachedWatchlist?.response.MediaContainer.totalSize ?? 0,
        items: filteredList,
      };
    } catch (e) {
      logger.error('Failed to retrieve watchlist items', {
        label: 'Plex.TV Metadata API',
        errorMessage: e.message,
      });
      return {
        offset,
        size,
        totalSize: 0,
        items: [],
      };
    }
  }

  public async pingToken() {
    try {
      const response = await this.axios.get('/api/v2/ping', {
        headers: {
          'X-Plex-Client-Identifier': randomUUID(),
        },
      });
      if (!response?.data?.pong) {
        throw new Error('No pong response');
      }
    } catch (e) {
      logger.error('Failed to ping token', {
        label: 'Plex Refresh Token',
        errorMessage: e.message,
      });
    }
  }
}

export default PlexTvAPI;
