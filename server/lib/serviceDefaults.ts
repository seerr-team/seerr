import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type {
  TmdbKeyword,
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import type {
  DVRSettings,
  RadarrSettings,
  SonarrSettings,
} from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { xor } from 'lodash';

export type RequestOverrideValues = {
  rootFolder?: string | null;
  profileId?: number | null;
  languageProfileId?: number | null;
  tags?: number[] | null;
};

export type RuleCoverage = {
  rootFolder: boolean;
  profileId: boolean;
  tags: boolean;
};

type ServiceDefaults = {
  rootFolder: string;
  profileId: number;
  languageProfileId?: number;
  tags: number[];
};

export function mediaKeywords(
  tmdbMedia: TmdbMovieDetails | TmdbTvDetails
): TmdbKeyword[] {
  return 'results' in tmdbMedia.keywords
    ? tmdbMedia.keywords.results
    : tmdbMedia.keywords.keywords;
}

export function isAnimeMedia(
  tmdbMedia: TmdbMovieDetails | TmdbTvDetails
): boolean {
  return mediaKeywords(tmdbMedia).some(
    (keyword) => keyword.id === ANIME_KEYWORD_ID
  );
}

export function servicesFor(
  mediaType: MediaType
): (RadarrSettings | SonarrSettings)[] {
  const settings = getSettings();

  return mediaType === MediaType.MOVIE ? settings.radarr : settings.sonarr;
}

export function resolveService<T extends DVRSettings>(
  services: T[],
  is4k: boolean,
  serviceId?: number | null
): { service?: T; fellBack: boolean } {
  const defaultService = services.find(
    (service) => service.isDefault && service.is4k === is4k
  );

  if (serviceId == null || serviceId < 0 || serviceId === defaultService?.id) {
    return { service: defaultService, fellBack: false };
  }

  const requested = services.find(
    (service) => service.id === serviceId && service.is4k === is4k
  );

  return requested
    ? { service: requested, fellBack: false }
    : { service: defaultService, fellBack: true };
}

export function resolveServiceDefaults(
  mediaType: MediaType,
  service: RadarrSettings | SonarrSettings,
  isAnime: boolean
): ServiceDefaults {
  if (mediaType === MediaType.MOVIE) {
    return {
      rootFolder: service.activeDirectory,
      profileId: service.activeProfileId,
      tags: [...(service.tags ?? [])],
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
    tags: [...((isAnime ? sonarr.animeTags : sonarr.tags) ?? [])],
  };
}

// null clears a stored value, undefined leaves it as it is
export function stripDefaultOverrides({
  mediaType,
  is4k,
  serviceId,
  isAnime,
  overrides,
  covered,
}: {
  mediaType: MediaType;
  is4k: boolean;
  serviceId?: number | null;
  isAnime: boolean;
  overrides: RequestOverrideValues;
  covered: RuleCoverage;
}): RequestOverrideValues {
  const { service } = resolveService(servicesFor(mediaType), is4k, serviceId);

  if (!service) {
    return overrides;
  }

  const defaults = resolveServiceDefaults(mediaType, service, isAnime);

  const clearIfDefault = <T>(value: T | null | undefined, fallback?: T) =>
    value === undefined ? undefined : value === fallback ? null : value;

  return {
    rootFolder: covered.rootFolder
      ? overrides.rootFolder
      : clearIfDefault(overrides.rootFolder, defaults.rootFolder),
    profileId: covered.profileId
      ? overrides.profileId
      : clearIfDefault(overrides.profileId, defaults.profileId),
    languageProfileId: clearIfDefault(
      overrides.languageProfileId,
      defaults.languageProfileId
    ),
    // Tag order carries no meaning to *arr, so only a differing set is a choice
    tags:
      covered.tags || overrides.tags === undefined
        ? overrides.tags
        : xor(overrides.tags ?? [], defaults.tags).length
          ? overrides.tags
          : null,
  };
}
