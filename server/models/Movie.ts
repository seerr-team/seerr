import type {
  TmdbMovieDetails,
  TmdbMovieReleaseResult,
  TmdbProductionCompany,
} from '@server/api/themoviedb/interfaces';
import type Media from '@server/entity/Media';
import type {
  Cast,
  Crew,
  ExternalIds,
  Genre,
  Keyword,
  ProductionCompany,
  WatchProviders,
} from './common';
import {
  mapCast,
  mapCrew,
  mapExternalIds,
  mapVideos,
  mapWatchProviders,
} from './common';

export interface Video {
  url?: string;
  site: 'YouTube';
  key: string;
  name: string;
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

export interface MovieDetails {
  id: number;
  imdbId?: string;
  adult: boolean;
  backdropPath?: string;
  budget: number;
  genres: Genre[];
  homepage?: string;
  originalLanguage: string;
  originalTitle: string;
  overview?: string;
  popularity: number;
  relatedVideos?: Video[];
  posterPath?: string;
  productionCompanies: ProductionCompany[];
  productionCountries: {
    iso_3166_1: string;
    name: string;
  }[];
  releaseDate: string;
  releases: TmdbMovieReleaseResult;
  revenue: number;
  runtime?: number;
  spokenLanguages: {
    iso_639_1: string;
    name: string;
  }[];
  status: string;
  tagline?: string;
  title: string;
  video: boolean;
  voteAverage: number;
  voteCount: number;
  credits: {
    cast: Cast[];
    crew: Crew[];
  };
  collection?: {
    id: number;
    name: string;
    posterPath?: string;
    backdropPath?: string;
  };
  mediaInfo?: Media;
  externalIds: ExternalIds;
  mediaUrl?: string;
  watchProviders?: WatchProviders[];
  keywords: Keyword[];
  onUserWatchlist?: boolean;
}

export const mapProductionCompany = (
  company: TmdbProductionCompany
): ProductionCompany => ({
  id: company.id,
  name: company.name,
  originCountry: company.origin_country,
  description: company.description,
  headquarters: company.headquarters,
  homepage: company.homepage,
  logoPath: company.logo_path,
});

export const mapMovieDetails = (
  movie: TmdbMovieDetails,
  media?: Media,
  userWatchlist?: boolean
): MovieDetails => ({
  id: movie.id,
  adult: movie.adult,
  budget: movie.budget,
  genres: movie.genres,
  relatedVideos: mapVideos(movie.videos),
  originalLanguage: movie.original_language,
  originalTitle: movie.original_title,
  popularity: movie.popularity,
  productionCompanies: movie.production_companies.map(mapProductionCompany),
  productionCountries: movie.production_countries,
  releaseDate: movie.release_date,
  releases: movie.release_dates,
  revenue: movie.revenue,
  spokenLanguages: movie.spoken_languages,
  status: movie.status,
  title: movie.title,
  video: movie.video,
  voteAverage: movie.vote_average,
  voteCount: movie.vote_count,
  backdropPath: movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${movie.backdrop_path}`
    : undefined,
  homepage: movie.homepage,
  imdbId: movie.imdb_id,
  overview: movie.overview,
  posterPath: movie.poster_path
    ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${movie.poster_path}`
    : undefined,
  runtime: movie.runtime,
  tagline: movie.tagline,
  credits: {
    cast: movie.credits.cast.map(mapCast),
    crew: movie.credits.crew.map(mapCrew),
  },
  collection: movie.belongs_to_collection
    ? {
        id: movie.belongs_to_collection.id,
        name: movie.belongs_to_collection.name,
        posterPath: movie.belongs_to_collection.poster_path,
        backdropPath: movie.belongs_to_collection.backdrop_path,
      }
    : undefined,
  externalIds: mapExternalIds(movie.external_ids),
  mediaInfo: media,
  watchProviders: mapWatchProviders(movie['watch/providers']?.results ?? {}),
  keywords: movie.keywords.keywords.map((keyword) => ({
    id: keyword.id,
    name: keyword.name,
  })),
  onUserWatchlist: userWatchlist,
});
