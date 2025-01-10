import type {
  TmdbPersonCreditCast,
  TmdbPersonCreditCrew,
  TmdbPersonDetails,
} from '@server/api/themoviedb/interfaces';
import type Media from '@server/entity/Media';

export interface PersonDetails {
  id: number;
  name: string;
  birthday: string;
  deathday: string;
  knownForDepartment: string;
  alsoKnownAs?: string[];
  gender: number;
  biography: string;
  popularity: number;
  placeOfBirth?: string;
  profilePath?: string;
  adult: boolean;
  imdbId?: string;
  homepage?: string;
  mbArtistId?: string;
}

export interface PersonCredit {
  id: number;
  originalLanguage: string;
  episodeCount: number;
  overview: string;
  originCountry: string[];
  originalName: string;
  voteCount: number;
  name: string;
  mediaType?: string;
  popularity: number;
  creditId: string;
  backdropPath?: string;
  firstAirDate: string;
  voteAverage: number;
  genreIds?: number[];
  posterPath?: string;
  originalTitle: string;
  video?: boolean;
  title: string;
  adult: boolean;
  releaseDate: string;
  mediaInfo?: Media;
}

export interface PersonCreditCast extends PersonCredit {
  character: string;
}

export interface PersonCreditCrew extends PersonCredit {
  department: string;
  job: string;
}

export interface CombinedCredit {
  id: number;
  cast: PersonCreditCast[];
  crew: PersonCreditCrew[];
}

export const mapPersonDetails = (person: TmdbPersonDetails): PersonDetails => ({
  id: person.id,
  name: person.name,
  birthday: person.birthday,
  deathday: person.deathday,
  knownForDepartment: person.known_for_department,
  alsoKnownAs: person.also_known_as,
  gender: person.gender,
  biography: person.biography,
  popularity: person.popularity,
  placeOfBirth: person.place_of_birth,
  profilePath: person.profile_path,
  adult: person.adult,
  imdbId: person.imdb_id,
  homepage: person.homepage,
});

export const mapCastCredits = (
  cast: TmdbPersonCreditCast,
  media?: Media
): PersonCreditCast => ({
  id: cast.id,
  originalLanguage: cast.original_language,
  episodeCount: cast.episode_count,
  overview: cast.overview,
  originCountry: cast.origin_country,
  originalName: cast.original_name,
  voteCount: cast.vote_count,
  name: cast.name,
  mediaType: cast.media_type,
  popularity: cast.popularity,
  creditId: cast.credit_id,
  backdropPath: cast.backdrop_path,
  firstAirDate: cast.first_air_date,
  voteAverage: cast.vote_average,
  genreIds: cast.genre_ids,
  posterPath: cast.poster_path,
  originalTitle: cast.original_title,
  video: cast.video,
  title: cast.title,
  adult: cast.adult,
  releaseDate: cast.release_date,
  character: cast.character,
  mediaInfo: media,
});

export const mapCrewCredits = (
  crew: TmdbPersonCreditCrew,
  media?: Media
): PersonCreditCrew => ({
  id: crew.id,
  originalLanguage: crew.original_language,
  episodeCount: crew.episode_count,
  overview: crew.overview,
  originCountry: crew.origin_country,
  originalName: crew.original_name,
  voteCount: crew.vote_count,
  name: crew.name,
  mediaType: crew.media_type,
  popularity: crew.popularity,
  creditId: crew.credit_id,
  backdropPath: crew.backdrop_path,
  firstAirDate: crew.first_air_date,
  voteAverage: crew.vote_average,
  genreIds: crew.genre_ids,
  posterPath: crew.poster_path,
  originalTitle: crew.original_title,
  video: crew.video,
  title: crew.title,
  adult: crew.adult,
  releaseDate: crew.release_date,
  department: crew.department,
  job: crew.job,
  mediaInfo: media,
});
