interface MbResult {
  id: string;
  score: number;
}

export interface MbLink {
  type: string;
  target: string;
}

export interface MbAlbumResult extends MbResult {
  // Set by Seerr-side enrichment for downstream consumers; not present in
  // raw MusicBrainz `/release-group` responses.
  media_type?: 'album';
  title: string;
  'primary-type': 'Album' | 'Single' | 'EP';
  'first-release-date': string;
  'artist-credit': {
    name: string;
    artist: {
      id: string;
      name: string;
      'sort-name': string;
      overview?: string;
    };
  }[];
  // Seerr-side enrichment.
  posterPath?: string;
}

export interface MbAlbumDetails extends MbAlbumResult {
  'type-id'?: string;
  'primary-type-id'?: string;
  count?: number;
  'secondary-types'?: string[];
  'secondary-type-ids'?: string[];
  releases?: {
    id: string;
    title: string;
    status: string;
    'status-id': string;
  }[];
  releasedate?: string;
  tags?: {
    count: number;
    name: string;
  }[];
  artists?: {
    id: string;
    name: string;
    overview?: string;
  }[];
  links?: MbLink[];
  // Seerr-side enrichment.
  poster_path?: string;
}

export interface MbArtistResult extends MbResult {
  // Seerr-side enrichment for downstream consumers; not returned by the
  // raw MusicBrainz `/artist` endpoint.
  media_type?: 'artist';
  name: string;
  type: 'Group' | 'Person';
  'sort-name': string;
  country?: string;
  disambiguation?: string;
  artistThumb?: string | null;
  artistBackdrop?: string | null;
}

export interface MbArtistDetails extends MbArtistResult {
  'type-id'?: string;
  area?: {
    id: string;
    name: string;
    type: string;
    'type-id': string;
    'sort-name': string;
  };
  'begin-area'?: {
    id: string;
    name: string;
    type: string;
    'sort-name': string;
  };
  'life-span'?: {
    begin?: string;
    ended: boolean;
  };
  gender?: string;
  'gender-id'?: string;
  isnis?: string[];
  aliases?: {
    name: string;
    'sort-name': string;
    type?: string;
    'type-id'?: string;
  }[];
  tags?: {
    count: number;
    name: string;
  }[];
  links?: MbLink[];
}

export interface MbSearchAlbumResponse {
  created: string;
  count: number;
  offset: number;
  'release-groups': MbAlbumDetails[];
}

export interface MbSearchArtistResponse {
  created: string;
  count: number;
  offset: number;
  artists: MbArtistDetails[];
}

export interface MbSearchMultiResponse {
  created: string;
  count: number;
  offset: number;
  results: (MbArtistResult | MbAlbumResult)[];
}
