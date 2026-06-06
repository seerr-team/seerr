import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieDetails,
  TmdbMovieResult,
  TmdbSearchMovieResponse,
  TmdbSearchMultiResponse,
  TmdbSearchTvResponse,
  TmdbTvDetails,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import type { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';

type CertificationMediaType = MediaType.MOVIE | MediaType.TV;

type FilterableMediaResult =
  | TmdbMovieResult
  | TmdbTvResult
  | TmdbSearchMultiResponse['results'][number];

type CertificationFilter = {
  certificationCountry?: string;
  certificationGte?: string;
  certificationLte?: string;
};

type KeywordFilter = {
  excludeKeywords?: string;
};

export class ParentalControlRestrictedError extends Error {}

const isParentalControlsEnabled = (user?: User): boolean =>
  !!user?.settings?.parentalControlsEnabled;

const isUnratedCertification = (certification?: string): boolean => {
  const normalized = certification?.trim().toLowerCase();

  return (
    !normalized ||
    normalized === 'nr' ||
    normalized === 'not rated' ||
    normalized === 'unrated'
  );
};

const getMinimumRatedCertification = async (
  tmdb: TheMovieDb,
  mediaType: CertificationMediaType,
  region: string
): Promise<string | undefined> => {
  const data =
    mediaType === MediaType.MOVIE
      ? await tmdb.getMovieCertifications()
      : await tmdb.getTvCertifications();

  return data.certifications[region]
    ?.filter((cert) => !isUnratedCertification(cert.certification))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]?.certification;
};

export const getParentalCertificationFilter = async (
  user: User | undefined,
  mediaType: CertificationMediaType,
  tmdb = new TheMovieDb()
): Promise<CertificationFilter> => {
  if (!isParentalControlsEnabled(user)) {
    return {};
  }

  const certificationLte =
    mediaType === MediaType.MOVIE
      ? user?.settings?.maxMovieCertification
      : user?.settings?.maxTvCertification;
  const certificationCountry =
    certificationLte || user?.settings?.blockUnrated
      ? (user?.settings?.parentalControlsRegion ?? 'US')
      : undefined;

  return {
    certificationCountry,
    certificationGte:
      certificationCountry && user?.settings?.blockUnrated
        ? await getMinimumRatedCertification(
            tmdb,
            mediaType,
            certificationCountry
          )
        : undefined,
    certificationLte,
  };
};

const getMovieCertification = (
  movie: TmdbMovieDetails,
  region: string
): string | undefined => {
  const release = movie.release_dates.results.find(
    (result) => result.iso_3166_1 === region
  );

  return release?.release_dates.find((date) => date.certification)
    ?.certification;
};

const getTvCertification = (
  show: TmdbTvDetails,
  region: string
): string | undefined =>
  show.content_ratings.results.find((result) => result.iso_3166_1 === region)
    ?.rating;

const getCertificationOrder = async (
  tmdb: TheMovieDb,
  mediaType: CertificationMediaType,
  region: string,
  certification: string
): Promise<number | undefined> => {
  const data =
    mediaType === MediaType.MOVIE
      ? await tmdb.getMovieCertifications()
      : await tmdb.getTvCertifications();

  return data.certifications[region]?.find(
    (cert) => cert.certification === certification
  )?.order;
};

export const isMediaAllowedByParentalControls = async ({
  user,
  mediaType,
  media,
  tmdb = new TheMovieDb(),
}: {
  user?: User;
  mediaType: CertificationMediaType;
  media: TmdbMovieDetails | TmdbTvDetails;
  tmdb?: TheMovieDb;
}): Promise<boolean> => {
  if (!isParentalControlsEnabled(user)) {
    return true;
  }

  const region = user?.settings?.parentalControlsRegion ?? 'US';
  const maxCertification =
    mediaType === MediaType.MOVIE
      ? user?.settings?.maxMovieCertification
      : user?.settings?.maxTvCertification;

  if (mediaType === MediaType.MOVIE && (media as TmdbMovieDetails).adult) {
    return false;
  }

  const certification =
    mediaType === MediaType.MOVIE
      ? getMovieCertification(media as TmdbMovieDetails, region)
      : getTvCertification(media as TmdbTvDetails, region);

  if (isUnratedCertification(certification)) {
    return !user?.settings?.blockUnrated;
  }

  if (!maxCertification) {
    return true;
  }

  const ratedCertification = certification as string;

  const [certificationOrder, maxCertificationOrder] = await Promise.all([
    getCertificationOrder(tmdb, mediaType, region, ratedCertification),
    getCertificationOrder(tmdb, mediaType, region, maxCertification),
  ]);

  if (certificationOrder === undefined || maxCertificationOrder === undefined) {
    return true;
  }

  return certificationOrder <= maxCertificationOrder;
};

const getResultMediaType = (
  result: FilterableMediaResult,
  fallbackMediaType?: CertificationMediaType
): CertificationMediaType | undefined => {
  if ('media_type' in result) {
    if (result.media_type === MediaType.MOVIE) {
      return MediaType.MOVIE;
    }

    if (result.media_type === MediaType.TV) {
      return MediaType.TV;
    }
  }

  return fallbackMediaType;
};

export const filterResultsByParentalControls = async <
  T extends FilterableMediaResult,
>({
  user,
  results,
  tmdb = new TheMovieDb(),
  mediaType,
  language,
}: {
  user?: User;
  results: T[];
  tmdb?: TheMovieDb;
  mediaType?: CertificationMediaType;
  language?: string;
}): Promise<T[]> => {
  if (!isParentalControlsEnabled(user)) {
    return results;
  }

  const allowedResults: (T | null)[] = await Promise.all(
    results.map(async (result) => {
      const resultMediaType = getResultMediaType(result, mediaType);

      if (!resultMediaType) {
        return result;
      }

      const details =
        resultMediaType === MediaType.MOVIE
          ? await tmdb.getMovie({ movieId: result.id, language })
          : await tmdb.getTvShow({ tvId: result.id, language });

      return (await isMediaAllowedByParentalControls({
        user,
        mediaType: resultMediaType,
        media: details,
        tmdb,
      }))
        ? (result as T)
        : null;
    })
  );

  return allowedResults.filter((result): result is T => !!result);
};

export const filterMovieResponseByParentalControls = async (
  response: TmdbSearchMovieResponse,
  user?: User,
  tmdb = new TheMovieDb(),
  language?: string
): Promise<TmdbSearchMovieResponse> => ({
  ...response,
  results: await filterResultsByParentalControls({
    user,
    results: response.results,
    tmdb,
    mediaType: MediaType.MOVIE,
    language,
  }),
});

export const filterTvResponseByParentalControls = async (
  response: TmdbSearchTvResponse,
  user?: User,
  tmdb = new TheMovieDb(),
  language?: string
): Promise<TmdbSearchTvResponse> => ({
  ...response,
  results: await filterResultsByParentalControls({
    user,
    results: response.results,
    tmdb,
    mediaType: MediaType.TV,
    language,
  }),
});

const getGlobalExcludedCertifications = (
  mediaType: CertificationMediaType
): string[] => {
  const settings = getSettings();
  const exclusions =
    mediaType === MediaType.MOVIE
      ? settings.main.excludedMovieCertifications
      : settings.main.excludedTvCertifications;

  return exclusions
    ? exclusions
        .split('|')
        .map((certification) => certification.trim())
        .filter(Boolean)
    : [];
};

const isGloballyExcludedCertification = (
  certification: string | undefined,
  exclusions: string[]
): boolean => {
  if (isUnratedCertification(certification)) {
    return exclusions.some(isUnratedCertification);
  }

  return exclusions.includes(certification as string);
};

export const getGlobalCertificationExclusionFilter = async (
  mediaType: CertificationMediaType,
  tmdb = new TheMovieDb()
): Promise<CertificationFilter> => {
  const settings = getSettings();
  const exclusions = getGlobalExcludedCertifications(mediaType);
  const certificationCountry =
    settings.main.excludedCertificationRegion || 'US';

  return {
    certificationCountry: exclusions.length ? certificationCountry : undefined,
    certificationGte: exclusions.some(isUnratedCertification)
      ? await getMinimumRatedCertification(
          tmdb,
          mediaType,
          certificationCountry
        )
      : undefined,
  };
};

export const isMediaAllowedByGlobalRatingExclusions = ({
  mediaType,
  media,
}: {
  mediaType: CertificationMediaType;
  media: TmdbMovieDetails | TmdbTvDetails;
}): boolean => {
  const settings = getSettings();
  const region = settings.main.excludedCertificationRegion || 'US';
  const exclusions = getGlobalExcludedCertifications(mediaType);

  if (!exclusions.length) {
    return true;
  }

  const certification =
    mediaType === MediaType.MOVIE
      ? getMovieCertification(media as TmdbMovieDetails, region)
      : getTvCertification(media as TmdbTvDetails, region);

  return !isGloballyExcludedCertification(certification, exclusions);
};

export const filterResultsByGlobalRatingExclusions = async <
  T extends FilterableMediaResult,
>({
  results,
  tmdb = new TheMovieDb(),
  mediaType,
  language,
}: {
  results: T[];
  tmdb?: TheMovieDb;
  mediaType?: CertificationMediaType;
  language?: string;
}): Promise<T[]> => {
  const settings = getSettings();

  if (
    !settings.main.excludedMovieCertifications &&
    !settings.main.excludedTvCertifications
  ) {
    return results;
  }

  const allowedResults: (T | null)[] = await Promise.all(
    results.map(async (result) => {
      const resultMediaType = getResultMediaType(result, mediaType);

      if (!resultMediaType) {
        return result;
      }

      const details =
        resultMediaType === MediaType.MOVIE
          ? await tmdb.getMovie({ movieId: result.id, language })
          : await tmdb.getTvShow({ tvId: result.id, language });

      return isMediaAllowedByGlobalRatingExclusions({
        mediaType: resultMediaType,
        media: details,
      })
        ? (result as T)
        : null;
    })
  );

  return allowedResults.filter((result): result is T => !!result);
};

export const filterMovieResponseByGlobalRatingExclusions = async (
  response: TmdbSearchMovieResponse,
  tmdb = new TheMovieDb(),
  language?: string
): Promise<TmdbSearchMovieResponse> => ({
  ...response,
  results: await filterResultsByGlobalRatingExclusions({
    results: response.results,
    tmdb,
    mediaType: MediaType.MOVIE,
    language,
  }),
});

export const filterTvResponseByGlobalRatingExclusions = async (
  response: TmdbSearchTvResponse,
  tmdb = new TheMovieDb(),
  language?: string
): Promise<TmdbSearchTvResponse> => ({
  ...response,
  results: await filterResultsByGlobalRatingExclusions({
    results: response.results,
    tmdb,
    mediaType: MediaType.TV,
    language,
  }),
});

const getGlobalExcludedKeywordIds = (
  mediaType: CertificationMediaType
): number[] => {
  const settings = getSettings();
  const tags =
    mediaType === MediaType.MOVIE
      ? settings.main.excludedMovieTags
      : settings.main.excludedTvTags;

  return tags
    ? tags
        .split(',')
        .map((tag) => Number(tag))
        .filter((tag) => !Number.isNaN(tag))
    : [];
};

export const getGlobalKeywordExclusionFilter = (
  mediaType: CertificationMediaType,
  existingExcludeKeywords?: string
): KeywordFilter => {
  const excludedKeywordIds = getGlobalExcludedKeywordIds(mediaType);
  const keywords = [
    ...(existingExcludeKeywords
      ? existingExcludeKeywords.split(',').map((keyword) => Number(keyword))
      : []),
    ...excludedKeywordIds,
  ].filter((keyword) => !Number.isNaN(keyword));

  return {
    excludeKeywords: keywords.length
      ? [...new Set(keywords)].join(',')
      : undefined,
  };
};

export const isMediaAllowedByGlobalTagExclusions = ({
  mediaType,
  media,
}: {
  mediaType: CertificationMediaType;
  media: TmdbMovieDetails | TmdbTvDetails;
}): boolean => {
  const excludedKeywordIds = getGlobalExcludedKeywordIds(mediaType);

  if (!excludedKeywordIds.length) {
    return true;
  }

  const keywords =
    mediaType === MediaType.MOVIE
      ? (media as TmdbMovieDetails).keywords.keywords
      : (media as TmdbTvDetails).keywords.results;

  return !keywords.some((keyword) => excludedKeywordIds.includes(keyword.id));
};

export const filterResultsByGlobalTagExclusions = async <
  T extends FilterableMediaResult,
>({
  results,
  tmdb = new TheMovieDb(),
  mediaType,
  language,
}: {
  results: T[];
  tmdb?: TheMovieDb;
  mediaType?: CertificationMediaType;
  language?: string;
}): Promise<T[]> => {
  if (
    !getGlobalExcludedKeywordIds(MediaType.MOVIE).length &&
    !getGlobalExcludedKeywordIds(MediaType.TV).length
  ) {
    return results;
  }

  const allowedResults: (T | null)[] = await Promise.all(
    results.map(async (result) => {
      const resultMediaType = getResultMediaType(result, mediaType);

      if (!resultMediaType) {
        return result;
      }

      const details =
        resultMediaType === MediaType.MOVIE
          ? await tmdb.getMovie({ movieId: result.id, language })
          : await tmdb.getTvShow({ tvId: result.id, language });

      return isMediaAllowedByGlobalTagExclusions({
        mediaType: resultMediaType,
        media: details,
      })
        ? (result as T)
        : null;
    })
  );

  return allowedResults.filter((result): result is T => !!result);
};

export const filterMovieResponseByGlobalTagExclusions = async (
  response: TmdbSearchMovieResponse,
  tmdb = new TheMovieDb(),
  language?: string
): Promise<TmdbSearchMovieResponse> => ({
  ...response,
  results: await filterResultsByGlobalTagExclusions({
    results: response.results,
    tmdb,
    mediaType: MediaType.MOVIE,
    language,
  }),
});

export const filterTvResponseByGlobalTagExclusions = async (
  response: TmdbSearchTvResponse,
  tmdb = new TheMovieDb(),
  language?: string
): Promise<TmdbSearchTvResponse> => ({
  ...response,
  results: await filterResultsByGlobalTagExclusions({
    results: response.results,
    tmdb,
    mediaType: MediaType.TV,
    language,
  }),
});
