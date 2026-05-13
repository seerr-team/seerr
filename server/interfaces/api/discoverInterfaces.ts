export interface GenreSliderItem {
  id: number;
  name: string;
  backdrops: string[];
}

export interface WatchlistItem {
  id: number;
  ratingKey: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
}

export interface WatchlistResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: WatchlistItem[];
}

export interface FavoriteItem {
  id: number;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
}

export interface FavoriteResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: FavoriteItem[];
}
