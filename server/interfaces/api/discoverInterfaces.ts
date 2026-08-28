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

export interface SeasonalAnimeResult {
  id: number;
  ratingKey: string;
  tmdbId: number;
  mediaType: 'tv';
  title: string;
}

export interface SeasonalAnimeResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SeasonalAnimeResult[];
}
