import { getHeader } from '@server/api/hardcover';
import type {
  HardcoverAuthorResult,
  HardcoverBookResult,
} from '@server/api/hardcover/interfaces';
import type {
  TmdbCollectionResult,
  TmdbMovieDetails,
  TmdbMovieResult,
  TmdbPersonDetails,
  TmdbPersonResult,
  TmdbTvDetails,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import { MediaType as MainMediaType } from '@server/constants/media';
import type Media from '@server/entity/Media';

export type MediaType = 'tv' | 'movie' | 'person' | 'collection' | 'book';

interface SearchResult {
  id: number;
  mediaType: MediaType;
  popularity: number;
  posterPath?: string;
  backdropPath?: string;
  voteCount: number;
  voteAverage: number;
  genreIds: number[];
  overview: string;
  originalLanguage: string;
  mediaInfo?: Media;
}

export interface MovieResult extends SearchResult {
  mediaType: 'movie';
  title: string;
  originalTitle: string;
  releaseDate: string;
  adult: boolean;
  video: boolean;
  mediaInfo?: Media;
}

export interface BookResult {
  id: number;
  mediaType: 'book';
  title: string;
  overview: string;
  releaseDate: string;
  posterPath?: string;
  backdropPath?: string;
  position?: number;
  mediaInfo?: Media;
}

export interface TvResult extends SearchResult {
  mediaType: 'tv';
  name: string;
  originalName: string;
  originCountry: string[];
  firstAirDate: string;
}

export interface CollectionResult {
  id: number;
  mediaType: 'collection';
  title: string;
  originalTitle: string;
  adult: boolean;
  posterPath?: string;
  backdropPath?: string;
  overview: string;
  originalLanguage: string;
}

export interface PersonResult {
  id: number;
  name: string;
  popularity: number;
  profilePath?: string;
  adult: boolean;
  mediaType: 'person';
  knownFor: (MovieResult | TvResult)[];
}

export interface AuthorResult {
  id: number;
  name: string;
  image?: string;
  mediaType: 'author';
}

export type Results =
  | MovieResult
  | TvResult
  | PersonResult
  | CollectionResult
  | BookResult
  | AuthorResult;

export const mapMovieResult = (
  movieResult: TmdbMovieResult,
  media?: Media
): MovieResult => ({
  id: movieResult.id,
  mediaType: 'movie',
  adult: movieResult.adult,
  genreIds: movieResult.genre_ids,
  originalLanguage: movieResult.original_language,
  originalTitle: movieResult.original_title,
  overview: movieResult.overview,
  popularity: movieResult.popularity,
  releaseDate: movieResult.release_date,
  title: movieResult.title,
  video: movieResult.video,
  voteAverage: movieResult.vote_average,
  voteCount: movieResult.vote_count,
  backdropPath: movieResult.backdrop_path,
  posterPath: movieResult.poster_path,
  mediaInfo: media,
});

export const mapBookResult = (
  bookResult: HardcoverBookResult,
  media?: Media,
  position?: number
): BookResult => ({
  id: bookResult.id,
  mediaType: 'book',
  title: bookResult.title,
  overview: bookResult.description,
  releaseDate: bookResult.release_date,
  posterPath: bookResult.image?.url
    ? bookResult.image.url
    : `https://assets.hardcover.app/static/covers/cover${
        (bookResult.id % 9) + 1
      }.png`,
  backdropPath: (() => {
    if (bookResult.cached_tags) {
      const header = getHeader(bookResult.cached_tags);
      if (header) {
        return `https://assets.hardcover.app/static/bookHeaders/${header}.webp`;
      }
    }
    return '';
  })(),
  position: position,
  mediaInfo: media,
});

export const mapAuthorResult = (
  authorResult: HardcoverAuthorResult
): AuthorResult => ({
  id: authorResult.id,
  name: authorResult.name,
  image: authorResult?.image?.url,
  mediaType: 'author',
});

export const mapTvResult = (
  tvResult: TmdbTvResult,
  media?: Media
): TvResult => ({
  id: tvResult.id,
  firstAirDate: tvResult.first_air_date,
  genreIds: tvResult.genre_ids,
  // Some results from tmdb dont return the mediaType so we force it here!
  mediaType: tvResult.media_type || 'tv',
  name: tvResult.name,
  originCountry: tvResult.origin_country,
  originalLanguage: tvResult.original_language,
  originalName: tvResult.original_name,
  overview: tvResult.overview,
  popularity: tvResult.popularity,
  voteAverage: tvResult.vote_average,
  voteCount: tvResult.vote_count,
  backdropPath: tvResult.backdrop_path,
  posterPath: tvResult.poster_path,
  mediaInfo: media,
});

export const mapCollectionResult = (
  collectionResult: TmdbCollectionResult
): CollectionResult => ({
  id: collectionResult.id,
  mediaType: collectionResult.media_type || 'collection',
  adult: collectionResult.adult,
  originalLanguage: collectionResult.original_language,
  originalTitle: collectionResult.original_title,
  title: collectionResult.title,
  overview: collectionResult.overview,
  backdropPath: collectionResult.backdrop_path,
  posterPath: collectionResult.poster_path,
});

export const mapPersonResult = (
  personResult: TmdbPersonResult
): PersonResult => ({
  id: personResult.id,
  name: personResult.name,
  popularity: personResult.popularity,
  adult: personResult.adult,
  mediaType: personResult.media_type,
  profilePath: personResult.profile_path,
  knownFor: personResult.known_for.map((result) => {
    if (result.media_type === 'movie') {
      return mapMovieResult(result);
    }

    return mapTvResult(result);
  }),
});

export const mapSearchResults = (
  results: (
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
    | HardcoverBookResult
    | HardcoverAuthorResult
  )[],
  media?: Media[]
): Results[] =>
  results.map((result) => {
    switch (result.media_type) {
      case 'movie':
        return mapMovieResult(
          result,
          media?.find(
            (req) =>
              req.tmdbId === result.id && req.mediaType === MainMediaType.MOVIE
          )
        );
      case 'tv':
        return mapTvResult(
          result,
          media?.find(
            (req) =>
              req.tmdbId === result.id && req.mediaType === MainMediaType.TV
          )
        );
      case 'book':
        return mapBookResult(
          result,
          media?.find(
            (req) =>
              req.hcId === Number(result.id) &&
              req.mediaType === MainMediaType.BOOK
          )
        );
      case 'collection':
        return mapCollectionResult(result);
      case 'person':
        return mapPersonResult(result);
      case 'author':
        return mapAuthorResult(result);
    }
  });

export const mapMovieDetailsToResult = (
  movieDetails: TmdbMovieDetails
): TmdbMovieResult => ({
  id: movieDetails.id,
  media_type: 'movie',
  adult: movieDetails.adult,
  genre_ids: movieDetails.genres.map((genre) => genre.id),
  original_language: movieDetails.original_language,
  original_title: movieDetails.original_title,
  overview: movieDetails.overview ?? '',
  popularity: movieDetails.popularity,
  release_date: movieDetails.release_date,
  title: movieDetails.title,
  video: movieDetails.video,
  vote_average: movieDetails.vote_average,
  vote_count: movieDetails.vote_count,
  backdrop_path: movieDetails.backdrop_path,
  poster_path: movieDetails.poster_path,
});

export const mapTvDetailsToResult = (
  tvDetails: TmdbTvDetails
): TmdbTvResult => ({
  id: tvDetails.id,
  media_type: 'tv',
  first_air_date: tvDetails.first_air_date,
  genre_ids: tvDetails.genres.map((genre) => genre.id),
  name: tvDetails.name,
  origin_country: tvDetails.origin_country,
  original_language: tvDetails.original_language,
  original_name: tvDetails.original_name,
  overview: tvDetails.overview,
  popularity: tvDetails.popularity,
  vote_average: tvDetails.vote_average,
  vote_count: tvDetails.vote_count,
  backdrop_path: tvDetails.backdrop_path,
  poster_path: tvDetails.poster_path,
});

export const mapPersonDetailsToResult = (
  personDetails: TmdbPersonDetails
): TmdbPersonResult => ({
  id: personDetails.id,
  media_type: 'person',
  name: personDetails.name,
  popularity: personDetails.popularity,
  adult: personDetails.adult,
  profile_path: personDetails.profile_path,
  known_for: [],
});
