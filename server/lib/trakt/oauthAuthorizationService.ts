import {
  TraktApiError,
  type TraktProfile,
  type TraktTokenSet,
} from '@server/api/trakt';
import type { TraktOAuthTransaction } from '@server/entity/TraktOAuthTransaction';
import type {
  TraktAllowedOrigin,
  TraktAuthorizationResponse,
  TraktSafeResultCode,
} from '@server/interfaces/api/traktInterfaces';
import { getSettings } from '@server/lib/settings';
import { traktAuthorizationPolicy } from '@server/lib/trakt/authorizationPolicy';
import {
  isAllowedTraktOrigin,
  isTraktConfigured,
} from '@server/lib/trakt/config';
import { traktConfigurationMutex } from '@server/lib/trakt/configurationMutex';
import {
  TerminalTransactionError,
  TraktConflictError,
  invalidateWatchStatus,
  traktConnectionLifecycleService,
} from '@server/lib/trakt/connectionLifecycleService';
import { traktOAuthTransactionService } from '@server/lib/trakt/oauthTransactionService';
import { traktApiFactory } from '@server/lib/trakt/traktApiFactory';
import logger from '@server/logger';

export type TraktAuthorizationCompletion =
  | {
      canNotifyOpener: true;
      transactionId: string;
      origin: TraktAllowedOrigin;
      status: 'succeeded' | 'failed';
      resultCode: TraktSafeResultCode | null;
      httpStatus: 200 | 400 | 409;
    }
  | {
      canNotifyOpener: false;
      status: 'failed';
      resultCode: 'invalid_state';
      httpStatus: 400;
    };

type NotifiableCompletion = Extract<
  TraktAuthorizationCompletion,
  { canNotifyOpener: true }
>;

class TraktOAuthAuthorizationService {
  public startAuthorization(input: {
    actorUserId: number;
    targetUserId: number;
    origin: string;
  }): Promise<TraktAuthorizationResponse> {
    return traktConfigurationMutex.run(async () => {
      if (!isAllowedTraktOrigin(input.origin)) {
        throw new Error('Invalid Trakt callback origin');
      }

      const settings = getSettings().trakt;
      if (!isTraktConfigured(settings)) {
        throw new Error('Trakt application is not configured');
      }

      const authorization = await traktAuthorizationPolicy.resolve(
        input.actorUserId,
        input.targetUserId
      );
      if (!authorization.allowed) {
        if (authorization.reason === 'invalid_state') {
          throw new Error('Trakt authorization actor is missing');
        }
        if (authorization.reason === 'target_missing') {
          throw new Error('Trakt authorization target is missing');
        }
        throw new Error('Trakt authorization actor is not authorized');
      }

      const { transaction, rawState, expiresAt } =
        await traktOAuthTransactionService.create({
          actorUserId: authorization.actor.id,
          targetUserId: authorization.target.id,
          origin: input.origin,
        });

      logger.info('Trakt OAuth authorization started', {
        label: 'Trakt',
        operation: 'oauth_start',
        actorUserId: authorization.actor.id,
        targetUserId: authorization.target.id,
      });

      return {
        transactionId: transaction.id,
        authorizationUrl: traktApiFactory
          .create(settings)
          .buildAuthorizationUrl(rawState),
        callbackOrigin: input.origin,
        expiresAt: expiresAt.toISOString(),
      };
    });
  }

  public async completeAuthorization(input: {
    state: string;
    code?: string;
    error?: string;
  }): Promise<TraktAuthorizationCompletion> {
    const claimed = await traktConfigurationMutex.run(() =>
      traktOAuthTransactionService.claim(input.state)
    );
    if (!claimed) {
      return this.invalidState();
    }
    if ('completion' in claimed) {
      return this.completionFor(
        claimed.completion.transactionId,
        claimed.completion.origin,
        claimed.completion.resultCode
      );
    }

    const transaction = claimed.transaction;
    if (!isAllowedTraktOrigin(transaction.origin)) {
      await traktConfigurationMutex.run(() =>
        traktOAuthTransactionService.failProcessing(
          transaction.id,
          'invalid_state'
        )
      );
      return this.invalidState();
    }

    const authorization = await traktAuthorizationPolicy.resolveActorFirst(
      transaction.actorUserId,
      transaction.targetUserId
    );
    if (!authorization.allowed) {
      return this.finishFailure(transaction, authorization.reason);
    }

    if (input.error || !input.code) {
      return this.finishFailure(transaction, 'access_denied');
    }

    const settings = getSettings().trakt;
    if (!isTraktConfigured(settings)) {
      return this.finishFailure(
        transaction,
        'trakt_application_not_configured'
      );
    }

    let tokens: TraktTokenSet;
    let profile: TraktProfile;
    try {
      tokens = await traktApiFactory.create(settings).exchangeCode(input.code);
      profile = await traktApiFactory
        .create(settings, tokens.accessToken)
        .getProfile();
    } catch (error) {
      // The user-facing code stays generic; without this a failed handshake and a
      // rejected one are indistinguishable in the logs.
      logger.error('Trakt OAuth handshake failed', {
        label: 'Trakt',
        operation: 'oauth_handshake_failed',
        targetUserId: transaction.targetUserId ?? null,
        errorClass: error instanceof Error ? error.name : 'UnknownError',
        errorCode: error instanceof TraktApiError ? error.code : undefined,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      return this.finishFailure(transaction, 'token_exchange_failed');
    }

    try {
      const persisted = await traktConfigurationMutex.run(() =>
        traktConnectionLifecycleService.persistCompletion(
          transaction.id,
          tokens,
          profile
        )
      );
      invalidateWatchStatus(persisted.connectionId);
      const completion = this.completionFor(
        transaction.id,
        transaction.origin,
        null
      );
      this.logCompletion(
        completion,
        transaction.targetUserId ?? null,
        persisted.connectionId
      );
      return completion;
    } catch (error) {
      const requestedResultCode =
        error instanceof TraktConflictError
          ? error.code
          : error instanceof TerminalTransactionError
            ? error.resultCode
            : 'token_exchange_failed';
      return this.finishFailure(transaction, requestedResultCode);
    }
  }

  private async finishFailure(
    transaction: TraktOAuthTransaction,
    requestedResultCode: TraktSafeResultCode
  ): Promise<NotifiableCompletion> {
    const resultCode = await traktConfigurationMutex.run(() =>
      traktOAuthTransactionService.failProcessing(
        transaction.id,
        requestedResultCode
      )
    );
    const completion = this.completionFor(
      transaction.id,
      transaction.origin,
      resultCode
    );
    this.logCompletion(completion, transaction.targetUserId ?? null, null);
    return completion;
  }

  private completionFor(
    transactionId: string,
    origin: TraktAllowedOrigin,
    resultCode: TraktSafeResultCode | null
  ): NotifiableCompletion {
    return {
      canNotifyOpener: true,
      transactionId,
      origin,
      status: resultCode === null ? 'succeeded' : 'failed',
      resultCode,
      httpStatus: resultCode === null ? 200 : this.httpStatusFor(resultCode),
    };
  }

  private logCompletion(
    completion: NotifiableCompletion,
    targetUserId: number | null,
    connectionId: number | null
  ): void {
    logger.info('Trakt OAuth completion finished', {
      label: 'Trakt',
      operation: 'oauth_complete',
      connectionId,
      targetUserId,
      httpClass: `${Math.floor(completion.httpStatus / 100)}xx`,
      resultCode: completion.resultCode ?? 'succeeded',
    });
  }

  private invalidState(): TraktAuthorizationCompletion {
    return {
      canNotifyOpener: false,
      status: 'failed',
      resultCode: 'invalid_state',
      httpStatus: 400,
    };
  }

  private httpStatusFor(resultCode: TraktSafeResultCode): 400 | 409 {
    return resultCode === 'target_has_different_trakt_account' ||
      resultCode === 'trakt_account_owned_by_another_user'
      ? 409
      : 400;
  }
}

export const traktOAuthAuthorizationService =
  new TraktOAuthAuthorizationService();
