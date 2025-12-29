export interface ActivityStatusResponse {
  online: boolean;
  serverName?: string;
  version?: string;
}

export interface ActivitySession {
  title: string;
  mediaType: string;
  thumb: string | null;
  year?: number;
  progressPercent?: number;
  state?: string;
  transcodeDecision?: string;
}

export interface ActivitySessionsResponse {
  streamCount: number;
  sessions: ActivitySession[];
}

export interface PlaysByDateSeries {
  name?: string;
  label?: string;
  data: number[];
}

export interface PlaysByDate {
  categories: string[];
  series: PlaysByDateSeries[];
}

export interface ActivityHistoryResponse {
  playsByDate: PlaysByDate;
}

export interface ActivityPopularItem {
  title: string;
  year?: number;
  thumb: string | null;
  plays?: number;
}

export interface ActivityPopularResponse {
  movies: ActivityPopularItem[];
  tv: ActivityPopularItem[];
}
