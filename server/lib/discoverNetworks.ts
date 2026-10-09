import {
  discoverNetworksSchema,
  MAX_DISCOVER_NETWORKS,
} from '@server/constants/discover';
import { ApiErrorCode } from '@server/constants/error';

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

export const sanitizeDiscoverNetworks = (
  data: string | null
): string | null => {
  if (data === null || data === '') {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(data);
  } catch {
    throw new InvalidDiscoverNetworksError();
  }

  const result = discoverNetworksSchema.safeParse(parsed);

  if (!result.success) {
    throw new InvalidDiscoverNetworksError();
  }

  if (result.data.length > MAX_DISCOVER_NETWORKS) {
    throw new TooManyDiscoverNetworksError();
  }

  return JSON.stringify(result.data);
};
