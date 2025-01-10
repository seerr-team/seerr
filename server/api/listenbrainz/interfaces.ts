export interface LbSimilarArtistResponse {
  artist_mbid: string;
  name: string;
  comment: string;
  type: string | null;
  gender: string | null;
  score: number;
  reference_mbid: string;
}

export interface LbReleaseGroup {
  artist_mbids: string[];
  artist_name: string;
  caa_id: number;
  caa_release_mbid: string;
  listen_count: number;
  release_group_mbid: string;
  release_group_name: string;
}

export interface LbTopAlbumsResponse {
  payload: {
    count: number;
    from_ts: number;
    last_updated: number;
    offset: number;
    range: string;
    release_groups: LbReleaseGroup[];
    to_ts: number;
  };
}
