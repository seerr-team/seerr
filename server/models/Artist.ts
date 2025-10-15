import type Media from '@server/entity/Media';

export interface ArtistDetails {
  name: string;
  area?: string;
  artist: {
    name: string;
    artist_mbid: string;
    begin_year?: number;
    end_year?: number;
    area?: string;
  };
  alsoKnownAs?: string[];
  biography?: string;
  wikipedia?: {
    content: string;
  };
  artistThumb?: string | null;
  artistBackdrop?: string | null;
  profilePath?: string;
  releaseGroups?: {
    id: string;
    title: string;
    'first-release-date': string;
    'artist-credit': {
      name: string;
    }[];
    'primary-type': string;
    secondary_types?: string[];
    total_listen_count?: number;
    posterPath?: string;
    mediaInfo?: Media;
  }[];
}
