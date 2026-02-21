import type { PlexDevice } from '@server/interfaces/api/plexInterfaces';
import cacheManager from '@server/lib/cache';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios from 'axios';
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
      Guid?: {
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

interface DiscoverSearchResponse {
  MediaContainer: {
    SearchResults?: {
      SearchResult?: {
        Metadata?: {
          ratingKey: string;
          guid: string;
          type: 'movie' | 'show';
          title: string;
          year?: number;
          Guid?: {
            id: string;
          }[];
        }[];
      }[];
    }[];
  };
}

interface DiscoverMetadataResponse {
  MediaContainer: {
    Metadata?: {
      ratingKey: string;
      guid: string;
      type: 'movie' | 'show';
      title: string;
      Guid?: {
        id: string;
      }[];
    }[];
  };
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

            const metadata = detailedResponse.MediaContainer.Metadata[0];

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

  /**
   * Search Plex Discover for a movie or TV show by title
   */
  public async searchDiscover({
    query,
    type,
  }: {
    query: string;
    type: 'movie' | 'show';
  }): Promise<DiscoverSearchResponse> {
    try {
      const response = await this.axios.get<DiscoverSearchResponse>(
        '/library/search',
        {
          baseURL: 'https://discover.provider.plex.tv',
          params: {
            query,
            searchTypes: type === 'movie' ? 'movies' : 'tv',
            limit: 30,
            searchProviders: 'discover',
            includeMetadata: 1,
            includeGuids: 1,
          },
          headers: {
            Accept: 'application/json',
          },
        }
      );
      return response.data;
    } catch (e) {
      logger.error('Failed to search Plex Discover', {
        label: 'Plex.TV API',
        errorMessage: e.message,
        query,
        type,
      });
      throw e;
    }
  }

  /**
   * Get metadata for a specific ratingKey from Plex Discover
   */
  public async getDiscoverMetadata(
    ratingKey: string
  ): Promise<DiscoverMetadataResponse> {
    try {
      const response = await this.axios.get<DiscoverMetadataResponse>(
        `/library/metadata/${ratingKey}`,
        {
          baseURL: 'https://discover.provider.plex.tv',
          headers: {
            Accept: 'application/json',
          },
        }
      );
      return response.data;
    } catch (e) {
      logger.error('Failed to get Plex Discover metadata', {
        label: 'Plex.TV API',
        errorMessage: e.message,
        ratingKey,
      });
      throw e;
    }
  }

  /**
   * Find the Plex ratingKey for a given TMDB ID by searching Plex Discover
   * This is needed because Plex's watchlist API uses their internal ratingKey,
   * not TMDB IDs directly.
   */
  public async findPlexRatingKeyByTmdbId({
    tmdbId,
    title,
    type,
    year,
  }: {
    tmdbId: number;
    title: string;
    type: 'movie' | 'show';
    year?: number;
  }): Promise<string | null> {
    try {
      // Search for the title
      const searchResponse = await this.searchDiscover({
        query: title,
        type,
      });

      // Look through search results for matching TMDB ID
      const searchResults =
        searchResponse.MediaContainer?.SearchResults?.[0]?.SearchResult;

      if (!searchResults) {
        logger.warn('No search results found in Plex Discover', {
          label: 'Plex.TV API',
          title,
          tmdbId,
        });
        return null;
      }

      // Flatten all metadata from search results
      const allMetadata = searchResults.flatMap(
        (result) => result.Metadata || []
      );

      // Search results don't include Guid array, so we need to fetch metadata for each item
      // to get the external IDs (TMDB, IMDB, etc.)
      for (const item of allMetadata) {
        try {
          // Fetch detailed metadata which includes the Guid array
          const detailedMetadata = await this.getDiscoverMetadata(
            item.ratingKey
          );
          const metadata = detailedMetadata.MediaContainer.Metadata?.[0];

          if (!metadata) continue;

          // Check if this item has the matching TMDB ID
          const tmdbGuid = metadata.Guid?.find((guid) =>
            guid.id.startsWith('tmdb://')
          );

          if (tmdbGuid) {
            const itemTmdbId = parseInt(tmdbGuid.id.replace('tmdb://', ''), 10);
            if (itemTmdbId === tmdbId) {
              // Extract ratingKey from guid (e.g., plex://movie/5d776c -> 5d776c)
              // This matches Python PlexAPI: item.guid.rsplit('/', 1)[-1]
              const ratingKey = metadata.guid.split('/').pop();
              if (ratingKey) {
                logger.info('Found match by TMDB ID', {
                  label: 'Plex.TV API',
                  extractedRatingKey: ratingKey,
                  itemGuid: metadata.guid,
                  tmdbId,
                });
                return ratingKey;
              }
            }
          }
        } catch (e) {
          logger.warn('Failed to fetch metadata for item', {
            label: 'Plex.TV API',
            ratingKey: item.ratingKey,
            errorMessage: e.message,
          });
          // Continue to next item
          continue;
        }
      }

      // If no exact TMDB match, try to match by title and year
      for (const item of allMetadata) {
        if (
          item.title.toLowerCase() === title.toLowerCase() &&
          (!year || item.year === year)
        ) {
          // Extract ratingKey from guid (e.g., plex://movie/5d776c -> 5d776c)
          const ratingKey = item.guid.split('/').pop();
          if (ratingKey) {
            logger.info('Found Plex ratingKey by title match', {
              label: 'Plex.TV API',
              tmdbId,
              extractedRatingKey: ratingKey,
              title: item.title,
            });
            return ratingKey;
          }
        }
      }

      logger.warn('Could not find Plex ratingKey for TMDB ID', {
        label: 'Plex.TV API',
        tmdbId,
        title,
      });
      return null;
    } catch (e) {
      logger.error('Error finding Plex ratingKey', {
        label: 'Plex.TV API',
        errorMessage: e.message,
        tmdbId,
        title,
      });
      return null;
    }
  }

  /**
   * Add an item to the user's Plex watchlist
   * @param ratingKey - The Plex ratingKey (extracted from guid, e.g., 5d776c2296b655001fe27228)
   */
  public async addToWatchlist(ratingKey: string): Promise<void> {
    try {
      // Use a fresh axios instance without any inherited configuration
      // The ExternalAPI's default headers (Content-Type, Accept) cause Plex to return 500 errors
      await axios.put(
        `https://discover.provider.plex.tv/actions/addToWatchlist?ratingKey=${ratingKey}`,
        null,
        {
          headers: {
            'X-Plex-Token': this.authToken,
          },
          timeout: 10000,
        }
      );

      // Invalidate the watchlist cache
      const watchlistCache = cacheManager.getCache('plexwatchlist');
      watchlistCache.data.del(this.authToken);

      logger.info('Added item to Plex watchlist', {
        label: 'Plex.TV API',
        ratingKey,
      });
    } catch (e) {
      logger.error('Failed to add item to Plex watchlist', {
        label: 'Plex.TV API',
        errorMessage: e.message,
        ratingKey,
        responseStatus: e.response?.status,
        responseData: e.response?.data,
      });
      throw e;
    }
  }

  /**
   * Remove an item from the user's Plex watchlist
   */
  public async removeFromWatchlist(ratingKey: string): Promise<void> {
    try {
      // Use a fresh axios instance without any inherited configuration
      await axios.put(
        `https://discover.provider.plex.tv/actions/removeFromWatchlist?ratingKey=${ratingKey}`,
        null,
        {
          headers: {
            'X-Plex-Token': this.authToken,
          },
          timeout: 10000,
        }
      );

      // Invalidate the watchlist cache
      const watchlistCache = cacheManager.getCache('plexwatchlist');
      watchlistCache.data.del(this.authToken);

      logger.info('Removed item from Plex watchlist', {
        label: 'Plex.TV API',
        ratingKey,
      });
    } catch (e) {
      logger.error('Failed to remove item from Plex watchlist', {
        label: 'Plex.TV API',
        errorMessage: e.message,
        ratingKey,
        responseStatus: e.response?.status,
        responseData: e.response?.data,
      });
      throw e;
    }
  }

  /**
   * Add an item to watchlist by TMDB ID (convenience method)
   * This handles the lookup of Plex ratingKey from TMDB ID
   */
  public async addToWatchlistByTmdbId({
    tmdbId,
    title,
    type,
    year,
  }: {
    tmdbId: number;
    title: string;
    type: 'movie' | 'show';
    year?: number;
  }): Promise<boolean> {
    // First check if it's already on the watchlist
    const isAlreadyOnWatchlist = await this.isOnWatchlist(tmdbId);
    if (isAlreadyOnWatchlist) {
      logger.warn('Item is already on watchlist', {
        label: 'Plex.TV API',
        tmdbId,
        title,
      });
      // Return false to indicate it wasn't added (because it's already there)
      return false;
    }

    const ratingKey = await this.findPlexRatingKeyByTmdbId({
      tmdbId,
      title,
      type,
      year,
    });

    if (!ratingKey) {
      logger.error('Cannot add to watchlist: ratingKey not found', {
        label: 'Plex.TV API',
        tmdbId,
        title,
      });
      return false;
    }

    await this.addToWatchlist(ratingKey);
    return true;
  }

  /**
   * Remove an item from watchlist by TMDB ID (convenience method)
   * This finds the item in the current watchlist and removes it
   */
  public async removeFromWatchlistByTmdbId(tmdbId: number): Promise<boolean> {
    try {
      // Paginate through the watchlist to find the item's ratingKey
      const item = await this.findWatchlistItem((i) => i.tmdbId === tmdbId);

      if (!item) {
        logger.warn('Item not found in watchlist', {
          label: 'Plex.TV API',
          tmdbId,
        });
        return false;
      }

      await this.removeFromWatchlist(item.ratingKey);
      return true;
    } catch (e) {
      logger.error('Failed to remove from watchlist by TMDB ID', {
        label: 'Plex.TV API',
        errorMessage: e.message,
        tmdbId,
      });
      return false;
    }
  }

  /**
   * Check if an item is on the user's Plex watchlist
   */
  public async isOnWatchlist(tmdbId: number): Promise<boolean> {
    try {
      const item = await this.findWatchlistItem((i) => i.tmdbId === tmdbId);
      return !!item;
    } catch (e) {
      logger.error('Failed to check watchlist status', {
        label: 'Plex.TV API',
        errorMessage: e.message,
        tmdbId,
      });
      return false;
    }
  }

  /**
   * Paginate through the watchlist to find an item matching the predicate.
   * Uses the default page size to stay within Plex API limits.
   */
  private async findWatchlistItem(
    predicate: (item: PlexWatchlistItem) => boolean
  ): Promise<PlexWatchlistItem | undefined> {
    let offset = 0;
    const size = 20;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.getWatchlist({ offset, size });
      const found = page.items.find(predicate);
      if (found) return found;

      offset += size;
      if (offset >= page.totalSize) break;
    }

    return undefined;
  }
}

export default PlexTvAPI;
