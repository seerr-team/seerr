import type { ApiErrorCode } from '@server/constants/error';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: ApiErrorCode
  ) {
    super();

    this.name = 'apiError';
  }
}
