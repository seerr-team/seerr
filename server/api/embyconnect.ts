import ExternalAPI from '@server/api/externalapi';
import { ApiErrorCode } from '@server/constants/error';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { ApiError } from '@server/types/error';
import { getAppVersion } from '@server/utils/appVersion';
import { getHostname } from '@server/utils/getHostname';
import { randomUUID } from 'crypto';
import type { JellyfinLoginResponse } from './jellyfin';

export interface ConnectAuthResponse {
  AccessToken: string;
  User: {
    Id: string;
    Name: string;
    Email: string;
    IsActive: string | boolean;
  };
}

export interface LinkedServer {
  Id: string;
  Url: string;
  Name: string;
  SystemId: string;
  AccessKey: string;
  LocalAddress: string;
  UserType: string;
  SupporterKey: string;
}

export interface LocalUserAuthExchangeResponse {
  LocalUserId: string;
  AccessToken: string;
}

export interface EmbyConnectOptions {
  ClientIP?: string;
  DeviceId?: string;
}

const EMBY_CONNECT_URL = 'https://connect.emby.media';
const REQUEST_TIMEOUT = 10000;

class EmbyConnectAPI extends ExternalAPI {
  private ClientIP?: string;
  private DeviceId?: string;

  constructor(options: EmbyConnectOptions = {}) {
    super(
      EMBY_CONNECT_URL,
      {},
      {
        headers: {
          'X-Application': `Seerr/${getAppVersion()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: REQUEST_TIMEOUT,
      }
    );
    this.ClientIP = options.ClientIP;
    this.DeviceId = options.DeviceId;
  }

  public async authenticateConnectUser(Email?: string, Password?: string) {
    logger.debug('Attempting to authenticate via EmbyConnect', {
      label: 'EmbyConnect API',
      ip: this.ClientIP,
    });

    const connectAuthResponse = await this.getConnectUserAccessToken(
      Email,
      Password
    );

    const linkedServers = await this.getValidServers(
      connectAuthResponse.User.Id,
      connectAuthResponse.AccessToken
    );

    const matchingServer = this.findMatchingServer(linkedServers);

    const localUserExchangeResponse = await this.localAuthExchange(
      matchingServer.AccessKey,
      connectAuthResponse.User.Id,
      this.DeviceId
    );

    const isActive = String(connectAuthResponse.User.IsActive) === 'true';

    return {
      User: {
        Name: connectAuthResponse.User.Name,
        Email: isActive ? connectAuthResponse.User.Email : undefined,
        ServerId: matchingServer.SystemId,
        ServerName: matchingServer.Name,
        Id: localUserExchangeResponse.LocalUserId,
        Configuration: {
          GroupedFolders: [],
        },
        Policy: {
          IsAdministrator: false, // Not returned by Emby Connect; only checked during setup, where Connect isn't used
        },
      },
      AccessToken: localUserExchangeResponse.AccessToken,
    } as JellyfinLoginResponse;
  }

  private async getConnectUserAccessToken(
    Email?: string,
    Password?: string
  ): Promise<ConnectAuthResponse> {
    try {
      const response = await this.post<ConnectAuthResponse>(
        '/service/user/authenticate',
        { nameOrEmail: Email, rawpw: Password },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response;
    } catch (e) {
      logger.debug(`Failed to authenticate using EmbyConnect:`, {
        label: 'EmbyConnect API',
        ip: this.ClientIP,
        error: e.message,
      });
      throw new ApiError(
        e.response?.status ?? 401,
        ApiErrorCode.InvalidCredentials
      );
    }
  }

  private async getValidServers(
    ConnectUserId: string,
    AccessToken: string
  ): Promise<LinkedServer[]> {
    try {
      const response = await this.get<LinkedServer[]>(`/service/servers`, {
        params: { userId: ConnectUserId },
        headers: {
          'X-Connect-UserToken': AccessToken,
        },
      });
      return response;
    } catch (e) {
      logger.error(`Failed to retrieve EmbyConnect user server list: `, {
        label: 'EmbyConnect API',
        ip: this.ClientIP,
        error: e.message,
      });
      throw new ApiError(
        e.response?.status ?? 500,
        ApiErrorCode.InvalidAuthToken
      );
    }
  }

  private findMatchingServer(linkedEmbyServers: LinkedServer[]): LinkedServer {
    const settings = getSettings();
    const matchingServer = linkedEmbyServers.find(
      (server) => server.SystemId === settings.jellyfin.serverId
    );

    if (!matchingServer) {
      throw new Error(
        `No matching linked Emby server found for serverId: ${settings.jellyfin.serverId}`
      );
    }

    return matchingServer;
  }

  private async localAuthExchange(
    accessKey: string,
    userId: string,
    deviceId?: string
  ): Promise<LocalUserAuthExchangeResponse> {
    try {
      const params = new URLSearchParams({
        format: 'json',
        ConnectUserId: userId,
      });

      const response = await fetch(
        `${getHostname()}/emby/Connect/Exchange?${params}`,
        {
          headers: {
            Accept: 'application/json',
            'X-Emby-Token': accessKey,
            'X-Emby-Authorization': `MediaBrowser Client="Seerr", Device="Seerr", DeviceId="${deviceId ?? randomUUID()}", Version="1.0.0"`,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        }
      );

      if (!response.ok) {
        throw new Error(response.statusText, { cause: response });
      }

      const result: LocalUserAuthExchangeResponse = await response.json();
      if (!result?.LocalUserId) {
        throw new Error('Invalid Emby Connect exchange response');
      }

      return result;
    } catch (e) {
      logger.debug('Failed local user auth exchange', {
        label: 'EmbyConnect API',
        ip: this.ClientIP,
        error: e.message,
      });
      throw new ApiError(e.cause?.status ?? 500, ApiErrorCode.InvalidAuthToken);
    }
  }
}

export default EmbyConnectAPI;
