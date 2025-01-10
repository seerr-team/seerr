import type {
  MbAlbumDetails,
  MbAlbumResult,
  MbArtistDetails,
  MbArtistResult,
  MbImage,
} from '@server/api/musicbrainz/interfaces';
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
export type MediaType =
  | 'tv'
  | 'movie'
  | 'person'
  | 'collection'
  | 'artist'
  | 'album';

interface TmdbSearchResult {
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

interface MbSearchResult {
  id: string;
  mediaType: MediaType;
  score: number;
  mediaInfo?: Media;
}

export interface MovieResult extends TmdbSearchResult {
  mediaType: 'movie';
  title: string;
  originalTitle: string;
  releaseDate: string;
  adult: boolean;
  video: boolean;
  mediaInfo?: Media;
}

export interface TvResult extends TmdbSearchResult {
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

export interface ArtistResult extends MbSearchResult {
  mediaType: 'artist';
  artistname: string;
  overview: string;
  disambiguation: string;
  type: 'Group' | 'Person';
  status: string;
  sortname: string;
  genres: string[];
  images: MbImage[];
  artistimage?: string;
  rating?: {
    Count: number;
    Value: number | null;
  };
  mediaInfo?: Media;
}

export interface AlbumResult extends MbSearchResult {
  mediaType: 'album';
  title: string;
  artistid: string;
  artistname?: string;
  type: string;
  releasedate: string;
  disambiguation: string;
  genres: string[];
  images: MbImage[];
  secondarytypes: string[];
  mediaInfo?: Media;
  overview?: string;
}

export type Results =
  | MovieResult
  | TvResult
  | PersonResult
  | CollectionResult
  | ArtistResult
  | AlbumResult;

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

export const mapArtistResult = (
  artistResult: MbArtistResult,
  media?: Media
): ArtistResult => ({
  id: artistResult.id,
  score: artistResult.score,
  mediaType: 'artist',
  artistname: artistResult.artistname,
  overview: artistResult.overview,
  disambiguation: artistResult.disambiguation,
  type: artistResult.type,
  status: artistResult.status,
  sortname: artistResult.sortname,
  genres: artistResult.genres,
  images: artistResult.images,
  rating: artistResult.rating,
  mediaInfo: media,
});

export const mapAlbumResult = (
  albumResult: MbAlbumResult,
  media?: Media
): AlbumResult => ({
  id: albumResult.id,
  score: albumResult.score,
  mediaType: 'album',
  title: albumResult.title,
  artistid: albumResult.artistid,
  artistname: albumResult.artists?.[0]?.artistname,
  type: albumResult.type,
  releasedate: albumResult.releasedate,
  disambiguation: albumResult.disambiguation,
  genres: albumResult.genres,
  images: albumResult.images,
  secondarytypes: albumResult.secondarytypes,
  mediaInfo: media,
  overview: albumResult.artists?.[0]?.overview,
});

const isTmdbMovie = (
  result:
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
    | MbArtistResult
    | MbAlbumResult
): result is TmdbMovieResult => {
  return result.media_type === 'movie';
};

const isTmdbTv = (
  result:
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
    | MbArtistResult
    | MbAlbumResult
): result is TmdbTvResult => {
  return result.media_type === 'tv';
};

const isTmdbPerson = (
  result:
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
    | MbArtistResult
    | MbAlbumResult
): result is TmdbPersonResult => {
  return result.media_type === 'person';
};

const isTmdbCollection = (
  result:
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
    | MbArtistResult
    | MbAlbumResult
): result is TmdbCollectionResult => {
  return result.media_type === 'collection';
};

const isLidarrArtist = (
  result:
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
    | MbArtistResult
    | MbAlbumResult
): result is MbArtistResult => {
  return result.media_type === 'artist';
};

const isLidarrAlbum = (
  result:
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
    | MbArtistResult
    | MbAlbumResult
): result is MbAlbumResult => {
  return result.media_type === 'album';
};

export const mapSearchResults = async (
  results: (
    | TmdbMovieResult
    | TmdbTvResult
    | TmdbPersonResult
    | TmdbCollectionResult
    | MbArtistResult
    | MbAlbumResult
  )[],
  media?: Media[]
): Promise<Results[]> =>
  Promise.all(
    results.map(async (result) => {
      if (isTmdbMovie(result)) {
        return mapMovieResult(
          result,
          media?.find(
            (req) =>
              req.tmdbId === result.id && req.mediaType === MainMediaType.MOVIE
          )
        );
      } else if (isTmdbTv(result)) {
        return mapTvResult(
          result,
          media?.find(
            (req) =>
              req.tmdbId === result.id && req.mediaType === MainMediaType.TV
          )
        );
      } else if (isTmdbPerson(result)) {
        return mapPersonResult(result);
      } else if (isTmdbCollection(result)) {
        return mapCollectionResult(result);
      } else if (isLidarrArtist(result)) {
        return mapArtistResult(result);
      } else if (isLidarrAlbum(result)) {
        return mapAlbumResult(
          result,
          media?.find(
            (req) =>
              req.mbId === result.id && req.mediaType === MainMediaType.MUSIC
          )
        );
      }

      throw new Error(`Unhandled result type: ${JSON.stringify(result)}`);
    })
  );

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

export const mapArtistDetailsToResult = (
  artistDetails: MbArtistDetails
): MbArtistResult => ({
  id: artistDetails.id,
  score: 100, // Default score since we're mapping details
  media_type: 'artist',
  artistname: artistDetails.artistname,
  overview: artistDetails.overview,
  disambiguation: artistDetails.disambiguation,
  type: artistDetails.type,
  status: artistDetails.status,
  sortname: artistDetails.sortname,
  genres: artistDetails.genres,
  images: artistDetails.images,
  links: artistDetails.links,
  rating: artistDetails.rating,
});

export const mapAlbumDetailsToResult = (
  albumDetails: MbAlbumDetails
): MbAlbumResult => ({
  id: albumDetails.id,
  score: 100,
  media_type: 'album',
  title: albumDetails.title,
  artistid: albumDetails.artistid,
  artists: albumDetails.artists,
  type: albumDetails.type,
  releasedate: albumDetails.releasedate,
  disambiguation: albumDetails.disambiguation,
  genres: albumDetails.genres,
  images: albumDetails.images,
  secondarytypes: albumDetails.secondarytypes,
  overview: albumDetails.overview || albumDetails.artists?.[0]?.overview || '',
});
