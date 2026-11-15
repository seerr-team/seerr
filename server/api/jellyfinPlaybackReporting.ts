import ExternalAPI from '@server/api/externalapi';
import { ApiErrorCode } from '@server/constants/error';
import logger from '@server/logger';
import { ApiError } from '@server/types/error';
import { buildJellyfinAuthHeader } from '@server/utils/jellyfin';

interface CustomQueryResponse {
  columns: string[];
  results: unknown[][];
  message?: string;
}

interface CustomQueryTypoResponse {
  colums: string[]; // typo in the plugin
  results: unknown[][];
  message?: string;
}

export interface JellyfinPlaybackActivityResponse {
  DateCreated: string;
  UserId: string;
  ItemId: string;
  ItemType: 'Episode' | 'Movie';
  PlayDuration: number;
}

interface GetPlaybackActivityOptions {
  sinceDate?: Date;
  userId?: string;
  itemType?: string;
}

class JellyfinPlaybackReportingAPI extends ExternalAPI {
  constructor(jellyfinHost: string, authToken?: string, deviceId?: string) {
    const authHeader = buildJellyfinAuthHeader(authToken, deviceId);

    super(
      jellyfinHost,
      {},
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
  }

  public async getPlaybackActivity({
    sinceDate,
    userId,
    itemType,
  }: GetPlaybackActivityOptions = {}): Promise<
    JellyfinPlaybackActivityResponse[]
  > {
    try {
      const escapeSql = (value: string) => value.replace(/'/g, "''");
      const whereClauses: string[] = [];

      if (sinceDate) {
        whereClauses.push(`DateCreated >= '${sinceDate.toISOString()}'`);
      }
      if (userId) {
        whereClauses.push(`UserId = '${escapeSql(userId)}'`);
      }
      if (itemType) {
        whereClauses.push(`ItemType = '${escapeSql(itemType)}'`);
      }

      const whereSql =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const CustomQueryString = `SELECT DateCreated, UserId, ItemId, ItemType, PlayDuration FROM PlaybackActivity\
        ${whereSql} ORDER BY DateCreated ASC`;

      const playbackActivityResult = await this.post<
        CustomQueryResponse | CustomQueryTypoResponse
      >('/user_usage_stats/submit_custom_query', { CustomQueryString });

      const transformedplaybackActivityResult = this.transformCustomQueryResult(
        playbackActivityResult
      );
      const parsedPlaybackActivityResult =
        this.parseCustomQueryResult<JellyfinPlaybackActivityResponse>(
          transformedplaybackActivityResult
        );

      return parsedPlaybackActivityResult;
    } catch (e) {
      const status = e?.response?.status;
      const pluginMessage = e?.response?.data?.message;

      logger.error(
        `Something went wrong while getting the Playback Activity from the Jellyfin Playback Reporting Plugin: ${e?.message ?? 'Unknown error'}`,
        {
          label: 'Jellyfin Playback Reporting API',
          error: status,
          pluginMessage,
        }
      );

      const errorCode =
        status === 401 || status === 403
          ? ApiErrorCode.InvalidAuthToken
          : ApiErrorCode.Unknown;

      throw new ApiError(status ?? 500, errorCode);
    }
  }

  private transformCustomQueryResult(
    customQueryResult: CustomQueryResponse | CustomQueryTypoResponse
  ): CustomQueryResponse {
    if ('colums' in customQueryResult) {
      return {
        results: customQueryResult.results,
        message: customQueryResult.message,
        columns: customQueryResult.colums,
      };
    }

    return customQueryResult;
  }

  private parseCustomQueryResult<T>(report: CustomQueryResponse): T[] {
    const { columns, results } = report;

    return results.map((row) => {
      const record: Record<string, unknown> = {};
      columns.forEach((columnName, index) => {
        record[columnName] = row[index];
      });

      return record as T;
    });
  }
}

export default JellyfinPlaybackReportingAPI;
