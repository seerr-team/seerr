import type {
  MbAlbumDetails,
  MbImage,
  MbLink,
} from '@server/api/musicbrainz/interfaces';
import type Media from '@server/entity/Media';

export interface MusicDetails {
  id: string;
  mbId: string;
  title: string;
  titleSlug?: string;
  overview: string;
  artistId: string;
  type: string;
  releaseDate: string;
  disambiguation: string;
  genres: string[];
  secondaryTypes: string[];
  releases: {
    id: string;
    title: string;
    status: string;
    releaseDate: string;
    trackCount: number;
    country: string[];
    label: string[];
    media: {
      format: string;
      name: string;
      position: number;
    }[];
    tracks: {
      id: string;
      artistId: string;
      trackName: string;
      trackNumber: string;
      trackPosition: number;
      mediumNumber: number;
      durationMs: number;
      recordingId: string;
    }[];
    disambiguation: string;
  }[];
  artist: {
    id: string;
    artistName: string;
    sortName: string;
    type: 'Group' | 'Person';
    disambiguation: string;
    overview: string;
    genres: string[];
    status: string;
    images: MbImage[];
    links: MbLink[];
    rating?: {
      count: number;
      value: number | null;
    };
  };
  images: MbImage[];
  links: MbLink[];
  mediaInfo?: Media;
  onUserWatchlist?: boolean;
}

export const mapMusicDetails = (
  album: MbAlbumDetails,
  media?: Media,
  userWatchlist?: boolean
): MusicDetails => ({
  id: album.id,
  mbId: album.id,
  title: album.title,
  titleSlug: album.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  overview: album.overview,
  artistId: album.artistid,
  type: album.type,
  releaseDate: album.releasedate,
  disambiguation: album.disambiguation,
  genres: album.genres,
  secondaryTypes: album.secondaryTypes ?? [],
  releases: album.releases.map((release) => ({
    id: release.id,
    title: release.title,
    status: release.status,
    releaseDate: release.releasedate,
    trackCount: release.track_count,
    country: release.country,
    label: release.label,
    media: release.media.map((medium) => ({
      format: medium.Format,
      name: medium.Name,
      position: medium.Position,
    })),
    tracks: release.tracks.map((track) => ({
      id: track.id,
      artistId: track.artistid,
      trackName: track.trackname,
      trackNumber: track.tracknumber,
      trackPosition: track.trackposition,
      mediumNumber: track.mediumnumber,
      durationMs: track.durationms,
      recordingId: track.recordingid,
    })),
    disambiguation: release.disambiguation,
  })),
  artist: {
    id: album.artists[0].id,
    artistName: album.artists[0].artistname,
    sortName: album.artists[0].sortname,
    type: album.artists[0].type,
    disambiguation: album.artists[0].disambiguation,
    overview: album.artists[0].overview,
    genres: album.artists[0].genres,
    status: album.artists[0].status,
    images: album.artists[0].images,
    links: album.artists[0].links,
    rating: album.artists[0].rating
      ? {
          count: album.artists[0].rating.Count,
          value: album.artists[0].rating.Value,
        }
      : undefined,
  },
  images: album.images,
  links: album.artists[0].links,
  mediaInfo: media,
  onUserWatchlist: userWatchlist,
});
