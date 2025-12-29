import type { User } from '@server/entity/User';
import type { TautulliSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { requestInterceptorFunction } from '@server/utils/customProxyAgent';
import type { AxiosInstance } from 'axios';
import axios from 'axios';
import { uniqWith } from 'lodash';

export interface TautulliHistoryRecord {
  date: number;
  duration: number;
  friendly_name: string;
  full_title: string;
  grandparent_rating_key: number;
  grandparent_title: string;
  original_title: string;
  group_count: number;
  group_ids?: string;
  guid: string;
  ip_address: string;
  live: number;
  machine_id: string;
  media_index: number;
  media_type: string;
  originally_available_at: string;
  parent_media_index: number;
  parent_rating_key: number;
  parent_title: string;
  paused_counter: number;
  percent_complete: number;
  platform: string;
  product: string;
  player: string;
  rating_key: number;
  reference_id?: number;
  row_id?: number;
  session_key?: string;
  started: number;
  state?: string;
  stopped: number;
  thumb: string;
  title: string;
  transcode_decision: string;
  user: string;
  user_id: number;
  watched_status: number;
  year: number;
}

interface TautulliHistoryResponse {
  response: {
    result: string;
    message?: string;
    data: {
      draw: number;
      recordsTotal: number;
      recordsFiltered: number;
      total_duration: string;
      filter_duration: string;
      data: TautulliHistoryRecord[];
    };
  };
}

interface TautulliWatchStats {
  query_days: number;
  total_time: number;
  total_plays: number;
}

interface TautulliWatchStatsResponse {
  response: {
    result: string;
    message?: string;
    data: TautulliWatchStats[];
  };
}

interface TautulliWatchUser {
  friendly_name: string;
  user_id: number;
  user_thumb: string;
  username: string;
  total_plays: number;
  total_time: number;
}

interface TautulliWatchUsersResponse {
  response: {
    result: string;
    message?: string;
    data: TautulliWatchUser[];
  };
}

interface TautulliInfo {
  tautulli_install_type: string;
  tautulli_version: string;
  tautulli_branch: string;
  tautulli_commit: string;
  tautulli_platform: string;
  tautulli_platform_release: string;
  tautulli_platform_version: string;
  tautulli_platform_linux_distro: string;
  tautulli_platform_device_name: string;
  tautulli_python_version: string;
}

interface TautulliInfoResponse {
  response: {
    result: string;
    message?: string;
    data: TautulliInfo;
  };
}

interface TautulliActivitySession {
  thumb?: string | null;
  full_title?: string | null;
  title?: string | null;
  media_type?: string | null;
  year?: number | null;
  progress_percent?: number | null;
  state?: string | null;
  transcode_decision?: string | null;
}

interface TautulliActivityData {
  stream_count: number;
  sessions: TautulliActivitySession[];
}

interface TautulliActivityResponse {
  response: {
    result: string;
    message?: string;
    data?: Partial<TautulliActivityData>;
  };
}

interface TautulliPlaysByDateSeries {
  name?: string;
  label?: string;
  data: number[];
}

interface TautulliPlaysByDateData {
  categories: string[];
  series: TautulliPlaysByDateSeries[];
}

interface TautulliPlaysByDateResponse {
  response: {
    result: string;
    message?: string;
    data?: TautulliPlaysByDateData;
  };
}

interface TautulliHomeStatsRow {
  title?: string;
  year?: number;
  thumb?: string | null;
  total_plays?: number;
  users_watched?: number;
}

interface TautulliHomeStatsResponse {
  response: {
    result: string;
    message?: string;
    data?: {
      rows?: TautulliHomeStatsRow[];
    };
  };
}

class TautulliAPI {
  private axios: AxiosInstance;

  constructor(settings: TautulliSettings) {
    this.axios = axios.create({
      baseURL: `${settings.useSsl ? 'https' : 'http'}://${settings.hostname}:${
        settings.port
      }${settings.urlBase ?? ''}`,
      params: { apikey: settings.apiKey },
    });
    this.axios.interceptors.request.use(requestInterceptorFunction);
  }

  public async getActivity(): Promise<TautulliActivityData> {
    try {
      const res = await this.axios.get<TautulliActivityResponse>('/api/v2', {
        params: { cmd: 'get_activity' },
      });

      const data = res.data.response.data;

      return {
        stream_count: data?.stream_count ?? 0,
        sessions: Array.isArray(data?.sessions) ? data?.sessions ?? [] : [],
      };
    } catch (e) {
      logger.error('Something went wrong fetching Tautulli activity', {
        label: 'Tautulli API',
        errorMessage: e.message,
      });
      throw new Error(`[Tautulli] Failed to fetch activity: ${e.message}`);
    }
  }

  public async getPlaysByDate(
    timeRange: number
  ): Promise<TautulliPlaysByDateData> {
    try {
      const res = await this.axios.get<TautulliPlaysByDateResponse>('/api/v2', {
        params: {
          cmd: 'get_plays_by_date',
          time_range: timeRange,
        },
      });

      const data = res.data.response.data;
      return {
        categories: data?.categories ?? [],
        series: data?.series ?? [],
      };
    } catch (e) {
      logger.error(
        'Something went wrong fetching plays by date from Tautulli',
        {
          label: 'Tautulli API',
          errorMessage: e.message,
        }
      );
      throw new Error(`[Tautulli] Failed to fetch plays by date: ${e.message}`);
    }
  }

  public async getPopular(timeRange: number): Promise<{
    movies: {
      title: string;
      year?: number;
      thumb: string | null;
      plays?: number;
    }[];
    tv: {
      title: string;
      year?: number;
      thumb: string | null;
      plays?: number;
    }[];
  }> {
    try {
      const [moviesRes, tvRes] = await Promise.all([
        this.axios.get<TautulliHomeStatsResponse>('/api/v2', {
          params: {
            cmd: 'get_home_stats',
            stat_id: 'popular_movies',
            stats_count: 10,
            time_range: timeRange,
          },
        }),
        this.axios.get<TautulliHomeStatsResponse>('/api/v2', {
          params: {
            cmd: 'get_home_stats',
            stat_id: 'popular_tv',
            stats_count: 10,
            time_range: timeRange,
          },
        }),
      ]);

      const mapItems = (rows?: TautulliHomeStatsRow[]) =>
        (rows ?? [])
          .map((item) => ({
            title: item.title ?? '',
            year: item.year ?? undefined,
            thumb: item.thumb ?? null,
            plays: item.total_plays ?? item.users_watched ?? undefined,
          }))
          .filter((item) => item.title);

      return {
        movies: mapItems(moviesRes.data.response.data?.rows),
        tv: mapItems(tvRes.data.response.data?.rows),
      };
    } catch (e) {
      logger.error(
        'Something went wrong fetching popular media from Tautulli',
        {
          label: 'Tautulli API',
          errorMessage: e.message,
        }
      );
      throw new Error(`[Tautulli] Failed to fetch popular media: ${e.message}`);
    }
  }

  public async getInfo(): Promise<TautulliInfo> {
    try {
      return (
        await this.axios.get<TautulliInfoResponse>('/api/v2', {
          params: { cmd: 'get_tautulli_info' },
        })
      ).data.response.data;
    } catch (e) {
      logger.error('Something went wrong fetching Tautulli server info', {
        label: 'Tautulli API',
        errorMessage: e.message,
      });
      throw new Error(
        `[Tautulli] Failed to fetch Tautulli server info: ${e.message}`
      );
    }
  }

  public async getMediaWatchStats(
    ratingKey: string
  ): Promise<TautulliWatchStats[]> {
    try {
      return (
        await this.axios.get<TautulliWatchStatsResponse>('/api/v2', {
          params: {
            cmd: 'get_item_watch_time_stats',
            rating_key: ratingKey,
            grouping: 1,
          },
        })
      ).data.response.data;
    } catch (e) {
      logger.error(
        'Something went wrong fetching media watch stats from Tautulli',
        {
          label: 'Tautulli API',
          errorMessage: e.message,
          ratingKey,
        }
      );
      throw new Error(
        `[Tautulli] Failed to fetch media watch stats: ${e.message}`
      );
    }
  }

  public async getMediaWatchUsers(
    ratingKey: string
  ): Promise<TautulliWatchUser[]> {
    try {
      return (
        await this.axios.get<TautulliWatchUsersResponse>('/api/v2', {
          params: {
            cmd: 'get_item_user_stats',
            rating_key: ratingKey,
            grouping: 1,
          },
        })
      ).data.response.data;
    } catch (e) {
      logger.error(
        'Something went wrong fetching media watch users from Tautulli',
        {
          label: 'Tautulli API',
          errorMessage: e.message,
          ratingKey,
        }
      );
      throw new Error(
        `[Tautulli] Failed to fetch media watch users: ${e.message}`
      );
    }
  }

  public async getUserWatchStats(user: User): Promise<TautulliWatchStats> {
    try {
      if (!user.plexId) {
        throw new Error('User does not have an associated Plex ID');
      }

      return (
        await this.axios.get<TautulliWatchStatsResponse>('/api/v2', {
          params: {
            cmd: 'get_user_watch_time_stats',
            user_id: user.plexId,
            query_days: 0,
            grouping: 1,
          },
        })
      ).data.response.data[0];
    } catch (e) {
      logger.error(
        'Something went wrong fetching user watch stats from Tautulli',
        {
          label: 'Tautulli API',
          errorMessage: e.message,
          user: user.displayName,
        }
      );
      throw new Error(
        `[Tautulli] Failed to fetch user watch stats: ${e.message}`
      );
    }
  }

  public async getUserWatchHistory(
    user: User
  ): Promise<TautulliHistoryRecord[]> {
    let results: TautulliHistoryRecord[] = [];

    try {
      if (!user.plexId) {
        throw new Error('User does not have an associated Plex ID');
      }

      const take = 100;
      let start = 0;

      while (results.length < 20) {
        const tautulliData = (
          await this.axios.get<TautulliHistoryResponse>('/api/v2', {
            params: {
              cmd: 'get_history',
              grouping: 1,
              order_column: 'date',
              order_dir: 'desc',
              user_id: user.plexId,
              media_type: 'movie,episode',
              length: take,
              start,
            },
          })
        ).data.response.data.data;

        if (!tautulliData.length) {
          return results;
        }

        results = uniqWith(results.concat(tautulliData), (recordA, recordB) =>
          recordA.grandparent_rating_key && recordB.grandparent_rating_key
            ? recordA.grandparent_rating_key === recordB.grandparent_rating_key
            : recordA.parent_rating_key && recordB.parent_rating_key
            ? recordA.parent_rating_key === recordB.parent_rating_key
            : recordA.rating_key === recordB.rating_key
        );

        start += take;
      }

      return results.slice(0, 20);
    } catch (e) {
      logger.error(
        'Something went wrong fetching user watch history from Tautulli',
        {
          label: 'Tautulli API',
          errorMessage: e.message,
          user: user.displayName,
        }
      );
      throw new Error(
        `[Tautulli] Failed to fetch user watch history: ${e.message}`
      );
    }
  }
}

export default TautulliAPI;
