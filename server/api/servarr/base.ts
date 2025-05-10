import ExternalAPI from '@server/api/externalapi';
import type { DVRSettings } from '@server/interfaces/settings';
import type { AvailableCacheIds } from '@server/lib/cache';
import cacheManager from '@server/lib/cache';

export interface SystemStatus {
  version: string;
  buildTime: Date;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
  isNetCore: boolean;
  isMono: boolean;
  isLinux: boolean;
  isOsx: boolean;
  isWindows: boolean;
  isDocker: boolean;
  mode: string;
  branch: string;
  authentication: string;
  sqliteVersion: string;
  migrationVersion: number;
  urlBase: string;
  runtimeVersion: string;
  runtimeName: string;
  startTime: Date;
  packageUpdateMechanism: string;
}

export interface RootFolder {
  id: number;
  path: string;
  freeSpace: number;
  totalSpace: number;
  unmappedFolders: {
    name: string;
    path: string;
  }[];
}

export interface QualityProfile {
  id: number;
  name: string;
}

interface QueueItem {
  size: number;
  title: string;
  sizeleft: number;
  timeleft: string;
  estimatedCompletionTime: string;
  status: string;
  trackedDownloadStatus: string;
  trackedDownloadState: string;
  downloadId: string;
  protocol: string;
  downloadClient: string;
  indexer: string;
  id: number;
}

export interface Tag {
  id: number;
  label: string;
}

interface QueueResponse<QueueItemAppendT> {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: (QueueItem & QueueItemAppendT)[];
}

class ServarrBase<QueueItemAppendT> extends ExternalAPI {
  static buildUrl(settings: DVRSettings, path?: string): string {
    return `${settings.useSsl ? 'https' : 'http'}://${settings.hostname}:${
      settings.port
    }${settings.baseUrl ?? ''}${path}`;
  }

  protected apiName: string;

  constructor({
    url,
    apiKey,
    cacheName,
    apiName,
  }: {
    url: string;
    apiKey: string;
    cacheName: AvailableCacheIds;
    apiName: string;
  }) {
    super(
      url,
      {
        apikey: apiKey,
      },
      {
        nodeCache: cacheManager.getCache(cacheName).data,
      }
    );

    this.apiName = apiName;
  }

  public getSystemStatus = async (): Promise<SystemStatus> => {
    try {
      const response = await this.axios.get<SystemStatus>('/system/status');

      return response.data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve system status: ${e.message}`
      );
    }
  };

  public getProfiles = async (): Promise<QualityProfile[]> => {
    try {
      const data = await this.getRolling<QualityProfile[]>(
        `/qualityProfile`,
        undefined,
        3600
      );

      return data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve profiles: ${e.message}`
      );
    }
  };

  public getRootFolders = async (): Promise<RootFolder[]> => {
    try {
      const data = await this.getRolling<RootFolder[]>(
        `/rootfolder`,
        undefined,
        3600
      );

      return data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve root folders: ${e.message}`
      );
    }
  };

  public getQueue = async (): Promise<(QueueItem & QueueItemAppendT)[]> => {
    try {
      const response = await this.axios.get<QueueResponse<QueueItemAppendT>>(
        `/queue`,
        {
          params: {
            includeEpisode: true,
          },
        }
      );

      return response.data.records;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve queue: ${e.message}`
      );
    }
  };

  public getTags = async (): Promise<Tag[]> => {
    try {
      const response = await this.axios.get<Tag[]>(`/tag`);

      return response.data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve tags: ${e.message}`
      );
    }
  };

  public createTag = async ({ label }: { label: string }): Promise<Tag> => {
    try {
      const response = await this.axios.post<Tag>(`/tag`, {
        label,
      });

      return response.data;
    } catch (e) {
      throw new Error(`[${this.apiName}] Failed to create tag: ${e.message}`);
    }
  };

  async refreshMonitoredDownloads(): Promise<void> {
    await this.runCommand('RefreshMonitoredDownloads', {});
  }

  protected async runCommand(
    commandName: string,
    options: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.axios.post(`/command`, {
        name: commandName,
        ...options,
      });
    } catch (e) {
      throw new Error(`[${this.apiName}] Failed to run command: ${e.message}`);
    }
  }
}

export default ServarrBase;
