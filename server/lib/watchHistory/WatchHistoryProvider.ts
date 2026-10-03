import type { UserWatchDataResponse } from '@server/interfaces/api/userInterfaces';

export interface WatchHistoryProvider {
  getUserWatchData(userId: number): Promise<UserWatchDataResponse>;
}
