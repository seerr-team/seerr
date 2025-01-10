interface CoverArtThumbnails {
  1200: string;
  250: string;
  500: string;
  large: string;
  small: string;
}

interface CoverArtImage {
  approved: boolean;
  back: boolean;
  comment: string;
  edit: number;
  front: boolean;
  id: number;
  image: string;
  thumbnails: CoverArtThumbnails;
  types: string[];
}

export interface CoverArtResponse {
  images: CoverArtImage[];
  release: string;
}
