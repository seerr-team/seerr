import { TraktApiError } from '@server/api/trakt';

const cooldownUntil = new Map<number, number>();

class TraktRateLimitRegistry {
  public remember(connectionId: number, error: unknown): void {
    if (
      !(error instanceof TraktApiError) ||
      error.status !== 429 ||
      error.retryAfterSeconds === undefined
    ) {
      return;
    }
    cooldownUntil.set(
      connectionId,
      Date.now() + error.retryAfterSeconds * 1000
    );
  }

  public throwIfCoolingDown(connectionId: number): void {
    const deadline = cooldownUntil.get(connectionId);
    if (deadline === undefined) {
      return;
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      cooldownUntil.delete(connectionId);
      return;
    }
    throw new TraktApiError(
      'Trakt rate limit exceeded',
      429,
      'RATE_LIMITED',
      Math.ceil(remainingMs / 1000)
    );
  }

  public clear(connectionId: number): void {
    cooldownUntil.delete(connectionId);
  }
}

export const traktRateLimitRegistry = new TraktRateLimitRegistry();
