import type { TraktProfile, TraktTokenSet } from '@server/api/trakt';
import type { TraktSafeResultCode } from '@server/interfaces/api/traktInterfaces';
import cacheManager from '@server/lib/cache';
import { traktAuthorizationPolicy } from '@server/lib/trakt/authorizationPolicy';
import { traktConnectionRepository } from '@server/lib/trakt/connectionRepository';
import { traktOAuthTransactionService } from '@server/lib/trakt/oauthTransactionService';
import { traktRateLimitRegistry } from '@server/lib/trakt/rateLimitRegistry';
import { traktApiFactory } from '@server/lib/trakt/traktApiFactory';
import logger from '@server/logger';
import { QueryFailedError, type EntityManager } from 'typeorm';

export class TraktConflictError extends Error {
  public constructor(
    public readonly code:
      | 'target_has_different_trakt_account'
      | 'trakt_account_owned_by_another_user'
  ) {
    super(code);
    this.name = 'TraktConflictError';
  }
}

export interface TraktUnlinkResult {
  remoteRevocationSucceeded: boolean;
}

export class TerminalTransactionError extends Error {
  public constructor(public readonly resultCode: TraktSafeResultCode) {
    super(resultCode);
  }
}

export const invalidateWatchStatus = (connectionId: number): void => {
  const cache = cacheManager.getCache('trakt-watch-status').data;
  const keys = cache
    .keys()
    .filter((key) => key.startsWith(`connection:${connectionId}:`));
  if (keys.length > 0) {
    cache.del(keys);
  }
};

class TraktConnectionLifecycleService {
  public async unlink(
    targetUserId: number,
    actorUserId = targetUserId
  ): Promise<TraktUnlinkResult> {
    const connection = await traktConnectionRepository.findWithTokens({
      userId: targetUserId,
    });
    if (!connection) {
      throw new Error('Trakt connection not found');
    }

    let remoteRevocationSucceeded = false;
    let errorClass: string | null = null;
    let removed = false;
    try {
      if (connection.accessToken) {
        await traktApiFactory.apiFor().revoke(connection.accessToken);
        remoteRevocationSucceeded = true;
      }
    } catch (error) {
      errorClass = error instanceof Error ? error.name : 'UnknownError';
    } finally {
      // Revocation is a network round trip, during which the user may have reconnected
      // into this same row; deleting unconditionally would discard that new connection.
      removed = await traktConnectionRepository.deleteAtVersion(
        connection.id,
        connection.tokenVersion
      );
      if (removed) {
        traktRateLimitRegistry.clear(connection.id);
      }
      invalidateWatchStatus(connection.id);
    }

    logger.info('Trakt connection unlinked', {
      label: 'Trakt',
      operation: 'unlink',
      connectionId: connection.id,
      actorUserId,
      targetUserId,
      remoteRevocationSucceeded,
      removed,
      errorClass,
    });

    return { remoteRevocationSucceeded };
  }

  public async persistCompletion(
    transactionId: string,
    tokens: TraktTokenSet,
    profile: TraktProfile
  ): Promise<{ connectionId: number }> {
    let uniqueRace: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const persisted = await traktConnectionRepository.runInTransaction(
          (manager) =>
            this.persistCompletionTransaction(
              manager,
              transactionId,
              tokens,
              profile
            )
        );
        return persisted;
      } catch (error) {
        if (this.isUniqueConstraintError(error) && attempt === 0) {
          uniqueRace = error;
          continue;
        }
        throw error;
      }
    }
    throw uniqueRace;
  }

  private async persistCompletionTransaction(
    manager: EntityManager,
    transactionId: string,
    tokens: TraktTokenSet,
    profile: TraktProfile
  ): Promise<{ connectionId: number }> {
    const now = new Date();
    const completion = await traktOAuthTransactionService.markSucceeded(
      manager,
      transactionId,
      now
    );
    if (!completion.succeeded) {
      throw new TerminalTransactionError(completion.resultCode);
    }

    const { transaction } = completion;
    if (!transaction.targetUserId) {
      throw new TerminalTransactionError('target_missing');
    }

    const authorization = await traktAuthorizationPolicy.resolve(
      transaction.actorUserId,
      transaction.targetUserId,
      manager
    );
    if (!authorization.allowed) {
      throw new TerminalTransactionError(authorization.reason);
    }

    const targetConnection = await traktConnectionRepository.findByUserId(
      manager,
      transaction.targetUserId
    );
    const identityConnection =
      await traktConnectionRepository.findByTraktUserId(
        manager,
        profile.traktUserId
      );

    if (
      targetConnection &&
      targetConnection.traktUserId !== profile.traktUserId
    ) {
      throw new TraktConflictError('target_has_different_trakt_account');
    }

    if (
      identityConnection &&
      identityConnection.userId !== transaction.targetUserId
    ) {
      throw new TraktConflictError('trakt_account_owned_by_another_user');
    }

    const connection =
      targetConnection ??
      traktConnectionRepository.create(manager, {
        userId: transaction.targetUserId,
        traktUserId: profile.traktUserId,
        tokenVersion: 0,
      });
    const saved = await traktConnectionRepository.saveCompletion(
      manager,
      connection,
      {
        actorUserId: authorization.actor.id,
        profile,
        tokens,
        now,
      }
    );

    return { connectionId: saved.id };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as {
      code?: unknown;
      errno?: unknown;
    };
    return (
      driverError.code === '23505' ||
      driverError.code === 'SQLITE_CONSTRAINT' ||
      driverError.errno === 19
    );
  }
}

export const traktConnectionLifecycleService =
  new TraktConnectionLifecycleService();
