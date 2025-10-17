export enum MediaRequestStatus {
  PENDING = 1,
  APPROVED,
  DECLINED,
  FAILED,
  COMPLETED,
}

export enum MediaType {
  MOVIE = 'movie',
  TV = 'tv',
  BOOK = 'book',
}

export const MEDIA_IDENTIFIER_TYPES = {
  [MediaType.MOVIE]: 'tmdb',
  [MediaType.TV]: 'tmdb',
  [MediaType.BOOK]: 'hardcover',
} as const;

export type IdentifierType =
  (typeof MEDIA_IDENTIFIER_TYPES)[keyof typeof MEDIA_IDENTIFIER_TYPES];

export enum MediaStatus {
  UNKNOWN = 1,
  PENDING,
  PROCESSING,
  PARTIALLY_AVAILABLE,
  AVAILABLE,
  BLACKLISTED,
  DELETED,
}
