export enum FilterByLanguage {
  SEARCH = 'filterSearch',
  TRENDING = 'filterTrending',
  SIMILAR_SERIES = 'filterSimilarSeries',
  TV_RECOMMENDATIONS = 'filterTvRecommendations',
  SIMILAR_MOVIES = 'filterSimilarMovies',
  MOVIE_RECOMMENDATIONS = 'filterMovieRecommendations',
  TV_UPCOMING = 'filterTvUpcoming',
  UPCOMING_MOVIES = 'filterUpcomingMovies',
  DISCOVER_MOVIES = 'filterDiscoverMovies',
  TV_DISCOVER = 'filterTvDiscover',
  POPULAR_MOVIES = 'filterPopularMovies',
  TV_POPULAR = 'filterTvPopular',
  CUSTOM_SLIDERS = 'filterCustomSliders',
}

type FilterKey =
  | 'filterSearch'
  | 'filterTrending'
  | 'filterSimilarSeries'
  | 'filterSimilarMovies'
  | 'filterTvRecommendations'
  | 'filterMovieRecommendations'
  | 'filterTvUpcoming'
  | 'filterUpcomingMovies'
  | 'filterDiscoverMovies'
  | 'filterTvDiscover'
  | 'filterPopularMovies'
  | 'filterTvPopular'
  | 'filterCustomSliders';

export interface FilterItem {
  key: FilterKey;
  name: string;
}
