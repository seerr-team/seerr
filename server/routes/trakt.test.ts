import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import TraktAPI from '@server/api/trakt';
import { getRepository } from '@server/datasource';
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
import { TraktConnectionService } from '@server/lib/trakt/connectionService';
import { TraktWatchStatusService } from '@server/lib/trakt/watchStatusService';
import logger from '@server/logger';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import session from 'express-session';
import path from 'path';
import request from 'supertest';
import routes from './index';

const allowedOrigin = 'https://requests.example.com';
let app: Express;
let validatedApp: Express;

function createApp(): Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(
    session({ secret: 'test-secret', resave: false, saveUninitialized: false })
  );
  testApp.use(routes);
  testApp.use(
    (
      err: {
        status?: number;
        message?: string;
        code?: string;
        ownerUserId?: number;
      },
      _req: express.Request,
      res: express.Response,
      // Express recognizes error handlers by their four-argument signature.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) =>
      res.status(err.status ?? 500).json({
        message: err.message,
        ...(err.code && { code: err.code }),
        ...(err.ownerUserId !== undefined && { ownerUserId: err.ownerUserId }),
      })
  );
  return testApp;
}

function createValidatedApp(): Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(
    session({ secret: 'test-secret', resave: false, saveUninitialized: false })
  );
  testApp.use(
    OpenApiValidator.middleware({
      apiSpec: path.join(process.cwd(), 'seerr-api.yml'),
      validateRequests: true,
    })
  );
  testApp.use('/api/v1', routes);
  testApp.use(
    (
      err: { status?: number; message?: string; errors?: string[] },
      _req: express.Request,
      res: express.Response,
      // Match the production four-argument error serializer.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) =>
      res.status(err.status ?? 500).json({
        message: err.message,
        errors: err.errors,
      })
  );
  return testApp;
}

setupTestDb();

before(() => {
  app = createApp();
  validatedApp = createValidatedApp();
});

beforeEach(() => {
  getSettings().main.localLogin = true;
  getSettings().main.applicationUrl = allowedOrigin;
  getSettings().trakt = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
  };
  cacheManager.getCache('trakt-watch-status').flush();
});

afterEach(() => {
  mock.restoreAll();
});

async function authenticatedAgent(email: string) {
  const agent = request.agent(app);
  const response = await agent
    .post('/auth/local')
    .send({ email, password: 'test1234' });
  assert.equal(response.status, 200);
  return agent;
}

describe('Trakt account routes', () => {
  it('requires authentication for household watch status', async () => {
    const response = await request(app).get('/trakt/watchstatus/movie/123');

    assert.equal(response.status, 401);
  });

  it('returns validated household watch status for an authenticated viewer', async () => {
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    const friend = await authenticatedAgent('friend@seerr.dev');
    const getWatchStatus = mock.method(
      TraktWatchStatusService.prototype,
      'getWatchStatus',
      async () => ({
        mediaType: 'movie' as const,
        tmdbId: 123,
        items: [
          {
            userId: friendUser.id,
            displayName: 'friend',
            traktUsername: 'trakt-friend',
            watched: true,
            watchedAt: '2026-07-31T12:00:00.000Z',
            status: 'ok' as const,
          },
        ],
      })
    );

    const response = await friend.get('/trakt/watchstatus/movie/123');

    assert.equal(response.status, 200);
    assert.equal(getWatchStatus.mock.callCount(), 1);
    const call = getWatchStatus.mock.calls[0];
    assert.ok(call);
    const input = call.arguments[0];
    assert.ok(input);
    assert.equal(input.viewer.id, friendUser.id);
    assert.equal(input.mediaType, 'movie');
    assert.equal(input.tmdbId, 123);
    assert.deepEqual(response.body.items[0], {
      userId: friendUser.id,
      displayName: 'friend',
      traktUsername: 'trakt-friend',
      watched: true,
      watchedAt: '2026-07-31T12:00:00.000Z',
      status: 'ok',
    });
    assert.equal(JSON.stringify(response.body).includes('@seerr.dev'), false);
    assert.equal(JSON.stringify(response.body).includes('token'), false);
  });

  it('rejects invalid watch-status media types and TMDB IDs before calling the service', async () => {
    const friend = await authenticatedAgent('friend@seerr.dev');
    const getWatchStatus = mock.method(
      TraktWatchStatusService.prototype,
      'getWatchStatus',
      async () => ({ mediaType: 'movie' as const, tmdbId: 1, items: [] })
    );

    for (const pathValue of [
      'Movie/1',
      'show/1',
      'movie/0',
      'movie/-1',
      'movie/1.5',
      'tv/not-a-number',
    ]) {
      const response = await friend.get(`/trakt/watchstatus/${pathValue}`);
      assert.equal(response.status, 400, pathValue);
    }
    assert.equal(getWatchStatus.mock.callCount(), 0);
  });

  it('keeps watch status compatible with the production OpenAPI validator', async () => {
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    getSettings().main.apiKey = 'validator-test-api-key';
    mock.method(
      TraktWatchStatusService.prototype,
      'getWatchStatus',
      async () => ({ mediaType: 'tv' as const, tmdbId: 456, items: [] })
    );

    const response = await request(validatedApp)
      .get('/api/v1/trakt/watchstatus/tv/456')
      .set('X-API-Key', 'validator-test-api-key')
      .set('X-API-User', String(friendUser.id));

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      mediaType: 'tv',
      tmdbId: 456,
      items: [],
    });
  });

  it('loads the production OpenAPI validator and reaches a Trakt route', async () => {
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    getSettings().main.apiKey = 'validator-test-api-key';
    const response = await request(validatedApp)
      .get(`/api/v1/user/${friendUser.id}/settings/trakt`)
      .set('X-API-Key', 'validator-test-api-key')
      .set('X-API-User', String(friendUser.id));

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      applicationConfigured: true,
      connection: null,
    });
  });

  it('preserves stable 409 codes through the production error stack', async () => {
    const adminUser = await getRepository(User).findOneByOrFail({
      email: 'admin@seerr.dev',
    });
    getSettings().main.apiKey = 'validator-test-api-key';
    const requestAsAdmin = () =>
      request(validatedApp)
        .put('/api/v1/settings/trakt')
        .set('X-API-Key', 'validator-test-api-key')
        .set('X-API-User', String(adminUser.id));

    const precheck = await requestAsAdmin().send({
      clientId: 'replacement-client',
    });
    assert.equal(precheck.status, 409);
    assert.deepEqual(precheck.body, {
      message: 'Confirm reconnect all is required.',
      code: 'confirm_reconnect_all_required',
    });

    const update = mock.method(
      TraktConnectionService.prototype,
      'updateApplicationSettings',
      async () => {
        throw new Error('Confirm reconnect all is required');
      }
    );
    const serviceRace = await requestAsAdmin().send({ clientId: 'client-id' });
    assert.equal(update.mock.callCount(), 1);
    assert.equal(serviceRace.status, 409);
    assert.deepEqual(serviceRace.body, {
      message: 'Confirm reconnect all is required.',
      code: 'confirm_reconnect_all_required',
    });
  });

  it('keeps callback static-error handling intact behind the validator', async () => {
    const response = await request(validatedApp)
      .get('/api/v1/auth/trakt/callback')
      .query({ state: 'unknown-state', code: 'oauth-code' });

    assert.equal(response.status, 400);
    assert.match(response.headers['content-type'], /^text\/html/);
    assert.equal(
      response.headers['content-security-policy'],
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    );
    assert.equal(response.text.includes('script'), false);
    assert.equal(response.text.includes('unknown-state'), false);
  });

  it('requires authentication and ADMIN for application settings', async () => {
    assert.equal((await request(app).get('/settings/trakt')).status, 401);
    assert.equal(
      (await request(app).get('/user/1/settings/trakt')).status,
      401
    );
    assert.equal(
      (
        await request(app).get(
          '/trakt/oauth/00000000-0000-4000-8000-000000000000/status'
        )
      ).status,
      401
    );
    const friend = await authenticatedAgent('friend@seerr.dev');
    assert.equal((await friend.get('/settings/trakt')).status, 403);
    const admin = await authenticatedAgent('admin@seerr.dev');
    assert.equal((await admin.get('/settings/trakt')).status, 200);
  });

  it('returns redacted settings and disconnected user DTOs', async () => {
    const admin = await authenticatedAgent('admin@seerr.dev');
    const friend = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });

    const settings = await admin.get('/settings/trakt');
    assert.deepEqual(settings.body, {
      clientId: 'client-id',
      clientSecretConfigured: true,
      callbackUrl: 'https://requests.example.com/api/v1/auth/trakt/callback',
    });
    assert.equal(
      JSON.stringify(settings.body).includes('client-secret'),
      false
    );

    const user = await authenticatedAgent('friend@seerr.dev');
    const response = await user.get(`/user/${friend.id}/settings/trakt`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      applicationConfigured: true,
      connection: null,
    });
    assert.equal(JSON.stringify(response.body).includes('client-id'), false);
  });

  it('applies update confirmation and secret omission semantics without returning credentials', async () => {
    const admin = await authenticatedAgent('admin@seerr.dev');
    mock.method(getSettings(), 'save', async () => undefined);

    const secretOnly = await admin.put('/settings/trakt').send({
      clientId: ' client-id ',
      clientSecret: 'replacement-secret',
    });
    assert.equal(secretOnly.status, 200);
    assert.equal(getSettings().trakt.clientSecret, 'replacement-secret');
    assert.equal(
      JSON.stringify(secretOnly.body).includes('replacement-secret'),
      false
    );

    const omitted = await admin.put('/settings/trakt').send({
      clientId: 'client-id',
    });
    assert.equal(omitted.status, 200);
    assert.equal(getSettings().trakt.clientSecret, 'replacement-secret');

    assert.equal(
      (
        await admin.put('/settings/trakt').send({
          clientId: 'client-id',
          clientSecret: '',
        })
      ).status,
      400
    );
    const unconfirmed = await admin.put('/settings/trakt').send({
      clientId: 'replacement-client',
    });
    assert.equal(unconfirmed.status, 409);
    assert.equal(unconfirmed.body.code, 'confirm_reconnect_all_required');
  });

  it('allows initial setup without confirmation and redacts settings persistence failures', async () => {
    const admin = await authenticatedAgent('admin@seerr.dev');
    getSettings().trakt.clientId = '';
    getSettings().trakt.clientSecret = '';
    const save = mock.method(getSettings(), 'save', async () => undefined);

    const initial = await admin.put('/settings/trakt').send({
      clientId: ' initial-client ',
      clientSecret: 'initial-secret',
    });
    assert.equal(initial.status, 200);
    assert.equal(initial.body.clientId, 'initial-client');
    assert.equal(
      JSON.stringify(initial.body).includes('initial-secret'),
      false
    );

    save.mock.mockImplementation(async () => {
      throw new Error('sensitive filesystem path');
    });
    const failed = await admin.put('/settings/trakt').send({
      clientId: 'initial-client',
      clientSecret: 'replacement-secret',
    });
    assert.equal(failed.status, 500);
    assert.equal(
      JSON.stringify(failed.body).includes('sensitive filesystem path'),
      false
    );
  });

  it('lets ADMIN list explicit redacted connection DTOs', async () => {
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    await getRepository(TraktConnection).save(
      getRepository(TraktConnection).create({
        userId: friendUser.id,
        traktUserId: '12345',
        username: 'mutable-name',
        slug: 'mutable-slug',
        displayName: 'Display name',
        status: TraktConnectionStatus.ACTIVE,
        accessToken: 'secret-access-token',
        refreshToken: 'secret-refresh-token',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        connectedByUserId: friendUser.id,
      })
    );
    const admin = await authenticatedAgent('admin@seerr.dev');
    const response = await admin.get('/settings/trakt/connections');

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].traktUsername, 'mutable-name');
    assert.equal(response.body[0].traktSlug, 'mutable-slug');
    const serialized = JSON.stringify(response.body);
    for (const sensitive of [
      'secret-access-token',
      'secret-refresh-token',
      'accessToken',
      'refreshToken',
      'expiresAt',
      'stateHash',
    ]) {
      assert.equal(serialized.includes(sensitive), false);
    }
  });

  it('allows only self or ADMIN, never MANAGE_USERS', async () => {
    const adminUser = await getRepository(User).findOneByOrFail({
      email: 'admin@seerr.dev',
    });
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    friendUser.permissions = Permission.MANAGE_USERS;
    await getRepository(User).save(friendUser);
    const friend = await authenticatedAgent('friend@seerr.dev');
    assert.equal(
      (await friend.get(`/user/${adminUser.id}/settings/trakt`)).status,
      403
    );
    const admin = await authenticatedAgent('admin@seerr.dev');
    assert.equal(
      (await admin.get(`/user/${friendUser.id}/settings/trakt`)).status,
      200
    );

    const started = await admin
      .post(`/user/${friendUser.id}/settings/trakt/auth`)
      .set('Origin', allowedOrigin);
    assert.equal(started.status, 200);
    await getRepository(TraktConnection).save(
      getRepository(TraktConnection).create({
        userId: friendUser.id,
        traktUserId: 'admin-managed-account',
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
      })
    );
    assert.equal(
      (await admin.delete(`/user/${friendUser.id}/settings/trakt`)).status,
      200
    );
  });

  it('requires an exact allowlisted Origin without creating a transaction', async () => {
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    const friend = await authenticatedAgent('friend@seerr.dev');
    const transactionCount = await getRepository(TraktOAuthTransaction).count();
    assert.equal(
      (await friend.post(`/user/${friendUser.id}/settings/trakt/auth`)).status,
      400
    );
    assert.equal(
      await getRepository(TraktOAuthTransaction).count(),
      transactionCount
    );
    assert.equal(
      (
        await friend
          .post(`/user/${friendUser.id}/settings/trakt/auth`)
          .set('Origin', 'https://attacker.invalid')
      ).status,
      400
    );
    assert.equal(
      await getRepository(TraktOAuthTransaction).count(),
      transactionCount
    );
    const response = await friend
      .post(`/user/${friendUser.id}/settings/trakt/auth`)
      .set('Origin', allowedOrigin);
    assert.equal(response.status, 200);
    assert.equal(response.body.callbackOrigin, allowedOrigin);
  });

  it('serves public callbacks with nonce CSP for trusted state and script-free generic errors', async () => {
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    const friend = await authenticatedAgent('friend@seerr.dev');
    const started = await friend
      .post(`/user/${friendUser.id}/settings/trakt/auth`)
      .set('Origin', allowedOrigin);
    const state = new URL(started.body.authorizationUrl).searchParams.get(
      'state'
    );
    assert.ok(state);
    mock.method(TraktAPI.prototype, 'exchangeCode', async () => ({
      accessToken: 'secret-access-token',
      refreshToken: 'secret-refresh-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    }));
    mock.method(TraktAPI.prototype, 'getProfile', async () => ({
      traktUserId: '101',
      username: 'trakt-user',
      slug: 'trakt-user',
      displayName: 'Trakt User',
    }));

    const success = await request(app)
      .get('/auth/trakt/callback')
      .query({ state, code: 'oauth-code' });
    assert.equal(success.status, 200);
    assert.match(success.headers['content-security-policy'], /nonce-/);
    assert.match(success.text, /postMessage/);
    assert.match(success.text, new RegExp(allowedOrigin));
    assert.equal(success.text.includes('secret-access-token'), false);

    const invalid = await request(app)
      .get('/auth/trakt/callback')
      .query({ state: 'unknown', code: 'oauth-code' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.text.includes('script'), false);
    assert.equal(invalid.text.includes('postMessage'), false);
    assert.equal(invalid.text.includes('unknown'), false);
  });

  it('rejects missing callback results and malformed persisted origins with safe static headers', async () => {
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    const friend = await authenticatedAgent('friend@seerr.dev');
    const missingResultStart = await friend
      .post(`/user/${friendUser.id}/settings/trakt/auth`)
      .set('Origin', allowedOrigin);
    const missingResultState = new URL(
      missingResultStart.body.authorizationUrl
    ).searchParams.get('state');
    const missingResult = await request(app)
      .get('/auth/trakt/callback')
      .query({ state: missingResultState });
    assert.equal(missingResult.status, 400);
    assert.match(missingResult.headers['content-type'], /^text\/html/);
    assert.equal(missingResult.headers['cache-control'], 'no-store');
    assert.equal(missingResult.headers['referrer-policy'], 'no-referrer');
    assert.equal(missingResult.headers['x-frame-options'], 'DENY');
    assert.equal(
      missingResult.headers['cross-origin-opener-policy'],
      'unsafe-none'
    );
    assert.equal(missingResult.text.includes('script'), false);
    assert.equal(
      (
        await getRepository(TraktOAuthTransaction).findOneByOrFail({
          id: missingResultStart.body.transactionId,
        })
      ).status,
      TraktOAuthTransactionStatus.PENDING
    );

    const malformedStart = await friend
      .post(`/user/${friendUser.id}/settings/trakt/auth`)
      .set('Origin', allowedOrigin);
    await getRepository(TraktOAuthTransaction).update(
      malformedStart.body.transactionId,
      { origin: 'javascript:alert(1)' }
    );
    const malformedState = new URL(
      malformedStart.body.authorizationUrl
    ).searchParams.get('state');
    const malformed = await request(app)
      .get('/auth/trakt/callback')
      .query({ state: malformedState, code: 'oauth-code' });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.text.includes('script'), false);
    assert.equal(malformed.text.includes('postMessage'), false);
    assert.equal(malformed.text.includes('javascript'), false);
    assert.equal(
      malformed.headers['content-security-policy'],
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    );
  });

  it('returns distinct durable 409 conflict codes without owner disclosure to ordinary users', async () => {
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    const adminUser = await getRepository(User).findOneByOrFail({
      email: 'admin@seerr.dev',
    });
    const friend = await authenticatedAgent('friend@seerr.dev');
    mock.method(TraktAPI.prototype, 'exchangeCode', async () => ({
      accessToken: 'conflict-access-token',
      refreshToken: 'conflict-refresh-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    }));
    const profile = mock.method(TraktAPI.prototype, 'getProfile', async () => ({
      traktUserId: 'new-stable-id',
      username: 'conflict-user',
      slug: 'conflict-user',
      displayName: 'Conflict user',
    }));

    await getRepository(TraktConnection).save(
      getRepository(TraktConnection).create({
        userId: friendUser.id,
        traktUserId: 'existing-stable-id',
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
      })
    );
    const targetStart = await friend
      .post(`/user/${friendUser.id}/settings/trakt/auth`)
      .set('Origin', allowedOrigin);
    const targetState = new URL(
      targetStart.body.authorizationUrl
    ).searchParams.get('state');
    assert.equal(
      (
        await request(app)
          .get('/auth/trakt/callback')
          .query({ state: targetState, code: 'oauth-code' })
      ).status,
      409
    );
    const targetPoll = await friend.get(
      `/trakt/oauth/${targetStart.body.transactionId}/status`
    );
    assert.equal(targetPoll.status, 409);
    assert.deepEqual(targetPoll.body, {
      message: 'Trakt account conflict.',
      code: 'target_has_different_trakt_account',
    });
    assert.equal('ownerUserId' in targetPoll.body, false);
    assert.equal('ownerName' in targetPoll.body, false);

    await getRepository(TraktConnection).clear();
    await getRepository(TraktConnection).save(
      getRepository(TraktConnection).create({
        userId: adminUser.id,
        traktUserId: 'owned-stable-id',
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
      })
    );
    profile.mock.mockImplementation(async () => ({
      traktUserId: 'owned-stable-id',
      username: 'owned-user',
      slug: 'owned-user',
      displayName: 'Owned user',
    }));
    const identityStart = await friend
      .post(`/user/${friendUser.id}/settings/trakt/auth`)
      .set('Origin', allowedOrigin);
    const identityState = new URL(
      identityStart.body.authorizationUrl
    ).searchParams.get('state');
    assert.equal(
      (
        await request(app)
          .get('/auth/trakt/callback')
          .query({ state: identityState, code: 'oauth-code' })
      ).status,
      409
    );
    const identityPoll = await friend.get(
      `/trakt/oauth/${identityStart.body.transactionId}/status`
    );
    assert.equal(identityPoll.status, 409);
    assert.deepEqual(identityPoll.body, {
      message: 'Trakt account conflict.',
      code: 'trakt_account_owned_by_another_user',
    });
    assert.equal('ownerUserId' in identityPoll.body, false);
    assert.equal('ownerName' in identityPoll.body, false);
  });

  it('restricts transaction polling to its actor and redacts connection entities', async () => {
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    const friend = await authenticatedAgent('friend@seerr.dev');
    const started = await friend
      .post(`/user/${friendUser.id}/settings/trakt/auth`)
      .set('Origin', allowedOrigin);
    assert.equal(
      (await friend.get(`/trakt/oauth/${started.body.transactionId}/status`))
        .status,
      200
    );
    const admin = await authenticatedAgent('admin@seerr.dev');
    assert.equal(
      (await admin.get(`/trakt/oauth/${started.body.transactionId}/status`))
        .status,
      404
    );
  });

  it('returns unlink outcome and removes the connection', async () => {
    const friendUser = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    const friend = await authenticatedAgent('friend@seerr.dev');
    mock.method(TraktAPI.prototype, 'exchangeCode', async () => ({
      accessToken: 'secret-access-token',
      refreshToken: 'secret-refresh-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    }));
    mock.method(TraktAPI.prototype, 'getProfile', async () => ({
      traktUserId: '101',
      username: 'user',
      slug: 'user',
      displayName: 'User',
    }));
    mock.method(TraktAPI.prototype, 'revoke', async () => undefined);
    const started = await friend
      .post(`/user/${friendUser.id}/settings/trakt/auth`)
      .set('Origin', allowedOrigin);
    const state = new URL(started.body.authorizationUrl).searchParams.get(
      'state'
    );
    await request(app)
      .get('/auth/trakt/callback')
      .query({ state, code: 'code' });

    const response = await friend.delete(
      `/user/${friendUser.id}/settings/trakt`
    );
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { remoteRevocationSucceeded: true });
    assert.equal(
      await getRepository(TraktConnection).countBy({ userId: friendUser.id }),
      0
    );
  });

  it('audits an administrator unlink with safe actor, target, and revoke attribution', async () => {
    const actor = await getRepository(User).findOneByOrFail({
      email: 'admin@seerr.dev',
    });
    const target = await getRepository(User).findOneByOrFail({
      email: 'friend@seerr.dev',
    });
    const connectionRepo = getRepository(TraktConnection);
    await connectionRepo.save(
      connectionRepo.create({
        userId: target.id,
        traktUserId: 'safe-admin-unlink-target',
        status: TraktConnectionStatus.ACTIVE,
        accessToken: 'secret-admin-unlink-access',
        refreshToken: 'secret-admin-unlink-refresh',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        tokenVersion: 1,
        connectedByUserId: target.id,
      })
    );
    mock.method(TraktAPI.prototype, 'revoke', async () => {
      throw new Error('remote rejected secret-admin-unlink-access');
    });
    const entries: unknown[] = [];
    const listener = (entry: unknown) => entries.push(entry);
    const wasSilent = logger.silent;
    logger.silent = false;
    logger.on('data', listener);

    let response: request.Response;
    try {
      const admin = await authenticatedAgent('admin@seerr.dev');
      response = await admin.delete(`/user/${target.id}/settings/trakt`);
    } finally {
      logger.off('data', listener);
      logger.silent = wasSilent;
    }

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { remoteRevocationSucceeded: false });
    const auditEntry = entries.find(
      (entry) => (entry as { operation?: unknown }).operation === 'unlink'
    ) as Record<string, unknown> | undefined;
    assert.ok(auditEntry);
    assert.equal(auditEntry.actorUserId, actor.id);
    assert.equal(auditEntry.targetUserId, target.id);
    assert.equal(auditEntry.remoteRevocationSucceeded, false);
    assert.doesNotMatch(
      JSON.stringify(auditEntry),
      /secret-admin-unlink-(?:access|refresh)|"(?:accessToken|refreshToken)"\s*:/
    );
    assert.equal(await connectionRepo.countBy({ userId: target.id }), 0);
  });
});
