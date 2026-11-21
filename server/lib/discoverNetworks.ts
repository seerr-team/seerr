import { MAX_DISCOVER_NETWORKS } from '@server/constants/discover';
import { ApiErrorCode } from '@server/constants/error';
import { sanitizeDiscoverBrandList } from '@server/lib/discoverBrands';

// The message of these errors is an ApiErrorCode, which the client turns into
// a translated message.
export class InvalidDiscoverNetworksError extends Error {
  constructor(message: string = ApiErrorCode.InvalidNetworkList) {
    super(message);
    this.name = 'InvalidDiscoverNetworksError';
  }
}

export class TooManyDiscoverNetworksError extends InvalidDiscoverNetworksError {
  constructor() {
    super(ApiErrorCode.TooManyNetworks);
    this.name = 'TooManyDiscoverNetworksError';
  }
}

export const sanitizeDiscoverNetworks = (data: string | null): string | null =>
  sanitizeDiscoverBrandList(data, {
    maxBrands: MAX_DISCOVER_NETWORKS,
    createInvalidError: () => new InvalidDiscoverNetworksError(),
    createTooManyError: () => new TooManyDiscoverNetworksError(),
  });
