import { MAX_DISCOVER_STUDIOS } from '@server/constants/discover';
import { ApiErrorCode } from '@server/constants/error';
import { sanitizeDiscoverBrandList } from '@server/lib/discoverBrands';

// The message of these errors is an ApiErrorCode, which the client turns into
// a translated message.
export class InvalidDiscoverStudiosError extends Error {
  constructor(message: string = ApiErrorCode.InvalidStudioList) {
    super(message);
    this.name = 'InvalidDiscoverStudiosError';
  }
}

export class TooManyDiscoverStudiosError extends InvalidDiscoverStudiosError {
  constructor() {
    super(ApiErrorCode.TooManyStudios);
    this.name = 'TooManyDiscoverStudiosError';
  }
}

export const sanitizeDiscoverStudios = (data: string | null): string | null =>
  sanitizeDiscoverBrandList(data, {
    maxBrands: MAX_DISCOVER_STUDIOS,
    createInvalidError: () => new InvalidDiscoverStudiosError(),
    createTooManyError: () => new TooManyDiscoverStudiosError(),
  });
