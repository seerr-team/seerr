import type { PlexDevice } from '@server/interfaces/api/plexInterfaces';
import cacheManager from '@server/lib/cache';
import { getSettings } from '@server/lib/settings';
import { isAllowedByTagRestriction } from '@server/lib/tagrestrictions';
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
    allLibraries?: string;
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
        restricted?: string;
        home?: string;
        // Sharing restrictions, as configured in Plex under
        // Library -> Restrictions. Values are URL encoded, e.g.
        // `label=Family%2CKids` or `label!=Private`.
        filterAll?: string;
        filterMovies?: string;
        filterTelevision?: string;
        filterMusic?: string;
        filterPhotos?: string;
      };
      Server: ServerResponse[];
    }[];
  };
}

/**
 * Label based sharing restrictions for a single library type.
 *
 * A media item is visible to the user when it carries at least one of the
 * `allow` labels (or `allow` is empty, meaning no restriction) and none of
 * the `deny` labels.
 */
export interface PlexLabelFilter {
  allow: string[];
  deny: string[];
  /**
   * Set when the combined restrictions cannot be satisfied by any label, so
   * nothing in the library is visible. Distinguishes that case from an empty
   * `allow` list, which means "no allow restriction".
   */
  allowNothing?: boolean;
}

interface PlexSharedServer {
  $: {
    id: string;
    username: string;
    email: string;
    userID: string;
    machineIdentifier?: string;
    allLibraries?: string;
    owned?: string;
    filterAll?: string;
    filterMovies?: string;
    filterTelevision?: string;
    filterMusic?: string;
    filterPhotos?: string;
  };
  Section?: {
    $: {
      id: string;
      /** Library section key on the server itself, e.g. `1`. */
      key: string;
      title: string;
      type: string;
      shared: string;
    };
  }[];
}

interface SharedServersResponse {
  MediaContainer: {
    SharedServer?: PlexSharedServer[];
  };
}

export interface PlexUserSharingRules {
  /** The user has access to every library on the server. */
  allLibraries: boolean;
  /**
   * Section keys of the libraries actually shared with the user, matching the
   * keys returned by the server's own `/library/sections`. Empty when
   * `allLibraries` is set, since every library is then accessible.
   */
  sharedSectionKeys: string[];
  movies: PlexLabelFilter;
  tv: PlexLabelFilter;
}

const EMPTY_LABEL_FILTER: PlexLabelFilter = { allow: [], deny: [] };

/**
 * Turns a `shared_servers` entry into the restrictions that apply to that user,
 * or `null` when none do.
 */
const parseSharingRules = (
  sharedServer: PlexSharedServer
): PlexUserSharingRules | null => {
  const all = parsePlexLabelFilter(sharedServer.$.filterAll);
  const movies = mergeLabelFilters(
    all,
    parsePlexLabelFilter(sharedServer.$.filterMovies)
  );
  const tv = mergeLabelFilters(
    all,
    parsePlexLabelFilter(sharedServer.$.filterTelevision)
  );

  const allLibraries = sharedServer.$.allLibraries === '1';
  const sharedSectionKeys = allLibraries
    ? []
    : (sharedServer.Section ?? [])
        .filter((section) => section.$.shared === '1')
        .map((section) => section.$.key);

  const hasLabelRestrictions =
    movies.allow.length > 0 ||
    movies.deny.length > 0 ||
    tv.allow.length > 0 ||
    tv.deny.length > 0;

  if (allLibraries && !hasLabelRestrictions) {
    return null;
  }

  return { allLibraries, sharedSectionKeys, movies, tv };
};

/**
 * Decodes a single restriction value. Plex url encodes them, but a malformed
 * sequence must not turn parsing a filter into an exception.
 */
const decodeLabel = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Parses a Plex restriction string into its label allow/deny lists.
 *
 * Plex encodes restrictions as `key=value` clauses, where several values are
 * comma separated and several clauses are separated by `&` or `|`. Only the
 * `label` key is relevant here; other keys (`contentRating`, ...) are ignored.
 */
export const parsePlexLabelFilter = (
  filter?: string | null
): PlexLabelFilter => {
  if (!filter) {
    return { ...EMPTY_LABEL_FILTER };
  }

  const allow: string[] = [];
  const deny: string[] = [];

  // Clauses are split on the raw string, so an encoded `&` or `|` inside a
  // label value is not mistaken for a separator. Values are then decoded before
  // being split on commas, because Plex encodes the comma that separates them.
  for (const clause of filter.split(/[&|]/)) {
    const match = clause.trim().match(/^label(!?)=(.*)$/i);

    if (!match) {
      continue;
    }

    const labels = decodeLabel(match[2])
      .split(',')
      .map((label) => label.trim())
      .filter((label) => label.length > 0);

    (match[1] === '!' ? deny : allow).push(...labels);
  }

  return { allow, deny };
};

/**
 * Combines the server wide restriction (`filterAll`) with a per library type
 * one. Allow lists are intersected when both are set, since the user has to
 * satisfy both, while deny lists simply add up.
 */
const mergeLabelFilters = (
  all: PlexLabelFilter,
  specific: PlexLabelFilter
): PlexLabelFilter => {
  const deny = [...new Set([...all.deny, ...specific.deny])];
  let allow: string[];
  let allowNothing = false;

  if (!all.allow.length) {
    allow = [...specific.allow];
  } else if (!specific.allow.length) {
    allow = [...all.allow];
  } else {
    const specificLower = new Set(
      specific.allow.map((label) => label.toLowerCase())
    );
    allow = all.allow.filter((label) => specificLower.has(label.toLowerCase()));

    // Two allow lists sharing no label cannot both be satisfied. Treating the
    // empty result as "no restriction" would grant access to everything.
    allowNothing = allow.length === 0;
  }

  return { allow: [...new Set(allow)], deny, allowNothing };
};

/**
 * Evaluates label based restrictions against the labels carried by a media
 * item. Items without labels are only visible when no allow list applies.
 */
export const isAllowedByLabelFilter = (
  filter: PlexLabelFilter,
  labels: string[]
): boolean => isAllowedByTagRestriction(filter, labels);

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
  type: 'movie' | 'show';
  title: string;
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

  /**
   * Returns the label based sharing restrictions the server owner configured
   * for a shared user, so availability can be evaluated from that user's point
   * of view instead of the owner's.
   *
   * Returns `null` when no restriction applies, which is the case for the
   * owner, for users sharing every library, and whenever the rules cannot be
   * determined. Callers must treat `null` as "no filtering".
   */
  public async getUserSharingRules(
    plexUserId: number
  ): Promise<PlexUserSharingRules | null> {
    try {
      const sharedServers = await this.getSharedServers();

      // No entry means the library is not shared with this user at all; that
      // case is handled by checkUserAccess() rather than by filtering here.
      const sharedServer = sharedServers?.find(
        (s) => parseInt(s.$.userID) === plexUserId
      );

      return sharedServer ? parseSharingRules(sharedServer) : null;
    } catch (e) {
      logger.error('Failed to retrieve Plex sharing rules for user', {
        label: 'Plex.tv API',
        plexUserId,
        errorMessage: e.message,
      });
      return null;
    }
  }

  /**
   * Returns the sharing rules of every restricted user, keyed by Plex user id.
   *
   * Needed to tell how exclusive a label is before granting it: a label several
   * users are allowed to see cannot be used to give access to one of them
   * alone. Unrestricted users are left out, since they already see everything
   * and applying a label changes nothing for them.
   */
  public async getAllUserSharingRules(): Promise<
    Map<number, PlexUserSharingRules>
  > {
    const rulesByUserId = new Map<number, PlexUserSharingRules>();

    try {
      for (const sharedServer of (await this.getSharedServers()) ?? []) {
        const rules = parseSharingRules(sharedServer);

        if (rules) {
          rulesByUserId.set(parseInt(sharedServer.$.userID), rules);
        }
      }
    } catch (e) {
      logger.error('Failed to retrieve Plex sharing rules', {
        label: 'Plex.tv API',
        errorMessage: e.message,
      });
    }

    return rulesByUserId;
  }

  private async getSharedServers(): Promise<PlexSharedServer[] | undefined> {
    const settings = getSettings();

    if (!settings.plex.machineId) {
      return undefined;
    }

    // `shared_servers` exposes the filters *and* the shared sections in a
    // single call, unlike `/api/users` which only reports a library count.
    const response = await this.axios.get(
      `/api/servers/${settings.plex.machineId}/shared_servers`,
      {
        transformResponse: [],
        responseType: 'text',
      }
    );

    const parsedXml = (await xml2js.parseStringPromise(
      response.data
    )) as SharedServersResponse;

    return parsedXml.MediaContainer.SharedServer;
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
