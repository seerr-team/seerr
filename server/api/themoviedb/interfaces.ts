interface TmdbMediaResult {
  id: number;
  media_type: string;
  popularity: number;
  poster_path?: string;
  backdrop_path?: string;
  vote_count: number;
  vote_average: number;
  genre_ids: number[];
  overview: string;
  original_language: string;
}

export interface TmdbMovieResult extends TmdbMediaResult {
  media_type: 'movie';
  title: string;
  original_title: string;
  release_date: string;
  adult: boolean;
  video: boolean;
}

export interface TmdbTvResult extends TmdbMediaResult {
  media_type: 'tv';
  name: string;
  original_name: string;
  origin_country: string[];
  first_air_date: string;
}

export interface TmdbCollectionResult {
  id: number;
  media_type: 'collection';
  title: string;
  original_title: string;
  adult: boolean;
  poster_path?: string;
  backdrop_path?: string;
  overview: string;
  original_language: string;
}

export interface TmdbPersonResult {
  id: number;
  name: string;
  popularity: number;
  profile_path?: string;
  adult: boolean;
  media_type: 'person';
  known_for: (TmdbMovieResult | TmdbTvResult)[];
}

interface TmdbPaginatedResponse {
  page: number;
  total_results: number;
  total_pages: number;
}

export interface TmdbSearchMultiResponse extends TmdbPaginatedResponse {
  results: (
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
  )[];
}

export interface TmdbSearchMovieResponse extends TmdbPaginatedResponse {
  results: TmdbMovieResult[];
}

export interface TmdbSearchTvResponse extends TmdbPaginatedResponse {
  results: TmdbTvResult[];
}

export interface TmdbUpcomingMoviesResponse extends TmdbPaginatedResponse {
  dates: {
    maximum: string;
    minimum: string;
  };
  results: TmdbMovieResult[];
}

export interface TmdbExternalIdResponse {
  movie_results: TmdbMovieResult[];
  tv_results: TmdbTvResult[];
  person_results: TmdbPersonResult[];
}

export interface TmdbCreditCast {
  cast_id: number;
  character: string;
  credit_id: string;
  gender?: number;
  id: number;
  name: string;
  order: number;
  profile_path?: string;
}

export interface TmdbAggregateCreditCast extends TmdbCreditCast {
  roles: {
    credit_id: string;
    character: string;
    episode_count: number;
  }[];
}

export interface TmdbCreditCrew {
  credit_id: string;
  gender?: number;
  id: number;
  name: string;
  profile_path?: string;
  job: string;
  department: string;
}

export interface TmdbExternalIds {
  imdb_id?: string;
  freebase_mid?: string;
  freebase_id?: string;
  tvdb_id?: number;
  tvrage_id?: string;
  facebook_id?: string;
  instagram_id?: string;
  twitter_id?: string;
}

export interface TmdbProductionCompany {
  id: number;
  logo_path?: string;
  name: string;
  origin_country: string;
  homepage?: string;
  headquarters?: string;
  description?: string;
}

export interface TmdbMovieDetails {
  id: number;
  imdb_id?: string;
  adult: boolean;
  backdrop_path?: string;
  poster_path?: string;
  budget: number;
  genres: {
    id: number;
    name: string;
  }[];
  homepage?: string;
  original_language: string;
  original_title: string;
  overview?: string;
  popularity: number;
  production_companies: TmdbProductionCompany[];
  production_countries: {
    iso_3166_1: string;
    name: string;
  }[];
  release_date: string;
  release_dates: TmdbMovieReleaseResult;
  revenue: number;
  runtime?: number;
  spoken_languages: {
    iso_639_1: string;
    name: string;
  }[];
  status: string;
  tagline?: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  credits: {
    cast: TmdbCreditCast[];
    crew: TmdbCreditCrew[];
  };
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path?: string;
    backdrop_path?: string;
  };
  external_ids: TmdbExternalIds;
  videos: TmdbVideoResult;
  'watch/providers'?: {
    id: number;
    results?: { [iso_3166_1: string]: TmdbWatchProviders };
  };
  keywords: {
    keywords: TmdbKeyword[];
  };
}

export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: 'YouTube';
  size: number;
  type:
    | 'Clip'
    | 'Teaser'
    | 'Trailer'
    | 'Featurette'
    | 'Opening Credits'
    | 'Behind the Scenes'
    | 'Bloopers';
}

export interface TmdbTvEpisodeResult {
  id: number;
  air_date: string | null;
  episode_number: number;
  name: string;
  overview: string;
  production_code: string;
  season_number: number;
  show_id: number;
  still_path: string;
  vote_average: number;
  vote_count: number;
}

export interface TmdbTvSeasonResult {
  id: number;
  air_date: string;
  episode_count: number;
  name: string;
  overview: string;
  poster_path?: string;
  season_number: number;
}

export interface TmdbTvDetails {
  id: number;
  backdrop_path?: string;
  content_ratings: TmdbTvRatingResult;
  created_by: {
    id: number;
    credit_id: string;
    name: string;
    gender: number;
    profile_path?: string;
  }[];
  episode_run_time: number[];
  first_air_date: string;
  genres: {
    id: number;
    name: string;
  }[];
  homepage: string;
  in_production: boolean;
  languages: string[];
  last_air_date: string;
  last_episode_to_air?: TmdbTvEpisodeResult;
  name: string;
  next_episode_to_air?: TmdbTvEpisodeResult;
  networks: TmdbNetwork[];
  number_of_episodes: number;
  number_of_seasons: number;
  origin_country: string[];
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path?: string;
  production_companies: {
    id: number;
    logo_path?: string;
    name: string;
    origin_country: string;
  }[];
  production_countries: {
    iso_3166_1: string;
    name: string;
  }[];
  spoken_languages: {
    english_name: string;
    iso_639_1: string;
    name: string;
  }[];
  seasons: TmdbTvSeasonResult[];
  status: string;
  tagline?: string;
  type: string;
  vote_average: number;
  vote_count: number;
  aggregate_credits: {
    cast: TmdbAggregateCreditCast[];
  };
  credits: {
    crew: TmdbCreditCrew[];
  };
  external_ids: TmdbExternalIds;
  keywords: {
    results: TmdbKeyword[];
  };
  videos: TmdbVideoResult;
  'watch/providers'?: {
    id: number;
    results?: { [iso_3166_1: string]: TmdbWatchProviders };
  };
}

export interface TmdbVideoResult {
  results: TmdbVideo[];
}

export interface TmdbTvRatingResult {
  results: TmdbRating[];
}

export interface TmdbRating {
  iso_3166_1: string;
  rating: string;
}

export interface TmdbMovieReleaseResult {
  results: TmdbRelease[];
}

export interface TmdbRelease extends TmdbRating {
  release_dates: {
    certification: string;
    iso_639_1?: string;
    note?: string;
    release_date: string;
    type: number;
  }[];
}

export interface TmdbKeyword {
  id: number;
  name: string;
}

export interface TmdbPersonDetails {
  id: number;
  name: string;
  birthday: string;
  deathday: string;
  known_for_department: string;
  also_known_as?: string[];
  gender: number;
  biography: string;
  popularity: number;
  place_of_birth?: string;
  profile_path?: string;
  adult: boolean;
  imdb_id?: string;
  homepage?: string;
}

export interface TmdbPersonCredit {
  id: number;
  original_language: string;
  episode_count: number;
  overview: string;
  origin_country: string[];
  original_name: string;
  vote_count: number;
  name: string;
  media_type?: string;
  popularity: number;
  credit_id: string;
  backdrop_path?: string;
  first_air_date: string;
  vote_average: number;
  genre_ids?: number[];
  poster_path?: string;
  original_title: string;
  video?: boolean;
  title: string;
  adult: boolean;
  release_date: string;
}

export interface TmdbPersonCreditCast extends TmdbPersonCredit {
  character: string;
}

export interface TmdbPersonCreditCrew extends TmdbPersonCredit {
  department: string;
  job: string;
}

export interface TmdbPersonCombinedCredits {
  id: number;
  cast: TmdbPersonCreditCast[];
  crew: TmdbPersonCreditCrew[];
}

export interface TmdbSeasonWithEpisodes
  extends Omit<TmdbTvSeasonResult, 'episode_count'> {
  episodes: TmdbTvEpisodeResult[];
  external_ids: TmdbExternalIds;
}

export interface TmdbCollection {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  parts: TmdbMovieResult[];
}

export interface TmdbRegion {
  iso_3166_1: string;
  english_name: string;
}

export interface TmdbLanguage {
  iso_639_1: string;
  english_name: string;
  name: string;
}

export interface TmdbGenresResult {
  genres: TmdbGenre[];
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbNetwork {
  id: number;
  name: string;
  headquarters?: string;
  homepage?: string;
  logo_path?: string;
  origin_country?: string;
}

export interface TmdbWatchProviders {
  link?: string;
  buy?: TmdbWatchProviderDetails[];
  flatrate?: TmdbWatchProviderDetails[];
}

export interface TmdbWatchProviderDetails {
  display_priority?: number;
  logo_path?: string;
  provider_id: number;
  provider_name: string;
}

export interface TmdbKeywordSearchResponse extends TmdbPaginatedResponse {
  results: TmdbKeyword[];
}

// We have production companies, but the company search results return less data
export interface TmdbCompany {
  id: number;
  logo_path?: string;
  name: string;
}

export interface TmdbCompanySearchResponse extends TmdbPaginatedResponse {
  results: TmdbCompany[];
}

export interface TmdbWatchProviderRegion {
  iso_3166_1: string;
  english_name: string;
  native_name: string;
}
