import JellyfinAPI from '@server/api/jellyfin';
import { ApiErrorCode } from '@server/constants/error';
import logger from '@server/logger';
import { ApiError } from '@server/types/error';

interface CustomQueryResponse {
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

class JellyfinPlaybackReportingAPI extends JellyfinAPI {
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

      const playbackActivityResult = await this.post<CustomQueryResponse>(
        'user_usage_stats/submit_custom_query',
        { CustomQueryString }
      );

      const parsedPlaybackActivityResult =
        this.parseCustomQueryResult<JellyfinPlaybackActivityResponse>(
          playbackActivityResult
        );

      return parsedPlaybackActivityResult;
    } catch (e) {
      logger.error(
        `Something went wrong while getting the Playback Activity from the Jellyfin Playback Reporting Plugin: ${e.message}`,
        { label: 'Jellyfin Playback Reporting API', error: e.response?.status }
      );

      throw new ApiError(e.response?.status, ApiErrorCode.InvalidAuthToken);
    }
  }

  private parseCustomQueryResult<T>(report: CustomQueryResponse): T[] {
    const { colums, results } = report;

    return results.map((row) => {
      const record: Record<string, unknown> = {};
      colums.forEach((columnName, index) => {
        record[columnName] = row[index];
      });

      return record as T;
    });
  }
}

export default JellyfinPlaybackReportingAPI;
