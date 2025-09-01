import JellyfinAPI from '@server/api/jellyfin';
import { ApiErrorCode } from '@server/constants/error';
import logger from '@server/logger';
import { ApiError } from '@server/types/error';

interface CustomQueryResponse {
  colums: string[]; // typo in the plugin
  results: unknown[][];
  message?: string;
}

interface JellyfinPlaybackActivityResponse {
  ItemId: string;
  UserId: string;
  LastPlayed: string;
}

class JellyfinPlaybackReportingAPI extends JellyfinAPI {
  public async getPlaybackActivity(lastScanDate?: Date) {
    try {
      const CustomQueryString = `SELECT ItemId, UserId, MAX(DateCreated) AS LastPlayed FROM PlaybackActivity \
         GROUP BY ItemId, UserId \
         ORDER BY LastPlayed ASC \
         ${
           lastScanDate
             ? `WHERE LastPlayed > ${lastScanDate.toISOString()}`
             : ''
         };`;

      const playbackActivityResult = await this.post<CustomQueryResponse>(
        'user_usage_stats/submit_custom_query',
        { CustomQueryString }
      );

      if (playbackActivityResult.message) {
        throw new Error(playbackActivityResult.message);
      }

      const parsedPlaybackActivityResult =
        this.parseCustomQueryResult<JellyfinPlaybackActivityResponse>(
          playbackActivityResult
        );

      return parsedPlaybackActivityResult;
    } catch (e) {
      logger.error(
        `Something went wrong while getting the Playback Activity from the Jellyfin Playback Reporting Plugin: ${e.message}`,
        { label: 'Jellyfin API', error: e.response?.status }
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
