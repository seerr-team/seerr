import type { LbAlbumDetails } from '@server/api/listenbrainz/interfaces';
import type Media from '@server/entity/Media';

export interface MusicDetails {
  id: string;
  mbId: string;
  title: string;
  titleSlug?: string;
  mediaType: 'album';
  type: string;
  releaseDate: string;
  artist: {
    id: string;
    name: string;
    area?: string;
    beginYear?: number;
    type?: string;
  };
  tracks: {
    name: string;
    position: number;
    length: number;
    recordingMbid: string;
    totalListenCount: number;
    totalUserCount: number;
    artists: {
      name: string;
      mbid: string;
      tmdbMapping?: {
        personId: number;
        profilePath: string;
      };
    }[];
  }[];
  tags?: {
    artist: {
      artistMbid: string;
      count: number;
      tag: string;
    }[];
    releaseGroup: {
      count: number;
      genreMbid: string;
      tag: string;
    }[];
  };
  stats?: {
    totalListenCount: number;
    totalUserCount: number;
    listeners: {
      userName: string;
      listenCount: number;
    }[];
  };
  mediaInfo?: Media;
  onUserWatchlist?: boolean;
  posterPath?: string;
  artistWikipedia?: {
    content: string;
    title: string;
    url: string;
  };
  tmdbPersonId?: number;
  artistBackdrop?: string;
  artistThumb?: string;
}

export const mapMusicDetails = (
  album: LbAlbumDetails,
  media?: Media,
  userWatchlist?: boolean
): MusicDetails => ({
  id: album.release_group_mbid,
  mbId: album.release_group_mbid,
  title: album.release_group_metadata.release_group.name,
  titleSlug: album.release_group_metadata.release_group.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-'),
  mediaType: 'album',
  type: album.type,
  releaseDate: album.release_group_metadata.release_group.date,
  artist: {
    id: album.release_group_metadata.artist.artists[0].artist_mbid,
    name: album.release_group_metadata.artist.name,
    area: album.release_group_metadata.artist.artists[0].area,
    beginYear: album.release_group_metadata.artist.artists[0].begin_year,
    type: album.release_group_metadata.artist.artists[0].type,
  },
  tracks: album.mediums.flatMap((medium) =>
    medium.tracks.map((track) => ({
      name: track.name,
      position: track.position,
      length: track.length,
      recordingMbid: track.recording_mbid,
      totalListenCount: track.total_listen_count,
      totalUserCount: track.total_user_count,
      artists: track.artists.map((artist) => ({
        name: artist.artist_credit_name,
        mbid: artist.artist_mbid,
      })),
    }))
  ),
  tags: {
    artist: album.release_group_metadata.tag.artist.map((tag) => ({
      artistMbid: tag.artist_mbid,
      count: tag.count,
      tag: tag.tag,
    })),
    releaseGroup: album.release_group_metadata.tag.release_group.map((tag) => ({
      count: tag.count,
      genreMbid: tag.genre_mbid,
      tag: tag.tag,
    })),
  },
  stats: {
    totalListenCount: album.listening_stats.total_listen_count,
    totalUserCount: album.listening_stats.total_user_count,
    listeners: album.listening_stats.listeners.map((listener) => ({
      userName: listener.user_name,
      listenCount: listener.listen_count,
    })),
  },
  mediaInfo: media,
  onUserWatchlist: userWatchlist,
});
