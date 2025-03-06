import type {
  TmdbCollectionResult,
  TmdbMovieDetails,
  TmdbMovieResult,
  TmdbPersonDetails,
  TmdbPersonResult,
  TmdbTvDetails,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';

export const isMovie = (
  movie:
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
): movie is TmdbMovieResult => {
  return (movie as TmdbMovieResult).title !== undefined;
};

export const isPerson = (
  person:
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
): person is TmdbPersonResult => {
  return (person as TmdbPersonResult).known_for !== undefined;
};

export const isCollection = (
  collection:
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
): collection is TmdbCollectionResult => {
  return (collection as TmdbCollectionResult).media_type === 'collection';
};

export const isMovieDetails = (
  movie: TmdbMovieDetails | TmdbTvDetails | TmdbPersonDetails
): movie is TmdbMovieDetails => {
  return (movie as TmdbMovieDetails).title !== undefined;
};

export const isTvDetails = (
  tv: TmdbMovieDetails | TmdbTvDetails | TmdbPersonDetails
): tv is TmdbTvDetails => {
  return (tv as TmdbTvDetails).number_of_seasons !== undefined;
};
