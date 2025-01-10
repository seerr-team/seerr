import type { MbArtistDetails } from '@server/api/musicbrainz/interfaces';
import type Media from '@server/entity/Media';

export interface ArtistDetailsType {
  id: string;
  name: string;
  type: string;
  overview: string;
  disambiguation: string;
  status: string;
  genres: string[];
  images: {
    CoverType: string;
    Url: string;
  }[];
  links: {
    target: string;
    type: string;
  }[];
  Albums?: {
    id: string;
    title: string;
    type: string;
    releasedate: string;
    images?: {
      CoverType: string;
      Url: string;
    }[];
    mediaInfo?: Media;
    onUserWatchlist?: boolean;
  }[];
}

export const mapArtistDetails = (
  artist: MbArtistDetails
): ArtistDetailsType => ({
  id: artist.id,
  name: artist.artistname,
  type: artist.type,
  overview: artist.overview,
  disambiguation: artist.disambiguation,
  status: artist.status,
  genres: artist.genres,
  images: artist.images,
  links: artist.links,
  Albums: artist.Albums?.map((album) => ({
    id: album.Id.toLowerCase(),
    title: album.Title,
    type: album.Type,
    releasedate: '',
    images: [],
  })),
});
