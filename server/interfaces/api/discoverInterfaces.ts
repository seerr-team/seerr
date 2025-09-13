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

export interface RecentSearchesItem {
  id: number;
  ratingKey: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  createdAt: Date;
}

export interface RecentSearchesResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: RecentSearchesItem[];
}
