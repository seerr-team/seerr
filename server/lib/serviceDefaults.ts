import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type {
  TmdbKeyword,
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { xor } from 'lodash';

export type RequestOverrideValues = {
  rootFolder?: string | null;
  profileId?: number | null;
  languageProfileId?: number | null;
  tags?: number[] | null;
};

type ServiceDefaults = {
  rootFolder?: string;
  profileId?: number;
  languageProfileId?: number;
  tags: number[];
};

export function isAnimeMedia(
  tmdbMedia: TmdbMovieDetails | TmdbTvDetails
): boolean {
  // Runs on every request, so a response without keywords must not throw
  const keywords = tmdbMedia?.keywords;

  if (!keywords) {
    return false;
  }

  let keywordList: TmdbKeyword[] = [];

  if ('keywords' in keywords) {
    keywordList = keywords.keywords;
  } else if ('results' in keywords) {
    keywordList = keywords.results;
  }

  return (keywordList ?? []).some((keyword) => keyword.id === ANIME_KEYWORD_ID);
}

function findService(
  mediaType: MediaType,
  is4k: boolean,
  serviceId?: number
): RadarrSettings | SonarrSettings | undefined {
  const settings = getSettings();
  const services =
    mediaType === MediaType.MOVIE ? settings.radarr : settings.sonarr;

  return serviceId === undefined
    ? services.find((service) => service.is4k === is4k && service.isDefault)
    : services.find((service) => service.id === serviceId);
}

// Mirrors how MediaRequestSubscriber picks what to send, so a submitted value
// can be compared against the same defaults it would be dispatched with
export function resolveServiceDefaults(
  mediaType: MediaType,
  service: RadarrSettings | SonarrSettings,
  isAnime: boolean
): ServiceDefaults {
  if (mediaType === MediaType.MOVIE) {
    return {
      rootFolder: service.activeDirectory,
      profileId: service.activeProfileId,
      tags: service.tags ?? [],
    };
  }

  const sonarr = service as SonarrSettings;

  return {
    rootFolder:
      isAnime && sonarr.activeAnimeDirectory
        ? sonarr.activeAnimeDirectory
        : sonarr.activeDirectory,
    profileId:
      isAnime && sonarr.activeAnimeProfileId
        ? sonarr.activeAnimeProfileId
        : sonarr.activeProfileId,
    languageProfileId:
      isAnime && sonarr.activeAnimeLanguageProfileId
        ? sonarr.activeAnimeLanguageProfileId
        : sonarr.activeLanguageProfileId,
    tags: (isAnime ? sonarr.animeTags : sonarr.tags) ?? [],
  };
}

// A request only stores a field when the requester picked something other than
// what the service would have used anyway. An absent field stays absent, so
// callers can tell "no opinion" from "cleared".
export function stripDefaultOverrides({
  mediaType,
  is4k,
  serviceId,
  isAnime,
  overrides,
}: {
  mediaType: MediaType;
  is4k: boolean;
  serviceId?: number;
  isAnime: boolean;
  overrides: RequestOverrideValues;
}): RequestOverrideValues {
  const service = findService(mediaType, is4k, serviceId);

  if (!service) {
    return overrides;
  }

  const defaults = resolveServiceDefaults(mediaType, service, isAnime);

  const clearIfDefault = <T>(value: T | null | undefined, fallback: T) =>
    value === undefined ? undefined : value === fallback ? null : value;

  return {
    rootFolder: clearIfDefault(overrides.rootFolder, defaults.rootFolder),
    profileId: clearIfDefault(overrides.profileId, defaults.profileId),
    languageProfileId: clearIfDefault(
      overrides.languageProfileId,
      defaults.languageProfileId
    ),
    // Tag order carries no meaning to *arr, so only a differing set is a choice
    tags:
      overrides.tags === undefined
        ? undefined
        : xor(overrides.tags ?? [], defaults.tags).length
          ? overrides.tags
          : null,
  };
}
