import type TraktAPI from '@server/api/trakt';
import type {
  TraktAuthorizationResponse,
  TraktOAuthStatusResponse,
  TraktPublicSettings,
  TraktSettingsUpdate,
} from '@server/interfaces/api/traktInterfaces';
import { traktApplicationSettingsService } from '@server/lib/trakt/applicationSettingsService';
import { traktAuthenticatedApiService } from '@server/lib/trakt/authenticatedApiService';
import {
  TraktConflictError,
  traktConnectionLifecycleService,
  type TraktUnlinkResult,
} from '@server/lib/trakt/connectionLifecycleService';
import {
  traktOAuthAuthorizationService,
  type TraktAuthorizationCompletion,
} from '@server/lib/trakt/oauthAuthorizationService';
import { traktOAuthTransactionService } from '@server/lib/trakt/oauthTransactionService';

export { TraktConflictError };
export type { TraktAuthorizationCompletion, TraktUnlinkResult };

export class TraktConnectionService {
  public updateApplicationSettings(
    actorUserId: number,
    update: TraktSettingsUpdate
  ): Promise<TraktPublicSettings> {
    return traktApplicationSettingsService.updateApplicationSettings(
      actorUserId,
      update
    );
  }

  public startAuthorization(input: {
    actorUserId: number;
    targetUserId: number;
    origin: string;
  }): Promise<TraktAuthorizationResponse> {
    return traktOAuthAuthorizationService.startAuthorization(input);
  }

  public completeAuthorization(input: {
    state: string;
    code?: string;
    error?: string;
  }): Promise<TraktAuthorizationCompletion> {
    return traktOAuthAuthorizationService.completeAuthorization(input);
  }

  public getTransactionStatus(
    transactionId: string,
    actorUserId: number
  ): Promise<TraktOAuthStatusResponse> {
    return traktOAuthTransactionService.getStatus(transactionId, actorUserId);
  }

  public deleteExpiredTransactions(now = new Date()): Promise<number> {
    return traktOAuthTransactionService.deleteExpired(now);
  }

  public withAuthenticatedApi<T>(
    userId: number,
    operation: (api: TraktAPI) => Promise<T>
  ): Promise<T> {
    return traktAuthenticatedApiService.withAuthenticatedApi(userId, operation);
  }

  public unlink(
    targetUserId: number,
    actorUserId = targetUserId
  ): Promise<TraktUnlinkResult> {
    return traktConnectionLifecycleService.unlink(targetUserId, actorUserId);
  }
}
