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
  PlayDuration: number;
}

class JellyfinPlaybackReportingAPI extends JellyfinAPI {
  public async getPlaybackActivity(
    sinceDate?: Date,
    userId?: string
  ): Promise<JellyfinPlaybackActivityResponse[]> {
    try {
      const CustomQueryString = `SELECT DateCreated, UserId, ItemId, PlayDuration FROM PlaybackActivity \
                                ${
                                  sinceDate
                                    ? `WHERE DateCreated >= '${sinceDate.toISOString()}'`
                                    : ''
                                }\
                                ${
                                  sinceDate ? `WHERE UserId = '${userId}'` : ''
                                }\
                                ORDER BY DateCreated ASC`;

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
