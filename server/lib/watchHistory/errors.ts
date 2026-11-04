export enum WatchHistoryErrorCode {
  ProviderNotConfigured = 'WATCH_HISTORY_PROVIDER_NOT_CONFIGURED',
  UserNotSupported = 'WATCH_HISTORY_USER_NOT_SUPPORTED',
  FetchFailed = 'WATCH_HISTORY_FETCH_FAILED',
}

export class WatchHistoryError extends Error {
  public readonly code: WatchHistoryErrorCode;
  public readonly statusCode: number;

  constructor({
    code,
    message,
    statusCode = 500,
    cause,
  }: {
    code: WatchHistoryErrorCode;
    message: string;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(message);
    this.name = 'WatchHistoryError';
    this.code = code;
    this.statusCode = statusCode;

    if (cause) {
      this.cause = cause;
    }

    Object.setPrototypeOf(this, WatchHistoryError.prototype);
  }
}

export const isWatchHistoryError = (
  error: unknown
): error is WatchHistoryError => {
  return error instanceof WatchHistoryError;
};
