import type {
  TmdbAggregateCreditCast,
  TmdbCreditCast,
  TmdbCreditCrew,
  TmdbExternalIds,
  TmdbVideo,
  TmdbVideoResult,
  TmdbWatchProviderDetails,
  TmdbWatchProviders,
} from '@server/api/themoviedb/interfaces';
import type { Video } from '@server/models/Movie';

export interface ProductionCompany {
  id: number;
  logoPath?: string;
  originCountry: string;
  name: string;
  description?: string;
  headquarters?: string;
  homepage?: string;
}

export interface TvNetwork {
  id: number;
  logoPath?: string;
  originCountry?: string;
  name: string;
  headquarters?: string;
  homepage?: string;
}

export interface Keyword {
  id: number;
  name: string;
}

export interface Genre {
  id: number;
  name: string;
}

export interface Cast {
  id: number;
  castId: number;
  character: string;
  creditId: string;
  gender?: number;
  name: string;
  order: number;
  profilePath?: string;
}

export interface Crew {
  id: number;
  creditId: string;
  department: string;
  gender?: number;
  job: string;
  name: string;
  profilePath?: string;
}

export interface ExternalIds {
  imdbId?: string;
  freebaseMid?: string;
  freebaseId?: string;
  tvdbId?: number;
  tvrageId?: string;
  facebookId?: string;
  instagramId?: string;
  twitterId?: string;
}

export interface WatchProviders {
  iso_3166_1: string;
  link?: string;
  buy?: WatchProviderDetails[];
  flatrate?: WatchProviderDetails[];
}

export interface WatchProviderDetails {
  displayPriority?: number;
  logoPath?: string;
  id: number;
  name: string;
}

export const mapCast = (person: TmdbCreditCast): Cast => ({
  castId: person.cast_id,
  character: person.character,
  creditId: person.credit_id,
  id: person.id,
  name: person.name,
  order: person.order,
  gender: person.gender,
  profilePath: person.profile_path,
});

export const mapAggregateCast = (person: TmdbAggregateCreditCast): Cast => ({
  castId: person.cast_id,
  // the first role is the one for which the actor appears the most as
  character: person.roles[0].character,
  creditId: person.roles[0].credit_id,
  id: person.id,
  name: person.name,
  order: person.order,
  gender: person.gender,
  profilePath: person.profile_path,
});

export const mapCrew = (person: TmdbCreditCrew): Crew => ({
  creditId: person.credit_id,
  department: person.department,
  id: person.id,
  job: person.job,
  name: person.name,
  gender: person.gender,
  profilePath: person.profile_path,
});

export const mapExternalIds = (eids: TmdbExternalIds): ExternalIds => ({
  facebookId: eids.facebook_id,
  freebaseId: eids.freebase_id,
  freebaseMid: eids.freebase_mid,
  imdbId: eids.imdb_id,
  instagramId: eids.instagram_id,
  tvdbId: eids.tvdb_id,
  tvrageId: eids.tvrage_id,
  twitterId: eids.twitter_id,
});

export const mapVideos = (videoResult: TmdbVideoResult): Video[] =>
  videoResult?.results.map(({ key, name, size, type, site }: TmdbVideo) => ({
    site,
    key,
    name,
    size,
    type,
    url: siteUrlCreator(site, key),
  }));

export const mapWatchProviders = (watchProvidersResult: {
  [iso_3166_1: string]: TmdbWatchProviders;
}): WatchProviders[] =>
  Object.entries(watchProvidersResult).map(
    ([iso_3166_1, provider]) =>
      ({
        iso_3166_1,
        link: provider.link,
        buy: mapWatchProviderDetails(provider.buy ?? []),
        flatrate: mapWatchProviderDetails(provider.flatrate ?? []),
      }) as WatchProviders
  );

export const mapWatchProviderDetails = (
  watchProviderDetails: TmdbWatchProviderDetails[]
): WatchProviderDetails[] =>
  watchProviderDetails.map(
    (provider) =>
      ({
        displayPriority: provider.display_priority,
        logoPath: provider.logo_path,
        id: provider.provider_id,
        name: provider.provider_name,
      }) as WatchProviderDetails
  );

const siteUrlCreator = (site: Video['site'], key: string): string =>
  ({
    YouTube: `https://www.youtube.com/watch?v=${key}`,
  })[site];
