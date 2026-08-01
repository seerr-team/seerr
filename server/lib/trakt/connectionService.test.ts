import TraktAPI, { TraktApiError } from '@server/api/trakt';
import dataSource, { getRepository } from '@server/datasource';
import {
  TraktConnection,
  TraktConnectionStatus,
} from '@server/entity/TraktConnection';
import {
  TraktOAuthTransaction,
  TraktOAuthTransactionStatus,
} from '@server/entity/TraktOAuthTransaction';
import { User } from '@server/entity/User';
import cacheManager from '@server/lib/cache';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { setupTestDb } from '@server/test/db';
import axios from 'axios';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type {
  EntitySubscriberInterface,
  InsertEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import { TraktConnectionService } from './connectionService';

setupTestDb();

const allowedOrigin = 'https://requests.example.com';

const users = () => getRepository(User);
const transactions = () => getRepository(TraktOAuthTransaction);
const connections = () => getRepository(TraktConnection);

const connectionWithTokens = async (
  userId: number,
  input: {
    expiresAt?: Date;
    tokenVersion?: number;
    accessToken?: string;
    refreshToken?: string;
  } = {}
) =>
  connections().save(
    connections().create({
      userId,
      traktUserId: `trakt-${userId}`,
      status: TraktConnectionStatus.ACTIVE,
      accessToken: input.accessToken ?? 'old-access-token',
      refreshToken: input.refreshToken ?? 'old-refresh-token',
      expiresAt: input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      tokenVersion: input.tokenVersion ?? 3,
      connectedByUserId: userId,
    })
  );

const connectionWithHiddenTokens = (id: number) =>
  connections()
    .createQueryBuilder('connection')
    .addSelect(['connection.accessToken', 'connection.refreshToken'])
    .where('connection.id = :id', { id })
    .getOneOrFail();

const mockProfileByAccessToken = () =>
  mock.method(
    TraktAPI.prototype,
    'getProfile',
    async function (this: TraktAPI) {
      const accessToken = (this as unknown as { accessToken?: string })
        .accessToken;
      return {
        traktUserId: '101',
        username: accessToken ?? null,
        slug: 'trakt-user',
        displayName: 'Trakt User',
      };
    }
  );

const admin = () =>
  users().findOneByOrFail({
    email: 'admin@seerr.dev',
  });
const friend = () =>
  users().findOneByOrFail({
    email: 'friend@seerr.dev',
  });

const rawStateFrom = (authorizationUrl: string): string => {
  const state = new URL(authorizationUrl).searchParams.get('state');
  assert.ok(state);
  return state;
};

const mockSuccessfulTrakt = (
  profile: {
    traktUserId: string;
    username: string | null;
    slug: string | null;
    displayName: string | null;
  } = {
    traktUserId: '101',
    username: 'trakt-user',
    slug: 'trakt-user',
    displayName: 'Trakt User',
  }
) => {
  mock.method(TraktAPI.prototype, 'exchangeCode', async () => ({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  }));
  mock.method(TraktAPI.prototype, 'getProfile', async () => profile);
};

beforeEach(() => {
  getSettings().main.applicationUrl = allowedOrigin;
  getSettings().trakt = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
  };
  cacheManager.getCache('trakt-watch-status').flush();
});

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

describe('TraktConnectionService', () => {
  it('updates initial application credentials without reconnect confirmation and never returns the secret', async () => {
    const actor = await admin();
    getSettings().trakt.clientId = '';
    getSettings().trakt.clientSecret = '';
    mock.method(getSettings(), 'save', async () => undefined);

    const result = await new TraktConnectionService().updateApplicationSettings(
      actor.id,
      {
        clientId: '  initial-client  ',
        clientSecret: 'initial-secret',
      }
    );

    assert.deepEqual(result, {
      clientId: 'initial-client',
      clientSecretConfigured: true,
      callbackUrl: 'https://requests.example.com/api/v1/auth/trakt/callback',
    });
    assert.equal(JSON.stringify(result).includes('initial-secret'), false);
  });

  it('preserves connections for secret-only updates and rejects an explicitly empty secret', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id);
    mock.method(getSettings(), 'save', async () => undefined);
    const service = new TraktConnectionService();

    await service.updateApplicationSettings(actor.id, {
      clientId: ' client-id ',
      clientSecret: 'replacement-secret',
    });

    const stored = await connectionWithHiddenTokens(connection.id);
    assert.equal(stored.accessToken, 'old-access-token');
    assert.equal(stored.refreshToken, 'old-refresh-token');
    assert.equal(stored.tokenVersion, 3);
    assert.equal(stored.status, TraktConnectionStatus.ACTIVE);
    await assert.rejects(
      service.updateApplicationSettings(actor.id, {
        clientId: 'client-id',
        clientSecret: '',
      }),
      /secret.*empty/i
    );
  });

  it('requires confirmation for a client-ID change and safely invalidates every connection and OAuth transaction', async () => {
    const actor = await admin();
    const friendUser = await friend();
    const first = await connectionWithTokens(actor.id, { tokenVersion: 2 });
    const second = await connectionWithTokens(friendUser.id, {
      tokenVersion: 9,
    });
    const service = new TraktConnectionService();
    const pending = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    const processing = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: friendUser.id,
      origin: allowedOrigin,
    });
    await transactions().update(processing.transactionId, {
      status: TraktOAuthTransactionStatus.PROCESSING,
    });
    const cache = cacheManager.getCache('trakt-watch-status').data;
    cache.set(`connection:${first.id}:version:2:movie:1`, true);
    cache.set(`connection:${second.id}:version:9:tv:1`, true);
    mock.method(getSettings(), 'save', async () => undefined);

    await assert.rejects(
      service.updateApplicationSettings(actor.id, {
        clientId: 'replacement-client',
      }),
      /confirm.*reconnect/i
    );
    await service.updateApplicationSettings(actor.id, {
      clientId: 'replacement-client',
      confirmReconnectAll: true,
    });

    for (const [id, version] of [
      [first.id, 3],
      [second.id, 10],
    ] as const) {
      const stored = await connectionWithHiddenTokens(id);
      assert.equal(stored.accessToken, null);
      assert.equal(stored.refreshToken, null);
      assert.equal(stored.expiresAt, null);
      assert.equal(stored.tokenVersion, version);
      assert.equal(stored.status, TraktConnectionStatus.RECONNECT_REQUIRED);
    }
    assert.equal(cache.keys().length, 0);
    for (const id of [pending.transactionId, processing.transactionId]) {
      const transaction = await transactions().findOneByOrFail({ id });
      assert.equal(transaction.status, TraktOAuthTransactionStatus.FAILED);
      assert.equal(transaction.resultCode, 'client_id_changed');
      assert.ok(transaction.consumedAt);
    }
  });

  it('leaves connections untouched and restores in-memory credentials when settings persistence fails', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id);
    mock.method(getSettings(), 'save', async () => {
      throw new Error('disk unavailable');
    });

    await assert.rejects(
      new TraktConnectionService().updateApplicationSettings(actor.id, {
        clientId: 'replacement-client',
        clientSecret: 'replacement-secret',
        confirmReconnectAll: true,
      }),
      /disk unavailable/
    );

    assert.deepEqual(getSettings().trakt, {
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
    const stored = await connectionWithHiddenTokens(connection.id);
    assert.equal(
      stored.accessToken,
      'old-access-token',
      'a failed settings write must not invalidate connections'
    );
    assert.equal(stored.refreshToken, 'old-refresh-token');
    assert.equal(stored.tokenVersion, 3);
    assert.equal(stored.status, TraktConnectionStatus.ACTIVE);
  });

  it('does not activate an old-client callback that finishes after a client-ID change', async () => {
    const actor = await admin();
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    let exchangeStarted!: () => void;
    const exchangeWasStarted = new Promise<void>((resolve) => {
      exchangeStarted = resolve;
    });
    let releaseExchange!: () => void;
    const exchangeCanFinish = new Promise<void>((resolve) => {
      releaseExchange = resolve;
    });
    mock.method(TraktAPI.prototype, 'exchangeCode', async () => {
      exchangeStarted();
      await exchangeCanFinish;
      return {
        accessToken: 'old-client-access-token',
        refreshToken: 'old-client-refresh-token',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      };
    });
    mock.method(TraktAPI.prototype, 'getProfile', async () => ({
      traktUserId: 'old-client-profile',
      username: 'old-client-user',
      slug: 'old-client-user',
      displayName: 'Old client user',
    }));
    mock.method(getSettings(), 'save', async () => undefined);

    const completion = service.completeAuthorization({
      state: rawStateFrom(start.authorizationUrl),
      code: 'old-client-code',
    });
    await exchangeWasStarted;
    await service.updateApplicationSettings(actor.id, {
      clientId: 'replacement-client',
      confirmReconnectAll: true,
    });
    releaseExchange();

    assert.deepEqual(await completion, {
      canNotifyOpener: true,
      transactionId: start.transactionId,
      origin: allowedOrigin,
      status: 'failed',
      resultCode: 'client_id_changed',
      httpStatus: 400,
    });
    assert.equal(await connections().count(), 0);
    const transaction = await transactions().findOneByOrFail({
      id: start.transactionId,
    });
    assert.equal(transaction.status, TraktOAuthTransactionStatus.FAILED);
    assert.equal(transaction.resultCode, 'client_id_changed');
  });

  it('rejects an origin outside the production allowlist', async () => {
    const actor = await admin();

    await assert.rejects(
      new TraktConnectionService().startAuthorization({
        actorUserId: actor.id,
        targetUserId: actor.id,
        origin: 'https://attacker.invalid',
      }),
      /invalid.*origin/i
    );
    assert.equal(await transactions().count(), 0);
  });

  it('rejects incomplete installation credentials before creating a transaction', async () => {
    const actor = await admin();
    getSettings().trakt = { clientId: ' ', clientSecret: 'client-secret' };

    await assert.rejects(
      new TraktConnectionService().startAuthorization({
        actorUserId: actor.id,
        targetUserId: actor.id,
        origin: allowedOrigin,
      }),
      /not configured/i
    );
    assert.equal(await transactions().count(), 0);
  });

  it('rejects a missing target before creating a transaction', async () => {
    const actor = await admin();

    await assert.rejects(
      new TraktConnectionService().startAuthorization({
        actorUserId: actor.id,
        targetUserId: 999_999,
        origin: allowedOrigin,
      }),
      /target.*missing/i
    );
    assert.equal(await transactions().count(), 0);
  });

  it('stores only the state hash for ten minutes and returns a forced-login URL', async () => {
    const actor = await admin();
    const startedAt = Date.now();
    const result = await new TraktConnectionService().startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    const rawState = rawStateFrom(result.authorizationUrl);
    const row = await transactions().findOneByOrFail({
      id: result.transactionId,
    });

    assert.equal(
      row.stateHash,
      createHash('sha256').update(rawState).digest('hex')
    );
    assert.equal(JSON.stringify(row).includes(rawState), false);
    assert.equal(row.actorUserId, actor.id);
    assert.equal(row.targetUserId, actor.id);
    assert.equal(row.origin, allowedOrigin);
    assert.equal(
      new URL(result.authorizationUrl).searchParams.get('prompt'),
      'login'
    );
    assert.ok(row.expiresAt.getTime() >= startedAt + 599_000);
    assert.ok(row.expiresAt.getTime() <= Date.now() + 601_000);
  });

  it('audits OAuth transaction creation with safe actor and target attribution', async () => {
    const actor = await admin();
    const target = await friend();
    const entries: unknown[] = [];
    const listener = (entry: unknown) => entries.push(entry);
    const wasSilent = logger.silent;
    logger.silent = false;
    logger.on('data', listener);

    let authorizationUrl: string;
    try {
      ({ authorizationUrl } =
        await new TraktConnectionService().startAuthorization({
          actorUserId: actor.id,
          targetUserId: target.id,
          origin: allowedOrigin,
        }));
    } finally {
      logger.off('data', listener);
      logger.silent = wasSilent;
    }

    const auditEntry = entries.find(
      (entry) => (entry as { operation?: unknown }).operation === 'oauth_start'
    ) as Record<string, unknown> | undefined;
    assert.ok(auditEntry);
    assert.equal(auditEntry.actorUserId, actor.id);
    assert.equal(auditEntry.targetUserId, target.id);

    const rawState = rawStateFrom(authorizationUrl);
    const serialized = JSON.stringify(auditEntry);
    assert.equal(serialized.includes(rawState), false);
    assert.equal(serialized.includes(authorizationUrl), false);
    assert.doesNotMatch(serialized, /client-id|client-secret/);
    assert.doesNotMatch(
      serialized,
      /"(?:state|stateHash|authorizationUrl|clientId|clientSecret|accessToken|refreshToken)"\s*:/
    );
  });

  it('consumes callback state once and rejects replay, unknown state, and malformed stored origins safely', async () => {
    const actor = await admin();
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    const state = rawStateFrom(start.authorizationUrl);
    mockSuccessfulTrakt();

    assert.equal(
      (await service.completeAuthorization({ state, code: 'oauth-code' }))
        .status,
      'succeeded'
    );
    assert.deepEqual(
      await service.completeAuthorization({ state, code: 'oauth-code' }),
      {
        canNotifyOpener: true,
        transactionId: start.transactionId,
        origin: allowedOrigin,
        status: 'failed',
        resultCode: 'state_replayed',
        httpStatus: 400,
      }
    );
    assert.deepEqual(
      await service.completeAuthorization({
        state: 'unknown-state',
        code: 'oauth-code',
      }),
      {
        canNotifyOpener: false,
        status: 'failed',
        resultCode: 'invalid_state',
        httpStatus: 400,
      }
    );

    const malformed = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    await transactions().update(malformed.transactionId, {
      origin: 'javascript:alert(1)',
    });
    assert.deepEqual(
      await service.completeAuthorization({
        state: rawStateFrom(malformed.authorizationUrl),
        code: 'oauth-code',
      }),
      {
        canNotifyOpener: false,
        status: 'failed',
        resultCode: 'invalid_state',
        httpStatus: 400,
      }
    );
  });

  it('fails expired callback state and atomically expires pending polling', async () => {
    const actor = await admin();
    const service = new TraktConnectionService();
    const callbackStart = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    await transactions().update(callbackStart.transactionId, {
      expiresAt: new Date(Date.now() - 1),
    });

    assert.equal(
      (
        await service.completeAuthorization({
          state: rawStateFrom(callbackStart.authorizationUrl),
          code: 'oauth-code',
        })
      ).resultCode,
      'state_expired'
    );

    const pollStart = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    await transactions().update(pollStart.transactionId, {
      expiresAt: new Date(Date.now() - 1),
    });
    assert.deepEqual(
      await service.getTransactionStatus(pollStart.transactionId, actor.id),
      { status: 'failed', resultCode: 'state_expired' }
    );
    const row = await transactions().findOneByOrFail({
      id: pollStart.transactionId,
    });
    assert.equal(row.status, TraktOAuthTransactionStatus.FAILED);
    assert.ok(row.consumedAt);
  });

  it('expires callback and polling state exactly at the deadline', async () => {
    const actor = await admin();
    const service = new TraktConnectionService();
    const callbackStart = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    const pollStart = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    const deadline = new Date('2031-01-01T00:00:00.000Z');
    await transactions().update(
      [callbackStart.transactionId, pollStart.transactionId],
      { expiresAt: deadline }
    );
    mock.timers.enable({ apis: ['Date'], now: deadline.getTime() });

    assert.equal(
      (
        await service.completeAuthorization({
          state: rawStateFrom(callbackStart.authorizationUrl),
          code: 'oauth-code',
        })
      ).resultCode,
      'state_expired'
    );
    assert.deepEqual(
      await service.getTransactionStatus(pollStart.transactionId, actor.id),
      { status: 'failed', resultCode: 'state_expired' }
    );
  });

  it('reconnects the same target and stable Trakt identity', async () => {
    const actor = await admin();
    const existing = await connections().save(
      connections().create({
        userId: actor.id,
        traktUserId: '101',
        username: 'old-name',
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
        tokenVersion: 4,
      })
    );
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    mockSuccessfulTrakt();

    const result = await service.completeAuthorization({
      state: rawStateFrom(start.authorizationUrl),
      code: 'oauth-code',
    });

    assert.equal(result.status, 'succeeded');
    assert.equal(await connections().count(), 1);
    const updated = await connections()
      .createQueryBuilder('connection')
      .addSelect(['connection.accessToken', 'connection.refreshToken'])
      .where('connection.id = :id', { id: existing.id })
      .getOneOrFail();
    assert.equal(updated.id, existing.id);
    assert.equal(updated.tokenVersion, 5);
    assert.equal(updated.accessToken, 'new-access-token');
  });

  it('maps target and identity conflicts to their safe 409 codes', async () => {
    const actor = await admin();
    const other = await friend();
    await connections().save(
      connections().create({
        userId: actor.id,
        traktUserId: 'different-id',
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
      })
    );
    const targetService = new TraktConnectionService();
    const targetStart = await targetService.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    mockSuccessfulTrakt();
    const targetResult = await targetService.completeAuthorization({
      state: rawStateFrom(targetStart.authorizationUrl),
      code: 'oauth-code',
    });
    assert.equal(targetResult.resultCode, 'target_has_different_trakt_account');
    assert.equal(targetResult.httpStatus, 409);

    await connections().clear();
    await connections().save(
      connections().create({
        userId: other.id,
        traktUserId: '101',
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
      })
    );
    const identityStart = await targetService.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    const identityResult = await targetService.completeAuthorization({
      state: rawStateFrom(identityStart.authorizationUrl),
      code: 'oauth-code',
    });
    assert.equal(
      identityResult.resultCode,
      'trakt_account_owned_by_another_user'
    );
    assert.equal(identityResult.httpStatus, 409);
  });

  it('stores a successful connection and clears the OAuth result atomically', async () => {
    const actor = await admin();
    const target = await friend();
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: target.id,
      origin: allowedOrigin,
    });
    mockSuccessfulTrakt();

    const before = Date.now();
    const result = await service.completeAuthorization({
      state: rawStateFrom(start.authorizationUrl),
      code: 'oauth-code',
    });
    const connection = await connections()
      .createQueryBuilder('connection')
      .addSelect(['connection.accessToken', 'connection.refreshToken'])
      .where('connection.userId = :targetId', { targetId: target.id })
      .getOneOrFail();
    const transaction = await transactions().findOneByOrFail({
      id: start.transactionId,
    });

    assert.equal(result.status, 'succeeded');
    assert.equal(connection.traktUserId, '101');
    assert.equal(connection.username, 'trakt-user');
    assert.equal(connection.slug, 'trakt-user');
    assert.equal(connection.displayName, 'Trakt User');
    assert.equal(connection.status, TraktConnectionStatus.ACTIVE);
    assert.equal(connection.connectedByUserId, actor.id);
    assert.equal(connection.tokenVersion, 1);
    assert.equal(connection.accessToken, 'new-access-token');
    assert.equal(connection.refreshToken, 'new-refresh-token');
    assert.equal(
      connection.expiresAt?.toISOString(),
      '2030-01-01T00:00:00.000Z'
    );
    assert.ok((connection.lastValidatedAt?.getTime() ?? 0) >= before);
    assert.equal(transaction.status, TraktOAuthTransactionStatus.SUCCEEDED);
    assert.equal(transaction.resultCode, null);
    assert.ok(transaction.consumedAt);
  });

  it('marks a denied callback failed without creating a connection', async () => {
    const actor = await admin();
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });

    const result = await service.completeAuthorization({
      state: rawStateFrom(start.authorizationUrl),
      error: 'access_denied',
    });

    assert.equal(result.resultCode, 'access_denied');
    assert.equal(await connections().count(), 0);
    const row = await transactions().findOneByOrFail({
      id: start.transactionId,
    });
    assert.equal(row.status, TraktOAuthTransactionStatus.FAILED);
    assert.ok(row.consumedAt);
  });

  it('returns the durable terminal result when a network failure loses its CAS', async () => {
    const actor = await admin();
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    let signalProfileRequested!: () => void;
    const profileRequested = new Promise<void>((resolve) => {
      signalProfileRequested = resolve;
    });
    let rejectProfile!: (error: Error) => void;
    const profileResult = new Promise<never>((_resolve, reject) => {
      rejectProfile = reject;
    });
    mock.method(TraktAPI.prototype, 'exchangeCode', async () => ({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    }));
    mock.method(TraktAPI.prototype, 'getProfile', async () => {
      signalProfileRequested();
      return profileResult;
    });

    const completionPromise = service.completeAuthorization({
      state: rawStateFrom(start.authorizationUrl),
      code: 'oauth-code',
    });
    await profileRequested;
    await transactions().update(start.transactionId, {
      expiresAt: new Date(Date.now() - 1),
    });
    assert.deepEqual(
      await service.getTransactionStatus(start.transactionId, actor.id),
      { status: 'failed', resultCode: 'oauth_interrupted' }
    );
    rejectProfile(new Error('simulated upstream failure'));

    const completion = await completionPromise;
    assert.equal(completion.resultCode, 'oauth_interrupted');
    assert.equal(
      (await transactions().findOneByOrFail({ id: start.transactionId }))
        .resultCode,
      'oauth_interrupted'
    );
  });

  it('exposes processing as pending and interrupts it after two minutes', async () => {
    const actor = await admin();
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    await transactions().update(start.transactionId, {
      status: TraktOAuthTransactionStatus.PROCESSING,
      expiresAt: new Date(Date.now() + 120_000),
    });
    assert.deepEqual(
      await service.getTransactionStatus(start.transactionId, actor.id),
      { status: 'pending', resultCode: null }
    );

    await transactions().update(start.transactionId, {
      expiresAt: new Date(Date.now() - 1),
    });
    assert.deepEqual(
      await service.getTransactionStatus(start.transactionId, actor.id),
      { status: 'failed', resultCode: 'oauth_interrupted' }
    );
  });

  it('shows transaction status only to the actor that started it', async () => {
    const actor = await admin();
    const other = await friend();
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });

    await assert.rejects(
      service.getTransactionStatus(start.transactionId, other.id),
      /transaction.*not found/i
    );
  });

  it('deletes terminal and long-expired unconsumed transactions after 24 hours', async () => {
    const actor = await admin();
    const now = new Date('2026-07-31T12:00:00.000Z');
    const old = new Date(now.getTime() - 24 * 60 * 60 * 1000 - 1);
    const recent = new Date(now.getTime() - 24 * 60 * 60 * 1000 + 1);
    const make = (
      status: TraktOAuthTransactionStatus,
      expiresAt: Date,
      consumedAt: Date | null
    ) =>
      transactions().create({
        id: randomUUID(),
        stateHash: createHash('sha256').update(randomUUID()).digest('hex'),
        actorUserId: actor.id,
        targetUserId: actor.id,
        origin: allowedOrigin,
        status,
        expiresAt,
        consumedAt,
      });
    await transactions().save([
      make(TraktOAuthTransactionStatus.PENDING, old, null),
      make(TraktOAuthTransactionStatus.PROCESSING, old, null),
      make(TraktOAuthTransactionStatus.SUCCEEDED, now, old),
      make(TraktOAuthTransactionStatus.FAILED, now, old),
      make(TraktOAuthTransactionStatus.PENDING, recent, null),
      make(TraktOAuthTransactionStatus.FAILED, now, recent),
    ]);

    assert.equal(
      await new TraktConnectionService().deleteExpiredTransactions(now),
      4
    );
    assert.equal(await transactions().count(), 2);
  });

  it('converges simultaneous callbacks on one canonical connection', async () => {
    const actor = await admin();
    const target = await friend();
    const service = new TraktConnectionService();
    const [adminStart, selfStart] = await Promise.all([
      service.startAuthorization({
        actorUserId: actor.id,
        targetUserId: target.id,
        origin: allowedOrigin,
      }),
      service.startAuthorization({
        actorUserId: target.id,
        targetUserId: target.id,
        origin: allowedOrigin,
      }),
    ]);
    mockSuccessfulTrakt();

    const results = await Promise.all([
      service.completeAuthorization({
        state: rawStateFrom(adminStart.authorizationUrl),
        code: 'admin-code',
      }),
      service.completeAuthorization({
        state: rawStateFrom(selfStart.authorizationUrl),
        code: 'self-code',
      }),
    ]);

    assert.deepEqual(
      results.map((result) => result.status),
      ['succeeded', 'succeeded']
    );
    assert.equal(await connections().count(), 1);
    assert.equal(
      (await connections().findOneByOrFail({ userId: target.id })).tokenVersion,
      2
    );
  });

  it('emits safe structured completion logs without OAuth secrets', async () => {
    const actor = await admin();
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    const rawState = rawStateFrom(start.authorizationUrl);
    const entries: unknown[] = [];
    const listener = (entry: unknown) => entries.push(entry);
    const wasSilent = logger.silent;
    logger.silent = false;
    logger.on('data', listener);
    mockSuccessfulTrakt();

    try {
      await service.completeAuthorization({
        state: rawState,
        code: 'super-secret-oauth-code',
      });
    } finally {
      logger.off('data', listener);
      logger.silent = wasSilent;
    }

    const serialized = JSON.stringify(entries);
    assert.match(serialized, /oauth_complete/);
    assert.match(serialized, /connectionId/);
    assert.match(serialized, /targetUserId/);
    assert.match(serialized, /httpClass/);
    assert.match(serialized, /succeeded/);
    assert.doesNotMatch(serialized, /super-secret-oauth-code/);
    assert.doesNotMatch(serialized, new RegExp(rawState));
    assert.doesNotMatch(
      serialized,
      /new-access-token|new-refresh-token|client-secret/
    );
  });

  it('fails safely when actor or target disappears before callback', async () => {
    const actor = await admin();
    const target = await friend();
    const service = new TraktConnectionService();
    const targetStart = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: target.id,
      origin: allowedOrigin,
    });
    await users().remove(target);
    const result = await service.completeAuthorization({
      state: rawStateFrom(targetStart.authorizationUrl),
      code: 'oauth-code',
    });
    assert.equal(result.resultCode, 'target_missing');
    assert.equal(await connections().count(), 0);

    const actorStart = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    await users().remove(actor);
    assert.deepEqual(
      await service.completeAuthorization({
        state: rawStateFrom(actorStart.authorizationUrl),
        code: 'oauth-code',
      }),
      {
        canNotifyOpener: false,
        status: 'failed',
        resultCode: 'invalid_state',
        httpStatus: 400,
      }
    );
  });

  it('rechecks ADMIN permission before a cross-user callback', async () => {
    const actor = await admin();
    const target = await friend();
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: target.id,
      origin: allowedOrigin,
    });
    actor.permissions = Permission.REQUEST;
    await users().save(actor);
    mockSuccessfulTrakt();

    const result = await service.completeAuthorization({
      state: rawStateFrom(start.authorizationUrl),
      code: 'oauth-code',
    });

    assert.equal(result.resultCode, 'actor_not_authorized');
    assert.equal(await connections().count(), 0);
  });

  it('invalidates only the reconnected connection watch-status keys', async () => {
    const actor = await admin();
    const existing = await connections().save(
      connections().create({
        userId: actor.id,
        traktUserId: '101',
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
      })
    );
    const cache = cacheManager.getCache('trakt-watch-status').data;
    cache.set(`connection:${existing.id}:version:1:movie:1`, true);
    cache.set(`connection:${existing.id}:version:1:tv:2`, true);
    cache.set(`connection:${existing.id + 1}:version:1:movie:1`, true);
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    mockSuccessfulTrakt();

    await service.completeAuthorization({
      state: rawStateFrom(start.authorizationUrl),
      code: 'oauth-code',
    });

    assert.equal(
      cache.has(`connection:${existing.id}:version:1:movie:1`),
      false
    );
    assert.equal(cache.has(`connection:${existing.id}:version:1:tv:2`), false);
    assert.equal(
      cache.has(`connection:${existing.id + 1}:version:1:movie:1`),
      true
    );
  });

  it('retries a real unique-constraint race and completes canonically', async () => {
    const actor = await admin();
    const service = new TraktConnectionService();
    const start = await service.startAuthorization({
      actorUserId: actor.id,
      targetUserId: actor.id,
      origin: allowedOrigin,
    });
    mockSuccessfulTrakt();
    let injected = false;
    let plantedAfterRollback = false;
    let beforeInsertCalls = 0;
    let racingUserId: number | undefined;
    let racingTraktUserId: string | undefined;
    const subscriber: EntitySubscriberInterface<TraktConnection> = {
      listenTo: () => TraktConnection,
      beforeInsert: async (event: InsertEvent<TraktConnection>) => {
        beforeInsertCalls += 1;
        if (injected || !event.entity) {
          return;
        }
        injected = true;
        racingUserId = event.entity.userId;
        racingTraktUserId = event.entity.traktUserId;
        await event.manager.insert(TraktConnection, {
          userId: racingUserId,
          traktUserId: racingTraktUserId,
          status: TraktConnectionStatus.ACTIVE,
          accessToken: 'racing-access-token',
          refreshToken: 'racing-refresh-token',
          expiresAt: new Date('2030-01-01T00:00:00.000Z'),
          tokenVersion: 1,
        });
      },
      afterTransactionRollback: async (event: TransactionRollbackEvent) => {
        if (
          plantedAfterRollback ||
          racingUserId === undefined ||
          racingTraktUserId === undefined
        ) {
          return;
        }
        plantedAfterRollback = true;
        await event.manager.insert(TraktConnection, {
          userId: racingUserId,
          traktUserId: racingTraktUserId,
          status: TraktConnectionStatus.ACTIVE,
          accessToken: 'racing-access-token',
          refreshToken: 'racing-refresh-token',
          expiresAt: new Date('2030-01-01T00:00:00.000Z'),
          tokenVersion: 1,
        });
      },
    };
    dataSource.subscribers.push(subscriber);

    let result;
    try {
      result = await service.completeAuthorization({
        state: rawStateFrom(start.authorizationUrl),
        code: 'oauth-code',
      });
    } finally {
      const subscriberIndex = dataSource.subscribers.indexOf(subscriber);
      if (subscriberIndex !== -1) {
        dataSource.subscribers.splice(subscriberIndex, 1);
      }
    }

    assert.equal(injected, true);
    assert.equal(plantedAfterRollback, true);
    assert.equal(result.status, 'succeeded');
    assert.equal(result.resultCode, null);
    assert.equal(beforeInsertCalls, 3);
    assert.equal(await connections().count(), 1);
    const connection = await connections()
      .createQueryBuilder('connection')
      .addSelect('connection.accessToken')
      .getOneOrFail();
    assert.equal(connection.accessToken, 'new-access-token');
    assert.equal(connection.tokenVersion, 2);
  });

  it('single-flights an expiring token refresh and atomically rotates both tokens', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id, {
      expiresAt: new Date(Date.now() + 30_000),
    });
    const service = new TraktConnectionService();
    let signalRefreshStarted!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      signalRefreshStarted = resolve;
    });
    let releaseRefresh!: () => void;
    const refreshBlocked = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let refreshCalls = 0;
    let suppliedRefreshToken: string | undefined;
    mock.method(TraktAPI.prototype, 'refresh', async (refreshToken: string) => {
      refreshCalls += 1;
      suppliedRefreshToken = refreshToken;
      signalRefreshStarted();
      await refreshBlocked;
      return {
        accessToken: 'replacement-access-token',
        refreshToken: 'replacement-refresh-token',
        expiresAt: new Date(Date.now() + 3_600_000),
      };
    });
    mockProfileByAccessToken();

    const first = service.withAuthenticatedApi(actor.id, (api) =>
      api.getProfile()
    );
    const second = service.withAuthenticatedApi(actor.id, (api) =>
      api.getProfile()
    );
    await refreshStarted;
    releaseRefresh();

    const results = await Promise.all([first, second]);
    const stored = await connectionWithHiddenTokens(connection.id);
    assert.deepEqual(
      results.map((profile) => profile.username),
      ['replacement-access-token', 'replacement-access-token']
    );
    assert.equal(refreshCalls, 1);
    assert.equal(suppliedRefreshToken, 'old-refresh-token');
    assert.equal(stored.accessToken, 'replacement-access-token');
    assert.equal(stored.refreshToken, 'replacement-refresh-token');
    assert.equal(stored.tokenVersion, 4);
    assert.equal(stored.status, TraktConnectionStatus.ACTIVE);
  });

  it('refreshes at the exact sixty-second boundary and invalidates only that connection cache prefix', async () => {
    const actor = await admin();
    const friendUser = await friend();
    const now = Date.parse('2030-01-01T00:00:00.000Z');
    mock.method(Date, 'now', () => now);
    const connection = await connectionWithTokens(actor.id, {
      expiresAt: new Date(now + 60_000),
    });
    const other = await connectionWithTokens(friendUser.id);
    const cache = cacheManager.getCache('trakt-watch-status').data;
    const affectedKey = `connection:${connection.id}:version:3:movie:101`;
    const otherKey = `connection:${other.id}:version:3:movie:101`;
    cache.set(affectedKey, true);
    cache.set(otherKey, true);
    let refreshCalls = 0;
    mock.method(TraktAPI.prototype, 'refresh', async () => {
      refreshCalls += 1;
      return {
        accessToken: 'boundary-access-token',
        refreshToken: 'boundary-refresh-token',
        expiresAt: new Date(now + 3_600_000),
      };
    });
    mockProfileByAccessToken();

    const profile = await new TraktConnectionService().withAuthenticatedApi(
      actor.id,
      (api) => api.getProfile()
    );

    assert.equal(profile.username, 'boundary-access-token');
    assert.equal(refreshCalls, 1);
    assert.equal(cache.has(affectedKey), false);
    assert.equal(cache.has(otherKey), true);
  });

  it('does not let a stale refresh success overwrite a newer reconnect', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id, {
      expiresAt: new Date(Date.now() - 1),
    });
    let signalRefreshStarted!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      signalRefreshStarted = resolve;
    });
    let releaseRefresh!: () => void;
    const refreshBlocked = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    mock.method(TraktAPI.prototype, 'refresh', async () => {
      signalRefreshStarted();
      await refreshBlocked;
      return {
        accessToken: 'stale-access-token',
        refreshToken: 'stale-refresh-token',
        expiresAt: new Date(Date.now() + 3_600_000),
      };
    });
    mockProfileByAccessToken();
    const request = new TraktConnectionService().withAuthenticatedApi(
      actor.id,
      (api) => api.getProfile()
    );
    await refreshStarted;
    await connections().update(
      { id: connection.id, tokenVersion: 3 },
      {
        accessToken: 'reconnected-access-token',
        refreshToken: 'reconnected-refresh-token',
        expiresAt: new Date(Date.now() + 7_200_000),
        tokenVersion: 4,
        status: TraktConnectionStatus.ACTIVE,
      }
    );
    releaseRefresh();

    const profile = await request;
    const stored = await connectionWithHiddenTokens(connection.id);
    assert.equal(profile.username, 'reconnected-access-token');
    assert.equal(stored.accessToken, 'reconnected-access-token');
    assert.equal(stored.refreshToken, 'reconnected-refresh-token');
    assert.equal(stored.tokenVersion, 4);
  });

  it('does not let a stale invalid-refresh failure disconnect a newer reconnect', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id, {
      expiresAt: new Date(Date.now() - 1),
    });
    let signalRefreshStarted!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      signalRefreshStarted = resolve;
    });
    let rejectRefresh!: () => void;
    const refreshResult = new Promise<never>((_resolve, reject) => {
      rejectRefresh = () =>
        reject(
          new TraktApiError('Trakt authentication failed', 401, 'UNAUTHORIZED')
        );
    });
    mock.method(TraktAPI.prototype, 'refresh', async () => {
      signalRefreshStarted();
      return refreshResult;
    });
    mockProfileByAccessToken();
    const request = new TraktConnectionService().withAuthenticatedApi(
      actor.id,
      (api) => api.getProfile()
    );
    await refreshStarted;
    await connections().update(
      { id: connection.id, tokenVersion: 3 },
      {
        accessToken: 'reconnected-access-token',
        refreshToken: 'reconnected-refresh-token',
        expiresAt: new Date(Date.now() + 7_200_000),
        tokenVersion: 4,
        status: TraktConnectionStatus.ACTIVE,
      }
    );
    rejectRefresh();

    const profile = await request;
    const stored = await connectionWithHiddenTokens(connection.id);
    assert.equal(profile.username, 'reconnected-access-token');
    assert.equal(stored.status, TraktConnectionStatus.ACTIVE);
    assert.equal(stored.accessToken, 'reconnected-access-token');
    assert.equal(stored.tokenVersion, 4);
  });

  it('refreshes and replays exactly once after an authenticated 401', async () => {
    const actor = await admin();
    await connectionWithTokens(actor.id);
    let profileCalls = 0;
    mock.method(
      TraktAPI.prototype,
      'getProfile',
      async function (this: TraktAPI) {
        profileCalls += 1;
        if (profileCalls === 1) {
          throw new TraktApiError(
            'Trakt authentication failed',
            401,
            'UNAUTHORIZED'
          );
        }
        const accessToken = (this as unknown as { accessToken?: string })
          .accessToken;
        return {
          traktUserId: '101',
          username: accessToken ?? null,
          slug: null,
          displayName: null,
        };
      }
    );
    let refreshCalls = 0;
    mock.method(TraktAPI.prototype, 'refresh', async () => {
      refreshCalls += 1;
      return {
        accessToken: 'replayed-access-token',
        refreshToken: 'replayed-refresh-token',
        expiresAt: new Date(Date.now() + 3_600_000),
      };
    });

    const profile = await new TraktConnectionService().withAuthenticatedApi(
      actor.id,
      (api) => api.getProfile()
    );
    assert.equal(profile.username, 'replayed-access-token');
    assert.equal(profileCalls, 2);
    assert.equal(refreshCalls, 1);
  });

  it('does not mark validation after a no-op or unrelated callback', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id);
    const service = new TraktConnectionService();

    assert.equal(
      await service.withAuthenticatedApi(actor.id, async () => 'no-op'),
      'no-op'
    );
    assert.equal(
      (await connectionWithHiddenTokens(connection.id)).lastValidatedAt,
      null
    );

    await service.withAuthenticatedApi(actor.id, async (api) =>
      api.buildAuthorizationUrl('unrelated-state')
    );
    assert.equal(
      (await connectionWithHiddenTokens(connection.id)).lastValidatedAt,
      null
    );
  });

  it('marks validation after a real successful authenticated profile response', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id);
    const authHttp = axios.create();
    const apiHttp = axios.create();
    mock.method(apiHttp, 'get', async () => ({
      data: {
        user: {
          username: 'validated-user',
          name: 'Validated User',
          ids: {
            slug: 'validated-user',
            uuid: '9f1c7a52-3d64-4b8e-a0c1-72d5e8b3f419',
          },
        },
      },
    }));
    let createCalls = 0;
    mock.method(axios, 'create', () => {
      createCalls += 1;
      return createCalls % 2 === 1 ? authHttp : apiHttp;
    });
    const before = Date.now();

    const profile = await new TraktConnectionService().withAuthenticatedApi(
      actor.id,
      (api) => api.getProfile()
    );

    assert.equal(profile.username, 'validated-user');
    assert.ok(
      (
        await connectionWithHiddenTokens(connection.id)
      ).lastValidatedAt!.getTime() >= before
    );
  });

  it('does not refresh or replay a second 401 after the one allowed replay', async () => {
    const actor = await admin();
    await connectionWithTokens(actor.id);
    let profileCalls = 0;
    mock.method(TraktAPI.prototype, 'getProfile', async () => {
      profileCalls += 1;
      throw new TraktApiError(
        'Trakt authentication failed',
        401,
        'UNAUTHORIZED'
      );
    });
    let refreshCalls = 0;
    mock.method(TraktAPI.prototype, 'refresh', async () => {
      refreshCalls += 1;
      return {
        accessToken: 'replacement-access-token',
        refreshToken: 'replacement-refresh-token',
        expiresAt: new Date(Date.now() + 3_600_000),
      };
    });

    await assert.rejects(
      new TraktConnectionService().withAuthenticatedApi(actor.id, (api) =>
        api.getProfile()
      ),
      (error: unknown) =>
        error instanceof TraktApiError && error.code === 'UNAUTHORIZED'
    );
    assert.equal(profileCalls, 2);
    assert.equal(refreshCalls, 1);
  });

  it('clears tokens only for a current invalid refresh and invalidates its cache entries', async () => {
    const actor = await admin();
    const friendUser = await friend();
    const connection = await connectionWithTokens(actor.id, {
      expiresAt: new Date(Date.now() - 1),
    });
    const other = await connectionWithTokens(friendUser.id);
    const cache = cacheManager.getCache('trakt-watch-status').data;
    const affectedKey = `connection:${connection.id}:version:3:tv:202`;
    const otherKey = `connection:${other.id}:version:3:tv:202`;
    cache.set(affectedKey, true);
    cache.set(otherKey, true);
    let refreshCalls = 0;
    mock.method(TraktAPI.prototype, 'refresh', async () => {
      refreshCalls += 1;
      throw new TraktApiError(
        'Trakt authentication failed',
        401,
        'UNAUTHORIZED'
      );
    });
    let operationCalls = 0;

    await assert.rejects(
      new TraktConnectionService().withAuthenticatedApi(actor.id, async () => {
        operationCalls += 1;
        return 'unreachable';
      }),
      (error: unknown) =>
        error instanceof TraktApiError && error.code === 'UNAUTHORIZED'
    );

    const stored = await connectionWithHiddenTokens(connection.id);
    assert.equal(refreshCalls, 1);
    assert.equal(operationCalls, 0);
    assert.equal(stored.status, TraktConnectionStatus.RECONNECT_REQUIRED);
    assert.equal(stored.accessToken, null);
    assert.equal(stored.refreshToken, null);
    assert.equal(stored.expiresAt, null);
    assert.equal(stored.tokenVersion, 4);
    assert.equal(cache.has(affectedKey), false);
    assert.equal(cache.has(otherKey), true);
  });

  it('keeps tokens when Trakt rejects the application credentials', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id, {
      expiresAt: new Date(Date.now() - 1),
    });
    mock.method(TraktAPI.prototype, 'refresh', async () => {
      throw new TraktApiError(
        'Trakt request failed',
        400,
        'REQUEST_FAILED',
        undefined,
        'invalid_client'
      );
    });

    await assert.rejects(
      new TraktConnectionService().withAuthenticatedApi(
        actor.id,
        async () => 'unreachable'
      ),
      (error: unknown) => error instanceof TraktApiError && error.status === 400
    );

    const stored = await connectionWithHiddenTokens(connection.id);
    assert.equal(
      stored.accessToken,
      'old-access-token',
      'a bad client secret must not invalidate the user refresh token'
    );
    assert.equal(stored.refreshToken, 'old-refresh-token');
    assert.equal(stored.status, TraktConnectionStatus.ACTIVE);
  });

  it('marks a current connection reconnect-required when Trakt rejects the grant', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id, {
      expiresAt: new Date(Date.now() - 1),
    });
    mock.method(TraktAPI.prototype, 'refresh', async () => {
      throw new TraktApiError(
        'Trakt request failed',
        400,
        'REQUEST_FAILED',
        undefined,
        'invalid_grant'
      );
    });
    let operationCalls = 0;

    await assert.rejects(
      new TraktConnectionService().withAuthenticatedApi(actor.id, async () => {
        operationCalls += 1;
        return 'unreachable';
      }),
      (error: unknown) =>
        error instanceof TraktApiError &&
        error.status === 400 &&
        error.code === 'REQUEST_FAILED'
    );

    const stored = await connectionWithHiddenTokens(connection.id);
    assert.equal(operationCalls, 0);
    assert.equal(stored.status, TraktConnectionStatus.RECONNECT_REQUIRED);
    assert.equal(stored.accessToken, null);
    assert.equal(stored.refreshToken, null);
    assert.equal(stored.expiresAt, null);
    assert.equal(stored.tokenVersion, 4);
  });

  it('records a per-connection Retry-After cooldown and removes it after expiry', async () => {
    const actor = await admin();
    let now = Date.parse('2030-01-01T00:00:00.000Z');
    mock.method(Date, 'now', () => now);
    const connection = await connectionWithTokens(actor.id);
    let operationCalls = 0;
    const service = new TraktConnectionService();
    const operation = async () => {
      operationCalls += 1;
      if (operationCalls === 1) {
        throw new TraktApiError(
          'Trakt rate limit exceeded',
          429,
          'RATE_LIMITED',
          5
        );
      }
      return 'available';
    };

    await assert.rejects(
      service.withAuthenticatedApi(actor.id, operation),
      (error: unknown) =>
        error instanceof TraktApiError &&
        error.code === 'RATE_LIMITED' &&
        error.retryAfterSeconds === 5
    );
    await assert.rejects(
      service.withAuthenticatedApi(actor.id, operation),
      (error: unknown) =>
        error instanceof TraktApiError &&
        error.code === 'RATE_LIMITED' &&
        error.retryAfterSeconds === 5
    );
    assert.equal(operationCalls, 1);
    assert.equal(
      (await connectionWithHiddenTokens(connection.id)).status,
      TraktConnectionStatus.ACTIVE
    );

    now += 5_001;
    assert.equal(
      await service.withAuthenticatedApi(actor.id, operation),
      'available'
    );
    assert.equal(operationCalls, 2);
  });

  it('shares Retry-After cooldowns across service instances and clears them on unlink', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id);
    const firstService = new TraktConnectionService();
    const secondService = new TraktConnectionService();
    await assert.rejects(
      firstService.withAuthenticatedApi(actor.id, async () => {
        throw new TraktApiError(
          'Trakt rate limit exceeded',
          429,
          'RATE_LIMITED',
          30
        );
      }),
      (error: unknown) =>
        error instanceof TraktApiError && error.code === 'RATE_LIMITED'
    );
    let secondInstanceNetworkCalls = 0;

    await assert.rejects(
      secondService.withAuthenticatedApi(actor.id, async () => {
        secondInstanceNetworkCalls += 1;
        return 'must-fail-fast';
      }),
      (error: unknown) =>
        error instanceof TraktApiError &&
        error.code === 'RATE_LIMITED' &&
        error.retryAfterSeconds === 30
    );
    assert.equal(secondInstanceNetworkCalls, 0);

    mock.method(TraktAPI.prototype, 'revoke', async () => undefined);
    await secondService.unlink(actor.id);
    await connections().save(
      connections().create({
        id: connection.id,
        userId: actor.id,
        traktUserId: `replacement-${actor.id}`,
        status: TraktConnectionStatus.ACTIVE,
        accessToken: 'replacement-access-token',
        refreshToken: 'replacement-refresh-token',
        expiresAt: new Date(Date.now() + 3_600_000),
        tokenVersion: 1,
      })
    );
    assert.equal(
      await new TraktConnectionService().withAuthenticatedApi(
        actor.id,
        async () => 'cooldown-cleared'
      ),
      'cooldown-cleared'
    );
  });

  it('preserves connection tokens when refresh gets network and upstream failures', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id, {
      expiresAt: new Date(Date.now() - 1),
    });
    const service = new TraktConnectionService();
    let failure!: TraktApiError;
    let refreshCalls = 0;
    mock.method(TraktAPI.prototype, 'refresh', async () => {
      refreshCalls += 1;
      throw failure;
    });

    for (const error of [
      new TraktApiError('Trakt network request failed', 0, 'NETWORK_ERROR'),
      new TraktApiError(
        'Trakt service temporarily unavailable',
        503,
        'UPSTREAM_ERROR'
      ),
    ]) {
      failure = error;
      await assert.rejects(
        service.withAuthenticatedApi(actor.id, async () => 'unreachable'),
        error
      );
      const stored = await connectionWithHiddenTokens(connection.id);
      assert.equal(stored.status, TraktConnectionStatus.ACTIVE);
      assert.equal(stored.accessToken, 'old-access-token');
      assert.equal(stored.refreshToken, 'old-refresh-token');
      assert.equal(stored.tokenVersion, 3);
    }
    assert.equal(refreshCalls, 2);
  });

  it('revokes before unlinking and reports remote success', async () => {
    const actor = await admin();
    const connection = await connectionWithTokens(actor.id);
    let revokedToken: string | undefined;
    mock.method(TraktAPI.prototype, 'revoke', async (token: string) => {
      revokedToken = token;
    });

    const result = await new TraktConnectionService().unlink(actor.id);

    assert.deepEqual(result, { remoteRevocationSucceeded: true });
    assert.equal(revokedToken, 'old-access-token');
    assert.equal(await connections().countBy({ id: connection.id }), 0);
  });

  it('deletes locally and invalidates only its cache when remote revocation fails', async () => {
    const actor = await admin();
    const friendUser = await friend();
    const connection = await connectionWithTokens(actor.id);
    const other = await connectionWithTokens(friendUser.id);
    const cache = cacheManager.getCache('trakt-watch-status').data;
    const affectedKey = `connection:${connection.id}:version:3:movie:303`;
    const otherKey = `connection:${other.id}:version:3:movie:303`;
    cache.set(affectedKey, true);
    cache.set(otherKey, true);
    mock.method(TraktAPI.prototype, 'revoke', async () => {
      throw new TraktApiError(
        'Trakt service temporarily unavailable',
        503,
        'UPSTREAM_ERROR'
      );
    });

    const result = await new TraktConnectionService().unlink(actor.id);

    assert.deepEqual(result, { remoteRevocationSucceeded: false });
    assert.equal(await connections().countBy({ id: connection.id }), 0);
    assert.equal(cache.has(affectedKey), false);
    assert.equal(cache.has(otherKey), true);
  });

  it('emits safe structured refresh, reconnect-required, and unlink logs', async () => {
    const actor = await admin();
    const entries: unknown[] = [];
    const listener = (entry: unknown) => entries.push(entry);
    const wasSilent = logger.silent;
    logger.silent = false;
    logger.on('data', listener);

    try {
      await connectionWithTokens(actor.id, {
        expiresAt: new Date(Date.now() - 1),
        accessToken: 'secret-access-one',
        refreshToken: 'secret-refresh-one',
      });
      mock.method(TraktAPI.prototype, 'refresh', async () => ({
        accessToken: 'secret-access-two',
        refreshToken: 'secret-refresh-two',
        expiresAt: new Date(Date.now() + 3_600_000),
      }));
      await new TraktConnectionService().withAuthenticatedApi(
        actor.id,
        async () => 'validated'
      );
      mock.restoreAll();

      const refreshed = await connectionWithHiddenTokens(
        (await connections().findOneByOrFail({ userId: actor.id })).id
      );
      await connections().update(refreshed.id, {
        expiresAt: new Date(Date.now() - 1),
      });
      mock.method(TraktAPI.prototype, 'refresh', async () => {
        throw new TraktApiError(
          'Trakt authentication failed',
          401,
          'UNAUTHORIZED'
        );
      });
      await assert.rejects(
        new TraktConnectionService().withAuthenticatedApi(
          actor.id,
          async () => 'unreachable'
        )
      );
      mock.restoreAll();

      await connections().update(refreshed.id, {
        status: TraktConnectionStatus.ACTIVE,
        accessToken: 'secret-access-three',
        refreshToken: 'secret-refresh-three',
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      mock.method(TraktAPI.prototype, 'revoke', async () => {
        throw new Error('revoke failed with secret-access-three');
      });
      await new TraktConnectionService().unlink(actor.id);
    } finally {
      logger.off('data', listener);
      logger.silent = wasSilent;
    }

    const serialized = JSON.stringify(entries);
    assert.match(serialized, /token_refresh/);
    assert.match(serialized, /reconnect_required/);
    assert.match(serialized, /unlink/);
    assert.doesNotMatch(serialized, /secret-access|secret-refresh/);
    assert.doesNotMatch(serialized, /request|response/);
  });
});
