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

export interface StreamingCollectionItem extends WatchlistItem {
  rank: number;
  key: string;
}

export interface StreamingCollection {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  items: StreamingCollectionItem[];
}

export interface WatchlistResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: WatchlistItem[];
}

export interface StreamingCollectionsResponse {
  results: StreamingCollection[];
}
