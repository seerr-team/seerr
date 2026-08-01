import type TraktAPI from '@server/api/trakt';
import { TraktApiError } from '@server/api/trakt';
import { traktConnectionRepository } from '@server/lib/trakt/connectionRepository';
import { traktRateLimitRegistry } from '@server/lib/trakt/rateLimitRegistry';
import type { TraktAccessContext } from '@server/lib/trakt/refreshCoordinator';
import { traktTokenRefreshService } from '@server/lib/trakt/tokenRefreshService';
import { traktApiFactory } from '@server/lib/trakt/traktApiFactory';

const REFRESH_WINDOW_MS = 60 * 1000;

class TraktAuthenticatedApiService {
  public async withAuthenticatedApi<T>(
    userId: number,
    operation: (api: TraktAPI) => Promise<T>
  ): Promise<T> {
    const connection = await traktConnectionRepository.findWithTokens({
      userId,
    });
    if (!connection) {
      throw new Error('Trakt connection not found');
    }

    traktRateLimitRegistry.throwIfCoolingDown(connection.id);
    let context = traktTokenRefreshService.toAccessContext(connection);
    if (
      !connection.expiresAt ||
      connection.expiresAt.getTime() <= Date.now() + REFRESH_WINDOW_MS
    ) {
      context = await traktTokenRefreshService.refreshAccess(
        connection.id,
        connection.tokenVersion
      );
    }

    try {
      return await this.runAuthenticatedOperation(context, operation);
    } catch (error) {
      traktRateLimitRegistry.remember(context.connectionId, error);
      if (!this.isUnauthorized(error)) {
        throw error;
      }
    }

    const replacement = await traktTokenRefreshService.refreshAccess(
      context.connectionId,
      context.tokenVersion
    );
    try {
      return await this.runAuthenticatedOperation(replacement, operation);
    } catch (error) {
      traktRateLimitRegistry.remember(replacement.connectionId, error);
      throw error;
    }
  }

  private async runAuthenticatedOperation<T>(
    context: TraktAccessContext,
    operation: (api: TraktAPI) => Promise<T>
  ): Promise<T> {
    const api = traktApiFactory.apiFor(context.accessToken);
    const result = await operation(api);
    if (api.didValidateAccessToken()) {
      await traktConnectionRepository.markValidated(context);
    }
    return result;
  }

  private isUnauthorized(error: unknown): error is TraktApiError {
    return error instanceof TraktApiError && error.status === 401;
  }
}

export const traktAuthenticatedApiService = new TraktAuthenticatedApiService();
