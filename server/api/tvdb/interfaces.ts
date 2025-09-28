import { type AvailableLocale } from '@server/types/languages';

export interface TvdbBaseResponse<T> {
  data: T;
  errors: string;
  links?: TvdbPagination;
}

export interface TvdbPagination {
  prev?: string;
  self: string;
  next?: string;
  totalItems: number;
  pageSize: number;
}

export interface TvdbLoginResponse {
  token: string;
}

interface TvDetailsAliases {
  language: string;
  name: string;
}

interface TvDetailsStatus {
  id: number;
  name: string;
  recordType: string;
  keepUpdated: boolean;
}

export interface TvdbTvDetails {
  id: number;
  name: string;
  slug: string;
  image: string;
  nameTranslations: string[];
  overwiewTranslations: string[];
  aliases: TvDetailsAliases[];
  firstAired: Date;
  lastAired: Date;
  nextAired: Date | string;
  score: number;
  status: TvDetailsStatus;
  originalCountry: string;
  originalLanguage: string;
  defaultSeasonType: string;
  isOrderRandomized: boolean;
  lastUpdated: Date;
  averageRuntime: number;
  seasons: TvdbSeasonDetails[];
  episodes: TvdbEpisode[];
}

interface TvdbCompanyType {
  companyTypeId: number;
  companyTypeName: string;
}

interface TvdbParentCompany {
  id?: number;
  name?: string;
  relation?: {
    id?: number;
    typeName?: string;
  };
}

interface TvdbCompany {
  id: number;
  name: string;
  slug: string;
  nameTranslations?: string[];
  overviewTranslations?: string[];
  aliases?: string[];
  country: string;
  primaryCompanyType: number;
  activeDate: string;
  inactiveDate?: string;
  companyType: TvdbCompanyType;
  parentCompany: TvdbParentCompany;
  tagOptions?: string[];
}

interface TvdbType {
  id: number;
  name: string;
  type: string;
  alternateName?: string;
}

interface TvdbArtwork {
  id: number;
  image: string;
  thumbnail: string;
  language: string;
  type: number;
  score: number;
  width: number;
  height: number;
  includesText: boolean;
}

export interface TvdbEpisode {
  id: number;
  seriesId: number;
  name: string;
  aired: string;
  runtime: number;
  nameTranslations: string[];
  overview?: string;
  overviewTranslations: string[];
  image: string;
  imageType: number;
  isMovie: number;
  seasons?: string[];
  number: number;
  absoluteNumber: number;
  seasonNumber: number;
  lastUpdated: string;
  finaleType?: string;
  year: string;
}

export interface TvdbSeasonDetails {
  id: number;
  seriesId: number;
  type: TvdbType;
  number: number;
  nameTranslations: string[];
  overviewTranslations: string[];
  image: string;
  imageType: number;
  companies: {
    studio: TvdbCompany[];
    network: TvdbCompany[];
    production: TvdbCompany[];
    distributor: TvdbCompany[];
    special_effects: TvdbCompany[];
  };
  lastUpdated: string;
  year: string;
  episodes: TvdbEpisode[];
  trailers: string[];
  artwork: TvdbArtwork[];
  tagOptions?: string[];
  firstAired: string;
}

export interface TvdbEpisodeTranslation {
  name: string;
  overview: string;
  language: string;
}

const TMDB_TO_TVDB_MAPPING: Record<string, string> & {
  [key in AvailableLocale]: string;
} = {
  ar: 'ara', // Arabic
  bg: 'bul', // Bulgarian
  ca: 'cat', // Catalan
  cs: 'ces', // Czech
  da: 'dan', // Danish
  de: 'deu', // German
  el: 'ell', // Greek
  en: 'eng', // English
  es: 'spa', // Spanish
  fi: 'fin', // Finnish
  fr: 'fra', // French
  he: 'heb', // Hebrew
  hi: 'hin', // Hindi
  hr: 'hrv', // Croatian
  hu: 'hun', // Hungarian
  it: 'ita', // Italian
  ja: 'jpn', // Japanese
  ko: 'kor', // Korean
  lt: 'lit', // Lithuanian
  nl: 'nld', // Dutch
  pl: 'pol', // Polish
  ro: 'ron', // Romanian
  ru: 'rus', // Russian
  sq: 'sqi', // Albanian
  sr: 'srp', // Serbian
  sv: 'swe', // Swedish
  tr: 'tur', // Turkish
  uk: 'ukr', // Ukrainian

  'es-MX': 'spa', // Spanish (Latin America) -> Spanish
  'nb-NO': 'nor', // Norwegian Bokmål -> Norwegian
  'pt-BR': 'pt', // Portuguese (Brazil) -> Portuguese - Brazil (from TVDB data)
  'pt-PT': 'por', // Portuguese (Portugal) -> Portuguese - Portugal (from TVDB data)
  'zh-CN': 'zho', // Chinese (Simplified) -> Chinese - China
  'zh-TW': 'zhtw', // Chinese (Traditional) -> Chinese - Taiwan
};

export function convertTMDBToTVDB(tmdbCode: string): string | null {
  const normalizedCode = tmdbCode.toLowerCase();

  return (
    TMDB_TO_TVDB_MAPPING[tmdbCode] ||
    TMDB_TO_TVDB_MAPPING[normalizedCode] ||
    null
  );
}

export function convertTmdbLanguageToTvdbWithFallback(
  tmdbCode: string,
  fallback: string
): string {
  // First try exact match
  const tvdbCode = convertTMDBToTVDB(tmdbCode);
  if (tvdbCode) return tvdbCode;

  return tvdbCode || fallback || 'eng'; // Default to English if no match found
}
