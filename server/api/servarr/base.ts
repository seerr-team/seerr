import ExternalAPI from '@server/api/externalapi';
import type { AvailableCacheIds } from '@server/lib/cache';
import cacheManager from '@server/lib/cache';
import { getSettings, type DVRSettings } from '@server/lib/settings';
import axios from 'axios';

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

interface CommandResponse {
  id: number;
  status:
    | 'queued'
    | 'started'
    | 'completed'
    | 'failed'
    | 'aborted'
    | 'cancelled'
    | 'orphaned';
  result: 'unknown' | 'successful' | 'unsuccessful';
  exception?: string;
}

export const DEFAULT_DOWNLOAD_QUEUE_SIZE = 10;
export const MIN_DOWNLOAD_QUEUE_SIZE = 10;
export const MAX_DOWNLOAD_QUEUE_SIZE = 1000;
const DOWNLOAD_QUEUE_PAGE_SIZE = 100;
const COMMAND_POLL_INTERVAL_MS = 1000;
const COMMAND_TIMEOUT_MS = 30000;

export const validateDownloadQueueSize = (queueSize: unknown): number => {
  if (
    typeof queueSize !== 'number' ||
    !Number.isFinite(queueSize) ||
    !Number.isInteger(queueSize) ||
    queueSize < MIN_DOWNLOAD_QUEUE_SIZE ||
    queueSize > MAX_DOWNLOAD_QUEUE_SIZE
  ) {
    throw new Error(
      `Queue size must be an integer between ${MIN_DOWNLOAD_QUEUE_SIZE} and ${MAX_DOWNLOAD_QUEUE_SIZE}`
    );
  }

  return queueSize;
};

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
    const timeout = getSettings().network.apiRequestTimeout;

    super(
      url,
      {
        apikey: apiKey,
      },
      {
        nodeCache: cacheManager.getCache(cacheName).data,
        timeout,
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
        `[${this.apiName}] Failed to retrieve system status: ${e.message}`,
        { cause: e }
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
        `[${this.apiName}] Failed to retrieve profiles: ${e.message}`,
        { cause: e }
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
        `[${this.apiName}] Failed to retrieve root folders: ${e.message}`,
        { cause: e }
      );
    }
  };

  public async getQueue(
    maxRecords = DEFAULT_DOWNLOAD_QUEUE_SIZE
  ): Promise<(QueueItem & QueueItemAppendT)[]> {
    try {
      const queueSize = validateDownloadQueueSize(maxRecords);
      const records: (QueueItem & QueueItemAppendT)[] = [];
      // Servarr offsets page N by (N - 1) * pageSize. Keep this fixed across
      // requests and trim only the returned records at the configured cap.
      const pageSize = Math.min(DOWNLOAD_QUEUE_PAGE_SIZE, queueSize);
      let totalRecords: number | undefined;

      for (let page = 1; records.length < queueSize; page++) {
        const response = await this.axios.get<QueueResponse<QueueItemAppendT>>(
          `/queue`,
          {
            params: { includeEpisode: true, page, pageSize },
          }
        );
        const queue = response.data;
        if (
          queue.page !== page ||
          !Number.isSafeInteger(queue.totalRecords) ||
          queue.totalRecords < 0 ||
          (totalRecords !== undefined && queue.totalRecords !== totalRecords)
        ) {
          throw new Error('Queue pagination changed during retrieval');
        }
        totalRecords = queue.totalRecords;
        const expected = Math.min(
          pageSize,
          totalRecords - records.length,
          queueSize - records.length
        );
        if (queue.records.length < expected) {
          throw new Error(
            `Queue response contained ${queue.records.length} of ${expected} requested records`
          );
        }
        if (
          queue.records.length > pageSize &&
          records.length + queue.records.length < queueSize
        ) {
          throw new Error('Queue response exceeded the requested page size');
        }
        records.push(...queue.records.slice(0, queueSize - records.length));
        if (records.length >= totalRecords) break;
      }

      return records;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve queue: ${e.message}`,
        { cause: e }
      );
    }
  }

  public getTags = async (): Promise<Tag[]> => {
    try {
      const response = await this.axios.get<Tag[]>(`/tag`);

      return response.data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve tags: ${e.message}`,
        { cause: e }
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
      throw new Error(`[${this.apiName}] Failed to create tag: ${e.message}`, {
        cause: e,
      });
    }
  };

  public renameTag = async ({
    id,
    label,
  }: {
    id: number;
    label: string;
  }): Promise<Tag> => {
    try {
      const response = await this.axios.put<Tag>(`/tag/${id}`, {
        id,
        label,
      });

      return response.data;
    } catch (e) {
      throw new Error(`[${this.apiName}] Failed to rename tag: ${e.message}`, {
        cause: e,
      });
    }
  };

  async refreshMonitoredDownloads({
    pollIntervalMs = COMMAND_POLL_INTERVAL_MS,
    timeoutMs = COMMAND_TIMEOUT_MS,
  }: {
    pollIntervalMs?: number;
    timeoutMs?: number;
  } = {}): Promise<void> {
    const command = await this.runCommand('RefreshMonitoredDownloads', {});
    await this.waitForCommand(command.id, pollIntervalMs, timeoutMs);
  }

  protected async runCommand(
    commandName: string,
    options: Record<string, unknown>
  ): Promise<CommandResponse> {
    try {
      const response = await this.axios.post<CommandResponse>(`/command`, {
        name: commandName,
        ...options,
      });

      return response.data;
    } catch (e) {
      throw new Error(`[${this.apiName}] Failed to run command: ${e.message}`, {
        cause: e,
      });
    }
  }

  private async waitForCommand(
    commandId: number,
    pollIntervalMs: number,
    timeoutMs: number
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (true) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;

      const axiosTimeout = this.axios.defaults.timeout;
      const requestTimeout =
        axiosTimeout && axiosTimeout > 0
          ? Math.min(axiosTimeout, remainingMs)
          : remainingMs;
      let command: CommandResponse;
      try {
        const response = await this.axios.get<CommandResponse>(
          `/command/${commandId}`,
          { timeout: requestTimeout }
        );
        command = response.data;
      } catch (e) {
        if (
          requestTimeout === remainingMs &&
          axios.isAxiosError(e) &&
          (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT')
        ) {
          break;
        }

        throw new Error(
          `[${this.apiName}] Failed to retrieve command ${commandId}: ${e.message}`,
          { cause: e }
        );
      }

      if (Date.now() >= deadline) break;

      if (command.status === 'completed' && command.result === 'successful') {
        return;
      }

      if (
        command.status === 'failed' ||
        command.status === 'aborted' ||
        command.status === 'cancelled' ||
        command.status === 'orphaned' ||
        command.status === 'completed'
      ) {
        throw new Error(
          `[${this.apiName}] Command ${commandId} ${command.status}: ${
            command.exception ?? command.result
          }`
        );
      }

      const delayRemainingMs = deadline - Date.now();
      if (delayRemainingMs <= 0) break;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(pollIntervalMs, delayRemainingMs))
      );
    }

    throw new Error(
      `[${this.apiName}] Command ${commandId} timed out after ${timeoutMs}ms`
    );
  }
}

export default ServarrBase;
