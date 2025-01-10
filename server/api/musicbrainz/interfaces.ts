interface MbMediaResult {
  id: string;
  score: number;
}

export interface MbArtistResult extends MbMediaResult {
  media_type: 'artist';
  artistname: string;
  overview: string;
  disambiguation: string;
  type: 'Group' | 'Person';
  status: string;
  sortname: string;
  genres: string[];
  images: MbImage[];
  links: MbLink[];
  rating?: {
    Count: number;
    Value: number | null;
  };
}

export interface MbAlbumResult extends MbMediaResult {
  media_type: 'album';
  title: string;
  artistid: string;
  artists: MbArtistResult[];
  type: string;
  releasedate: string;
  disambiguation: string;
  genres: string[];
  images: MbImage[];
  secondarytypes: string[];
  overview?: string;
  releases?: {
    id: string;
    track_count?: number;
    title?: string;
    releasedate?: string;
  }[];
}

export interface MbImage {
  CoverType: 'Fanart' | 'Logo' | 'Poster' | 'Cover';
  Url: string;
}

export interface MbLink {
  target: string;
  type: string;
}

export interface MbSearchMultiResponse {
  artist: MbArtistResult | null;
  album: MbAlbumResult | null;
  score: number;
}

export interface MbArtistDetails extends MbArtistResult {
  artistaliases: string[];
  oldids: string[];
  links: MbLink[];
  images: MbImage[];
  rating: {
    Count: number;
    Value: number | null;
  };
  Albums?: Album[];
}

export interface MbAlbumDetails extends MbAlbumResult {
  aliases: string[];
  artists: MbArtistResult[];
  releases: MbRelease[];
  rating: {
    Count: number;
    Value: number | null;
  };
  overview: string;
  secondaryTypes: string[];
}

interface MbRelease {
  id: string;
  title: string;
  status: string;
  releasedate: string;
  country: string[];
  label: string[];
  track_count: number;
  media: MbMedium[];
  tracks: MbTrack[];
  disambiguation: string;
}

interface MbMedium {
  Format: string;
  Name: string;
  Position: number;
}

interface MbTrack {
  id: string;
  artistid: string;
  trackname: string;
  tracknumber: string;
  trackposition: number;
  mediumnumber: number;
  durationms: number;
  recordingid: string;
  oldids: string[];
  oldrecordingids: string[];
}

interface Album {
  Id: string;
  OldIds: string[];
  ReleaseStatuses: string[];
  SecondaryTypes: string[];
  Title: string;
  Type: string;
  images?: {
    CoverType: string;
    Url: string;
  }[];
}
