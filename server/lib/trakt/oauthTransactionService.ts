import { getRepository } from '@server/datasource';
import {
  TraktOAuthTransaction,
  TraktOAuthTransactionStatus,
} from '@server/entity/TraktOAuthTransaction';
import type {
  TraktAllowedOrigin,
  TraktOAuthStatusResponse,
  TraktSafeResultCode,
} from '@server/interfaces/api/traktInterfaces';
import { isAllowedTraktOrigin } from '@server/lib/trakt/config';
import { traktConfigurationMutex } from '@server/lib/trakt/configurationMutex';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  In,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  type EntityManager,
} from 'typeorm';

const AUTHORIZATION_LIFETIME_MS = 10 * 60 * 1000;
const PROCESSING_LIFETIME_MS = 2 * 60 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

const safeResultCodes = new Set<TraktSafeResultCode>([
  'access_denied',
  'actor_not_authorized',
  'client_id_changed',
  'confirm_reconnect_all_required',
  'invalid_state',
  'oauth_interrupted',
  'state_expired',
  'state_replayed',
  'target_has_different_trakt_account',
  'target_missing',
  'token_exchange_failed',
  'trakt_account_owned_by_another_user',
  'trakt_application_not_configured',
]);

export type TraktTransactionClaim =
  | { transaction: TraktOAuthTransaction }
  | {
      completion: {
        transactionId: string;
        origin: TraktAllowedOrigin;
        resultCode: 'state_expired' | 'state_replayed';
      };
    }
  | null;

class TraktOAuthTransactionService {
  public async create(input: {
    actorUserId: number;
    targetUserId: number;
    origin: TraktAllowedOrigin;
  }): Promise<{
    transaction: TraktOAuthTransaction;
    rawState: string;
    expiresAt: Date;
  }> {
    const rawState = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AUTHORIZATION_LIFETIME_MS);
    const repo = getRepository(TraktOAuthTransaction);
    const transaction = repo.create({
      id: randomUUID(),
      stateHash: this.hashState(rawState),
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      origin: input.origin,
      status: TraktOAuthTransactionStatus.PENDING,
      resultCode: null,
      expiresAt,
      consumedAt: null,
    });
    await repo.save(transaction);
    return { transaction, rawState, expiresAt };
  }

  public async claim(rawState: string): Promise<TraktTransactionClaim> {
    const repo = getRepository(TraktOAuthTransaction);
    const stateHash = this.hashState(rawState);
    const now = new Date();
    const claim = await repo.update(
      {
        stateHash,
        status: TraktOAuthTransactionStatus.PENDING,
        consumedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
      {
        status: TraktOAuthTransactionStatus.PROCESSING,
        expiresAt: new Date(now.getTime() + PROCESSING_LIFETIME_MS),
      }
    );
    const transaction = await repo.findOneBy({ stateHash });

    if (claim.affected === 1 && transaction) {
      return { transaction };
    }
    if (!transaction || !isAllowedTraktOrigin(transaction.origin)) {
      if (transaction) {
        await repo.update(
          {
            id: transaction.id,
            status: In([
              TraktOAuthTransactionStatus.PENDING,
              TraktOAuthTransactionStatus.PROCESSING,
            ]),
            consumedAt: IsNull(),
          },
          {
            status: TraktOAuthTransactionStatus.FAILED,
            resultCode: 'invalid_state',
            consumedAt: now,
          }
        );
      }
      return null;
    }

    let resultCode: 'state_expired' | 'state_replayed' = 'state_replayed';
    if (
      transaction.status === TraktOAuthTransactionStatus.PENDING &&
      transaction.expiresAt <= now
    ) {
      const expired = await repo.update(
        {
          id: transaction.id,
          status: TraktOAuthTransactionStatus.PENDING,
          consumedAt: IsNull(),
          expiresAt: LessThanOrEqual(now),
        },
        {
          status: TraktOAuthTransactionStatus.FAILED,
          resultCode: 'state_expired',
          consumedAt: now,
        }
      );
      resultCode = expired.affected === 1 ? 'state_expired' : 'state_replayed';
    }

    return {
      completion: {
        transactionId: transaction.id,
        origin: transaction.origin,
        resultCode,
      },
    };
  }

  public async failProcessing(
    transactionId: string,
    resultCode: TraktSafeResultCode
  ): Promise<TraktSafeResultCode> {
    const repo = getRepository(TraktOAuthTransaction);
    const failure = await repo.update(
      {
        id: transactionId,
        status: TraktOAuthTransactionStatus.PROCESSING,
        consumedAt: IsNull(),
      },
      {
        status: TraktOAuthTransactionStatus.FAILED,
        resultCode,
        consumedAt: new Date(),
      }
    );
    if (failure.affected === 1) {
      return resultCode;
    }

    const durable = await repo.findOneBy({ id: transactionId });
    return this.toSafeResultCode(durable?.resultCode) ?? 'invalid_state';
  }

  public getStatus(
    transactionId: string,
    actorUserId: number
  ): Promise<TraktOAuthStatusResponse> {
    return traktConfigurationMutex.run(() =>
      this.loadStatus(transactionId, actorUserId)
    );
  }

  private async loadStatus(
    transactionId: string,
    actorUserId: number
  ): Promise<TraktOAuthStatusResponse> {
    const repo = getRepository(TraktOAuthTransaction);
    let transaction = await repo.findOneBy({
      id: transactionId,
      actorUserId,
    });
    if (!transaction) {
      throw new Error('Trakt OAuth transaction not found');
    }

    const now = new Date();
    if (
      transaction.status === TraktOAuthTransactionStatus.PENDING &&
      transaction.expiresAt <= now
    ) {
      await repo.update(
        {
          id: transaction.id,
          actorUserId,
          status: TraktOAuthTransactionStatus.PENDING,
          consumedAt: IsNull(),
          expiresAt: LessThanOrEqual(now),
        },
        {
          status: TraktOAuthTransactionStatus.FAILED,
          resultCode: 'state_expired',
          consumedAt: now,
        }
      );
      transaction = await repo.findOneByOrFail({
        id: transaction.id,
        actorUserId,
      });
    } else if (
      transaction.status === TraktOAuthTransactionStatus.PROCESSING &&
      transaction.expiresAt <= now
    ) {
      await repo.update(
        {
          id: transaction.id,
          actorUserId,
          status: TraktOAuthTransactionStatus.PROCESSING,
          consumedAt: IsNull(),
          expiresAt: LessThanOrEqual(now),
        },
        {
          status: TraktOAuthTransactionStatus.FAILED,
          resultCode: 'oauth_interrupted',
          consumedAt: now,
        }
      );
      transaction = await repo.findOneByOrFail({
        id: transaction.id,
        actorUserId,
      });
    }

    if (
      transaction.status === TraktOAuthTransactionStatus.PENDING ||
      transaction.status === TraktOAuthTransactionStatus.PROCESSING
    ) {
      return { status: 'pending', resultCode: null };
    }

    return {
      status:
        transaction.status === TraktOAuthTransactionStatus.SUCCEEDED
          ? 'succeeded'
          : 'failed',
      resultCode: this.toSafeResultCode(transaction.resultCode),
    };
  }

  public async deleteExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RETENTION_MS);
    const result = await getRepository(TraktOAuthTransaction)
      .createQueryBuilder()
      .delete()
      .where('("status" IN (:...unconsumedStatuses) AND "expiresAt" < :cutoff)')
      .orWhere(
        '("status" IN (:...terminalStatuses) AND "consumedAt" < :cutoff)'
      )
      .setParameters({
        unconsumedStatuses: [
          TraktOAuthTransactionStatus.PENDING,
          TraktOAuthTransactionStatus.PROCESSING,
        ],
        terminalStatuses: [
          TraktOAuthTransactionStatus.SUCCEEDED,
          TraktOAuthTransactionStatus.FAILED,
        ],
        cutoff,
      })
      .execute();

    return result.affected ?? 0;
  }

  public async failActiveForClientIdChange(
    manager: EntityManager,
    now: Date
  ): Promise<void> {
    await manager
      .getRepository(TraktOAuthTransaction)
      .createQueryBuilder()
      .update(TraktOAuthTransaction)
      .set({
        status: TraktOAuthTransactionStatus.FAILED,
        resultCode: 'client_id_changed',
        consumedAt: now,
      })
      .where('"status" IN (:...statuses)', {
        statuses: [
          TraktOAuthTransactionStatus.PENDING,
          TraktOAuthTransactionStatus.PROCESSING,
        ],
      })
      .execute();
  }

  public async markSucceeded(
    manager: EntityManager,
    transactionId: string,
    now: Date
  ): Promise<
    | { succeeded: true; transaction: TraktOAuthTransaction }
    | { succeeded: false; resultCode: TraktSafeResultCode }
  > {
    const repo = manager.getRepository(TraktOAuthTransaction);
    const terminal = await repo.update(
      {
        id: transactionId,
        status: TraktOAuthTransactionStatus.PROCESSING,
        consumedAt: IsNull(),
      },
      {
        status: TraktOAuthTransactionStatus.SUCCEEDED,
        resultCode: null,
        consumedAt: now,
      }
    );
    if (terminal.affected !== 1) {
      const existing = await repo.findOneBy({ id: transactionId });
      return {
        succeeded: false,
        resultCode:
          this.toSafeResultCode(existing?.resultCode) ?? 'invalid_state',
      };
    }

    return {
      succeeded: true,
      transaction: await repo.findOneByOrFail({ id: transactionId }),
    };
  }

  public toSafeResultCode(
    value: string | null | undefined
  ): TraktSafeResultCode | null {
    return value && safeResultCodes.has(value as TraktSafeResultCode)
      ? (value as TraktSafeResultCode)
      : null;
  }

  private hashState(rawState: string): string {
    return createHash('sha256').update(rawState).digest('hex');
  }
}

export const traktOAuthTransactionService = new TraktOAuthTransactionService();
