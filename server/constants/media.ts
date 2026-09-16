export enum MediaRequestStatus {
  PENDING = 1,
  APPROVED,
  DECLINED,
  FAILED,
  COMPLETED,
}

export enum MediaRequestFailureReason {
  SERVICE_UNREACHABLE = 1,
  DISPATCH_FAILED,
  TVDB_ID_UNRESOLVED,
  SEASON_NUMBERING_UNVERIFIED,
  SEASON_NUMBERING_MISMATCH,
}

export enum MediaType {
  MOVIE = 'movie',
  TV = 'tv',
}

export enum MediaStatus {
  UNKNOWN = 1,
  PENDING,
  PROCESSING,
  PARTIALLY_AVAILABLE,
  AVAILABLE,
  BLOCKLISTED,
  DELETED,
}
