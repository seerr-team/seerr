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

export interface LbArtist {
  artist_credit_name: string;
  artist_mbid: string;
  join_phrase: string;
}

export interface LbTrack {
  artist_mbids: string[];
  artists: LbArtist[];
  length: number;
  name: string;
  position: number;
  recording_mbid: string;
  total_listen_count: number;
  total_user_count: number;
}

export interface LbMedium {
  format: string;
  name: string;
  position: number;
  tracks: LbTrack[];
}

export interface LbListener {
  listen_count: number;
  user_name: string;
}

export interface LbListeningStats {
  artist_mbids: string[];
  artist_name: string;
  caa_id: number;
  caa_release_mbid: string;
  from_ts: number;
  last_updated: number;
  listeners: LbListener[];
  release_group_mbid: string;
  release_group_name: string;
  stats_range: string;
  to_ts: number;
  total_listen_count: number;
  total_user_count: number;
}

/**
 * Response shape for an entry in `GET /1/metadata/release_group/`. The
 * endpoint returns a `Record<mbid, LbAlbumMetadata>` keyed by the queried
 * `release_group_mbids`.
 */
export interface LbAlbumMetadata {
  release_group?: {
    name: string;
    date?: string;
    type?: string;
    caa_id?: number;
    caa_release_mbid?: string;
    rels?: unknown[];
  };
  release?: {
    name: string;
    date?: string;
    type?: string;
    caa_id?: number;
    caa_release_mbid?: string;
    rels?: unknown[];
  };
  artist?: {
    name: string;
    artist_credit_id?: number;
    artists?: {
      area?: string;
      artist_mbid: string;
      begin_year?: number;
      join_phrase?: string;
      name: string;
      rels?: { [key: string]: string };
      type?: string;
    }[];
  };
  tag?: {
    artist?: {
      artist_mbid: string;
      count: number;
      tag: string;
    }[];
    release_group?: {
      count: number;
      genre_mbid?: string;
      tag: string;
    }[];
  };
}

export interface LbArtistRels {
  [key: string]: string;
}

export interface LbArtistTag {
  artist_mbid: string;
  count: number;
  tag: string;
}

export interface LbArtistMetadata {
  area: string;
  artist_mbid: string;
  begin_year: number;
  mbid: string;
  name: string;
  rels: LbArtistRels;
  tag: {
    artist: LbArtistTag[];
  };
  type: string;
}

export interface LbPopularRecording {
  artist_mbids: string[];
  artist_name: string;
  artists: LbArtist[];
  caa_id: number;
  caa_release_mbid: string;
  length: number;
  recording_mbid: string;
  recording_name: string;
  release_color?: {
    blue: number;
    green: number;
    red: number;
  };
  release_mbid: string;
  release_name: string;
  total_listen_count: number;
  total_user_count: number;
}

export interface LbReleaseGroupExtended extends LbReleaseGroup {
  artist_credit_name: string;
  artists: LbArtist[];
  date: string;
  mbid: string;
  type: string;
  name: string;
  secondary_types?: string[];
  total_listen_count: number;
}

/**
 * Response shape for an entry in `GET /1/metadata/artist/`. The endpoint
 * returns an array of entries keyed implicitly by `artist_mbid` for each
 * MBID supplied in the `artist_mbids` query parameter.
 */
export interface LbArtistMetadataLookup {
  artist_mbid: string;
  name: string;
  comment?: string;
  type?: string;
  gender?: string;
  country?: string;
  begin_year?: number;
  end_year?: number;
  area?: string;
  rels?: LbArtistRels;
  tag?: {
    artist?: LbArtistTag[];
  };
}

export interface LbArtistDetails {
  artist: LbArtistMetadata;
  coverArt: string;
  listeningStats: LbListeningStats;
  popularRecordings: LbPopularRecording[];
  releaseGroups: LbReleaseGroupExtended[];
  similarArtists: {
    artists: LbSimilarArtistResponse[];
    topRecordingColor: {
      blue: number;
      green: number;
      red: number;
    };
    topReleaseGroupColor: {
      blue: number;
      green: number;
      red: number;
    };
  };
}

export interface LbTopArtist {
  artist_mbid: string;
  artist_name: string;
  listen_count: number;
}

export interface LbTopArtistsResponse {
  payload: {
    count: number;
    from_ts: number;
    last_updated: number;
    offset: number;
    range: string;
    artists: LbTopArtist[];
    to_ts: number;
  };
}

export interface LbRelease {
  artist_credit_name: string;
  artist_mbids: string[];
  caa_id: number;
  caa_release_mbid: string;
  listen_count: number;
  release_date: string;
  release_group_mbid: string;
  release_group_primary_type: string;
  release_group_secondary_type: string;
  release_mbid: string;
  release_name: string;
  release_tags: string[];
}

export interface LbFreshReleasesResponse {
  payload: {
    releases: LbRelease[];
  };
}
