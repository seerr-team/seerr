export enum FilterByLanguage {
  SEARCH = 'filterSearch',
  TRENDING = 'filterTrending',
  SIMILAR_SERIES = 'filterSimilarSeries',
  TV_RECOMMENDATIONS = 'filterTvRecommendations',
  SIMILAR_MOVIES = 'filterSimilarMovies',
  MOVIE_RECOMMENDATIONS = 'filterMovieRecommendations',
}

type FilterKey =
  | 'filterSearch'
  | 'filterTrending'
  | 'filterSimilarSeries'
  | 'filterSimilarMovies'
  | 'filterTvRecommendations'
  | 'filterMovieRecommendations';

export interface FilterItem {
  key: FilterKey;
  name: string;
}
