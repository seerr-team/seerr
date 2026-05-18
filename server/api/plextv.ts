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

type PlexMetadataItem = {
  ratingKey: string;
  guid?: string;
  type: 'movie' | 'show';
  title: string;
  onWatchlist?: boolean;
  Guid?: {
    id: `imdb://tt${number}` | `tmdb://${number}` | `tvdb://${number}`;
  }[];
};
interface MetadataResponse {
  MediaContainer: {
    Metadata?: PlexMetadataItem[];
    Video?: PlexMetadataItem[];
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
      throw new Error('Invalid auth token', { cause: e });
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
      throw new Error('Invalid auth token', { cause: e });
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
            let detailedResponse: MetadataResponse;
            try {
              detailedResponse = await this.getRolling<MetadataResponse>(
                `/library/metadata/${watchlistItem.ratingKey}`,
                {
                  baseURL: 'https://discover.provider.plex.tv',
                }
              );
            } catch (e) {
              if (e.response?.status === 404) {
                logger.warn(
                  `Item with ratingKey ${watchlistItem.ratingKey} not found, it may have been removed from the server.`,
                  { label: 'Plex.TV Metadata API' }
                );
                return null;
              } else {
                throw e;
              }
            }

            const metadata =
              detailedResponse.MediaContainer.Metadata?.[0] ??
              detailedResponse.MediaContainer.Video?.[0];

            if (!metadata) {
              logger.warn(
                `Item with ratingKey ${watchlistItem.ratingKey} returned no metadata, skipping.`,
                { label: 'Plex.TV Metadata API' }
              );
              return null;
            }

            const tmdbString = metadata.Guid?.find((guid) =>
              guid.id.startsWith('tmdb')
            );
            const tvdbString = metadata.Guid?.find((guid) =>
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

      const filteredList = watchlistDetails.filter(
        (detail) => detail?.tmdbId
      ) as PlexWatchlistItem[];

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

  private async getPlexRatingKey(
    tmdbId: number,
    mediaType: 'movie' | 'show',
    clientId: string
  ): Promise<{ ratingKey: string; guid: string | undefined } | null> {
    const type = mediaType === 'movie' ? 1 : 2;
    try {
      const matchesResponse = await this.axios.get<MetadataResponse>(
        `/library/metadata/matches`,
        {
          baseURL: 'https://discover.provider.plex.tv',
          params: { type, guid: `tmdb://${tmdbId}` },
          headers: {
            'X-Plex-Client-Identifier': clientId,
            'X-Plex-Product': 'Seerr',
          },
        }
      );
      const item =
        matchesResponse.data.MediaContainer.Metadata?.[0] ??
        matchesResponse.data.MediaContainer.Video?.[0];
      if (!item?.ratingKey) {
        return null;
      }
      return { ratingKey: item.ratingKey, guid: item.guid };
    } catch (e) {
      logger.debug('Plex metadata match lookup failed', {
        label: 'Plex.TV Metadata API',
        tmdbId,
        mediaType,
        status: e.response?.status,
        message: e.message,
      });
      throw new Error(
        `Plex metadata lookup failed: ${e.response?.status ?? ''} ${e.message}`
      );
    }
  }

  public async isOnPlexWatchlist(
    tmdbId: number,
    mediaType: 'movie' | 'show'
  ): Promise<boolean> {
    const clientId = randomUUID();
    try {
      const match = await this.getPlexRatingKey(tmdbId, mediaType, clientId);
      if (!match) {
        return false;
      }
      const response = await this.axios.get<{
        MediaContainer: {
          UserState?: { watchlistedAt?: number | string }[];
          userState?: { watchlistedAt?: number | string };
        };
      }>(`/library/metadata/${match.ratingKey}/userState`, {
        baseURL: 'https://discover.provider.plex.tv',
        params: { 'X-Plex-Token': this.authToken },
        headers: {
          'X-Plex-Client-Identifier': clientId,
          'X-Plex-Product': 'Seerr',
        },
      });
      const state =
        response.data.MediaContainer.UserState?.[0] ??
        response.data.MediaContainer.userState;
      const watchlistedAt = state?.watchlistedAt;
      return (
        watchlistedAt != null && watchlistedAt !== 0 && watchlistedAt !== '0'
      );
    } catch (e) {
      logger.debug('Plex watchlist status check failed', {
        label: 'Plex.TV Metadata API',
        tmdbId,
        mediaType,
        status: e.response?.status,
        message: e.message,
      });
      return false;
    }
  }

  public async addToPlexWatchlist(
    tmdbId: number,
    mediaType: 'movie' | 'show'
  ): Promise<void> {
    const clientId = randomUUID();
    const match = await this.getPlexRatingKey(tmdbId, mediaType, clientId);
    if (!match) {
      throw new Error(
        `Could not find Plex ratingKey for tmdb://${tmdbId} (${mediaType})`
      );
    }
    const { ratingKey, guid } = match;

    const identifiers = [guid, ratingKey].filter((id): id is string => !!id);
    let lastError: unknown;

    for (const identifier of identifiers) {
      try {
        await this.axios.put('/actions/addToWatchlist', null, {
          baseURL: 'https://discover.provider.plex.tv',
          params: {
            ratingKey: identifier,
            'X-Plex-Token': this.authToken,
          },
          headers: {
            'X-Plex-Client-Identifier': clientId,
            'X-Plex-Product': 'Seerr',
            'Content-Type': undefined,
          },
        });
        lastError = undefined;
        break;
      } catch (e) {
        lastError = e;
        logger.error('Plex addToWatchlist call failed', {
          label: 'Plex.TV Metadata API',
          tmdbId,
          mediaType,
          ratingKey,
          guid,
          attemptedIdentifier: identifier,
          status: e.response?.status,
          data: e.response?.data,
          message: e.message,
        });
      }
    }

    if (lastError) {
      const e = lastError as {
        response?: { status?: number };
        message?: string;
      };
      throw new Error(
        `Plex addToWatchlist failed: ${e.response?.status ?? ''} ${e.message}`
      );
    }

    logger.debug('Added item to Plex watchlist', {
      label: 'Plex.TV Metadata API',
      tmdbId,
      mediaType,
      ratingKey,
      guid,
    });
  }

  public async removeFromPlexWatchlist(
    tmdbId: number,
    mediaType: 'movie' | 'show'
  ): Promise<void> {
    const clientId = randomUUID();
    const match = await this.getPlexRatingKey(tmdbId, mediaType, clientId);
    if (!match) {
      throw new Error(
        `Could not find Plex ratingKey for tmdb://${tmdbId} (${mediaType})`
      );
    }
    const { ratingKey, guid } = match;

    const identifiers = [guid, ratingKey].filter((id): id is string => !!id);
    let lastError: unknown;

    for (const identifier of identifiers) {
      try {
        await this.axios.put('/actions/removeFromWatchlist', null, {
          baseURL: 'https://discover.provider.plex.tv',
          params: {
            ratingKey: identifier,
            'X-Plex-Token': this.authToken,
          },
          headers: {
            'X-Plex-Client-Identifier': clientId,
            'X-Plex-Product': 'Seerr',
            'Content-Type': undefined,
          },
        });
        lastError = undefined;
        break;
      } catch (e) {
        lastError = e;
        logger.error('Plex removeFromWatchlist call failed', {
          label: 'Plex.TV Metadata API',
          tmdbId,
          mediaType,
          ratingKey,
          guid,
          attemptedIdentifier: identifier,
          status: e.response?.status,
          data: e.response?.data,
          message: e.message,
        });
      }
    }

    if (lastError) {
      const e = lastError as {
        response?: { status?: number };
        message?: string;
      };
      throw new Error(
        `Plex removeFromWatchlist failed: ${e.response?.status ?? ''} ${e.message}`
      );
    }

    logger.debug('Removed item from Plex watchlist', {
      label: 'Plex.TV Metadata API',
      tmdbId,
      mediaType,
      ratingKey,
      guid,
    });
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
