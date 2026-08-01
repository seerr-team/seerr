import { TraktApiError, type TraktTokenSet } from '@server/api/trakt';
import type { TraktConnection } from '@server/entity/TraktConnection';
import { TraktConnectionStatus } from '@server/entity/TraktConnection';
import { invalidateWatchStatus } from '@server/lib/trakt/connectionLifecycleService';
import { traktConnectionRepository } from '@server/lib/trakt/connectionRepository';
import { traktRateLimitRegistry } from '@server/lib/trakt/rateLimitRegistry';
import {
  TraktRefreshCoordinator,
  type TraktAccessContext,
} from '@server/lib/trakt/refreshCoordinator';
import { traktApiFactory } from '@server/lib/trakt/traktApiFactory';
import logger from '@server/logger';

const refreshCoordinator = new TraktRefreshCoordinator();

class TraktTokenRefreshService {
  public refreshAccess(
    connectionId: number,
    expectedTokenVersion: number
  ): Promise<TraktAccessContext> {
    return refreshCoordinator.run(connectionId, async () => {
      const connection = await traktConnectionRepository.findWithTokens({
        connectionId,
      });
      if (!connection) {
        throw new Error('Trakt connection not found');
      }
      if (connection.tokenVersion !== expectedTokenVersion) {
        return this.toAccessContext(connection);
      }
      if (
        connection.status !== TraktConnectionStatus.ACTIVE ||
        !connection.refreshToken
      ) {
        throw new Error('Trakt connection requires reconnection');
      }

      let replacement: TraktTokenSet;
      try {
        replacement = await traktApiFactory
          .apiFor()
          .refresh(connection.refreshToken);
      } catch (error) {
        traktRateLimitRegistry.remember(connection.id, error);
        if (!this.isInvalidRefreshCredentials(error)) {
          throw error;
        }

        const invalidated =
          await traktConnectionRepository.invalidateTokens(connection);
        if (invalidated.affected === 1) {
          invalidateWatchStatus(connection.id);
          logger.warn('Trakt connection requires reconnection', {
            label: 'Trakt',
            operation: 'reconnect_required',
            connectionId: connection.id,
            tokenVersion: connection.tokenVersion + 1,
            resultCode: 'invalid_refresh',
          });
          throw error;
        }

        return this.loadWinningAccessContext(connection.id);
      }

      const updated = await traktConnectionRepository.replaceTokens(
        connection,
        replacement
      );
      if (updated.affected !== 1) {
        return this.loadWinningAccessContext(connection.id);
      }

      invalidateWatchStatus(connection.id);
      logger.info('Trakt access token refreshed', {
        label: 'Trakt',
        operation: 'token_refresh',
        connectionId: connection.id,
        tokenVersion: connection.tokenVersion + 1,
        resultCode: 'succeeded',
      });
      return {
        connectionId: connection.id,
        accessToken: replacement.accessToken,
        tokenVersion: connection.tokenVersion + 1,
      };
    });
  }

  public toAccessContext(connection: TraktConnection): TraktAccessContext {
    if (
      connection.status !== TraktConnectionStatus.ACTIVE ||
      !connection.accessToken
    ) {
      throw new Error('Trakt connection requires reconnection');
    }
    return {
      connectionId: connection.id,
      accessToken: connection.accessToken,
      tokenVersion: connection.tokenVersion,
    };
  }

  private async loadWinningAccessContext(
    connectionId: number
  ): Promise<TraktAccessContext> {
    const winner = await traktConnectionRepository.findWithTokens({
      connectionId,
    });
    if (!winner) {
      throw new Error('Trakt connection not found');
    }
    return this.toAccessContext(winner);
  }

  private isInvalidRefreshCredentials(error: unknown): error is TraktApiError {
    return (
      error instanceof TraktApiError &&
      (error.status === 400 || error.status === 401)
    );
  }
}

export const traktTokenRefreshService = new TraktTokenRefreshService();
