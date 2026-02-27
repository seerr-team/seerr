import assert from 'node:assert/strict';
import {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
  mock,
} from 'node:test';

import { getRepository } from '@server/datasource';
import { LinkedAccount } from '@server/entity/LinkedAccount';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import fetchMock from 'fetch-mock';
import request from 'supertest';
import authRoutes from './auth';

// Mock email sending to prevent SMTP connection attempts
mock.module('../lib/email/index.ts', {
  defaultExport: () => ({
    send: mock.fn(async () => undefined),
  }),
});

let app: Express;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(checkUser);
  app.use('/auth', authRoutes);
  // Error handler matching how next({ status, message }) calls are handled
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // We must provide a next function for the function signature here even though its not used
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res
        .status(err.status ?? 500)
        .json({ status: err.status ?? 500, message: err.message });
    }
  );
  return app;
}

before(async () => {
  app = createApp();
});

afterEach(() => {
  getSettings().reset();
});

setupTestDb();

/** Create a supertest agent that is logged in as the given user. */
async function authenticatedAgent(email: string, password: string) {
  const agent = request.agent(app);
  const settings = getSettings();
  settings.main.localLogin = true;

  const res = await agent.post('/auth/local').send({ email, password });

  assert.strictEqual(res.status, 200);
  return agent;
}

describe('GET /auth/me', () => {
  it('returns 403 when not authenticated', async () => {
    const res = await request(app).get('/auth/me');
    assert.strictEqual(res.status, 403);
  });

  it('returns the authenticated user', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const res = await agent.get('/auth/me');

    assert.strictEqual(res.status, 200);
    assert.ok('id' in res.body);
    assert.strictEqual(res.body.displayName, 'admin');
  });

  it('includes userEmailRequired warning when email is required but invalid', async () => {
    const settings = getSettings();
    settings.notifications.agents.email.options.userEmailRequired = true;

    // Change the user's email to something invalid
    const userRepo = getRepository(User);
    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    user.email = 'not-an-email';
    await userRepo.save(user);

    // Log in with the changed email
    const agent = request.agent(app);
    settings.main.localLogin = true;
    const loginRes = await agent
      .post('/auth/local')
      .send({ email: 'not-an-email', password: 'test1234' });
    assert.strictEqual(loginRes.status, 200);

    const res = await agent.get('/auth/me');

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.warnings.includes('userEmailRequired'));

    settings.notifications.agents.email.options.userEmailRequired = false;
  });
});

describe('POST /auth/local', () => {
  beforeEach(() => {
    const settings = getSettings();
    settings.main.localLogin = true;
  });

  it('returns 200 and user data on valid credentials', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'test1234' });

    assert.strictEqual(res.status, 200);
    assert.ok('id' in res.body);
    // filter() strips sensitive fields like password
    assert.ok(!('password' in res.body));
  });

  it('returns 403 on wrong password', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'wrongpassword' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.message, 'Access denied.');
  });

  it('returns 403 for nonexistent user', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'nobody@seerr.dev', password: 'test1234' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.message, 'Access denied.');
  });

  it('returns 500 when local login is disabled', async () => {
    const settings = getSettings();
    settings.main.localLogin = false;

    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'test1234' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.error, 'Password sign-in is disabled.');
  });

  it('returns 500 when email is missing', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ password: 'test1234' });

    assert.strictEqual(res.status, 500);
    assert.match(res.body.error, /email address and a password/);
  });

  it('returns 500 when password is missing', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev' });

    assert.strictEqual(res.status, 500);
    assert.match(res.body.error, /email address and a password/);
  });

  it('is case-insensitive for email', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'Admin@Seerr.Dev', password: 'test1234' });

    assert.strictEqual(res.status, 200);
    assert.ok('id' in res.body);
  });

  it('allows the non-admin user to log in', async () => {
    const res = await request(app)
      .post('/auth/local')
      .send({ email: 'friend@seerr.dev', password: 'test1234' });

    assert.strictEqual(res.status, 200);
    assert.ok('id' in res.body);
  });

  it('sets a session on successful login', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'test1234' });

    // Session should persist — /me should succeed
    const meRes = await agent.get('/auth/me');
    assert.strictEqual(meRes.status, 200);
  });
});

describe('POST /auth/logout', () => {
  it('returns 200 when not logged in', async () => {
    const res = await request(app).post('/auth/logout');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  it('destroys session and returns 200 when logged in', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    // Verify session is active
    const meBeforeRes = await agent.get('/auth/me');
    assert.strictEqual(meBeforeRes.status, 200);

    const logoutRes = await agent.post('/auth/logout');
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutRes.body.status, 'ok');

    // Session should be invalidated — /me should fail
    const meAfterRes = await agent.get('/auth/me');
    assert.strictEqual(meAfterRes.status, 403);
  });
});

describe('POST /auth/reset-password', () => {
  it('returns 200 for a valid email', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: 'admin@seerr.dev' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  it('returns 200 for nonexistent email (does not reveal user existence)', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: 'nonexistent@seerr.dev' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  it('returns 500 when email is missing', async () => {
    const res = await request(app).post('/auth/reset-password').send({});

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.message, 'Email address required.');
  });

  it('sets a resetPasswordGuid on the user', async () => {
    await request(app)
      .post('/auth/reset-password')
      .send({ email: 'admin@seerr.dev' });

    const userRepo = getRepository(User);
    const user = await userRepo
      .createQueryBuilder('user')
      .addSelect(['user.resetPasswordGuid', 'user.recoveryLinkExpirationDate'])
      .where('user.email = :email', { email: 'admin@seerr.dev' })
      .getOneOrFail();

    assert.notStrictEqual(user.resetPasswordGuid, undefined);
    assert.notStrictEqual(user.resetPasswordGuid, null);
    assert.notStrictEqual(user.recoveryLinkExpirationDate, undefined);
  });
});

describe('POST /auth/reset-password/:guid', () => {
  /** Trigger a password reset and return the guid. */
  async function getResetGuid(email: string): Promise<string> {
    await request(app).post('/auth/reset-password').send({ email });

    const userRepo = getRepository(User);
    const user = await userRepo
      .createQueryBuilder('user')
      .addSelect('user.resetPasswordGuid')
      .where('user.email = :email', { email })
      .getOneOrFail();

    return user.resetPasswordGuid!;
  }

  it('resets password with a valid guid and password', async () => {
    const guid = await getResetGuid('admin@seerr.dev');

    const res = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({ password: 'newpassword123' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');

    // Old password no longer works
    const oldLogin = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'test1234' });
    assert.strictEqual(oldLogin.status, 403);

    // New password works
    const newLogin = await request(app)
      .post('/auth/local')
      .send({ email: 'admin@seerr.dev', password: 'newpassword123' });
    assert.strictEqual(newLogin.status, 200);
  });

  it('returns 500 for an invalid guid', async () => {
    const res = await request(app)
      .post('/auth/reset-password/invalid-guid-here')
      .send({ password: 'newpassword123' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.message, 'Invalid password reset link.');
  });

  it('returns 500 when password is too short', async () => {
    const guid = await getResetGuid('admin@seerr.dev');

    const res = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({ password: 'short' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(
      res.body.message,
      'Password must be at least 8 characters long.'
    );
  });

  it('returns 500 when password is missing', async () => {
    const guid = await getResetGuid('admin@seerr.dev');

    const res = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({});

    assert.strictEqual(res.status, 500);
    assert.strictEqual(
      res.body.message,
      'Password must be at least 8 characters long.'
    );
  });

  it('returns 500 for an expired recovery link', async () => {
    const guid = await getResetGuid('admin@seerr.dev');

    // Expire the link
    const userRepo = getRepository(User);
    const user = await userRepo.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    user.recoveryLinkExpirationDate = new Date('2020-01-01');
    await userRepo.save(user);

    const res = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({ password: 'newpassword123' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.message, 'Invalid password reset link.');
  });

  it('cannot reuse a guid after successful reset', async () => {
    const guid = await getResetGuid('admin@seerr.dev');

    // First reset succeeds
    const first = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({ password: 'newpassword123' });
    assert.strictEqual(first.status, 200);

    // Second reset with same guid fails (recoveryLinkExpirationDate was cleared)
    const second = await request(app)
      .post(`/auth/reset-password/${guid}`)
      .send({ password: 'anotherpassword' });
    assert.strictEqual(second.status, 500);
  });
});

describe('OpenID Connect', () => {
  // Default claims for new user registration tests
  const DEFAULT_CLAIMS = {
    sub: 'new-user-sub',
    email: 'newuser@example.com',
  };

  // Claims for existing seeded user (friend@seerr.dev)
  const EXISTING_USER_CLAIMS = {
    sub: 'friend-oidc-sub',
    email: 'friend@seerr.dev',
  };

  function buildMockWellKnown(options?: { supportsPKCE?: boolean }) {
    return {
      issuer: 'https://example.com',
      authorization_endpoint: 'https://example.com/oauth/authorize',
      token_endpoint: 'https://example.com/oauth/token',
      userinfo_endpoint: 'https://example.com/userinfo',
      jwks_uri: 'https://example.com/.well-known/jwks.json',
      response_types_supported: [
        'code',
        'token',
        'id_token',
        'code token',
        'code id_token',
        'token id_token',
        'code token id_token',
        'none',
      ],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'email', 'profile'],
      ...(options?.supportsPKCE
        ? { code_challenge_methods_supported: ['S256'] }
        : {}),
    };
  }

  /**
   * Performs the login + callback flow and returns the callback response.
   */
  async function performOidcCallback() {
    const loginResponse = await request(app)
      .get('/auth/oidc/login/test')
      .set('Accept', 'application/json');

    assert.strictEqual(loginResponse.status, 200);

    const redirectUrl = new URL(loginResponse.body.redirectUrl);
    const state = redirectUrl.searchParams.get('state');

    const cookies = loginResponse.get('Set-Cookie');
    assert.notStrictEqual(cookies, undefined);
    const cookieHeader = cookies!.map((c) => c.split(';')[0]).join('; ');

    const callbackQuery = state ? `code=123456&state=${state}` : 'code=123456';

    const response = await request(app)
      .get(`/auth/oidc/callback/test?${callbackQuery}`)
      .set('Accept', 'application/json')
      .set('Cookie', cookieHeader);

    return response;
  }

  let mockJwks: { keys: object[] };
  let signIdToken: (claims?: Record<string, unknown>) => Promise<string>;

  before(async () => {
    const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    mockJwks = { keys: [jwk] };

    signIdToken = (claims?: Record<string, unknown>) =>
      new SignJWT({ ...DEFAULT_CLAIMS, ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer('https://example.com')
        .setAudience('jellyseerr')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
  });

  beforeEach(() => {
    // configure test provider settings
    getSettings().load({
      main: {
        oidcLogin: true,
        applicationUrl: 'https://jellyseerr.example.com',
      },
      oidc: {
        providers: [
          {
            slug: 'test',
            name: 'Test Provider',
            clientId: 'jellyseerr',
            clientSecret: 'abcdefg',
            issuerUrl: 'https://example.com',
            newUserLogin: true,
          },
        ],
      },
    });
  });

  async function setupFetchMock(options?: {
    supportsPKCE?: boolean;
    userinfoResponse?: Record<string, unknown>;
    idTokenClaims?: Record<string, unknown>;
  }) {
    const wellKnown = buildMockWellKnown(options);
    const userinfo = options?.userinfoResponse ?? DEFAULT_CLAIMS;
    const idTokenClaims = options?.idTokenClaims;
    const idToken = await signIdToken(idTokenClaims);
    const tokenResponse = {
      access_token: 'abcdefg',
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: idToken,
    };

    fetchMock.mockGlobal();

    fetchMock.route(
      'https://example.com/.well-known/openid-configuration',
      wellKnown
    );
    fetchMock.route('https://example.com/.well-known/jwks.json', mockJwks);
    fetchMock.route('https://example.com/oauth/token', tokenResponse);
    fetchMock.route('https://example.com/userinfo', userinfo);
  }

  describe('without PKCE support (uses state)', function () {
    before(async () => {
      await setupFetchMock({ supportsPKCE: false });
    });

    after(() => {
      fetchMock.hardReset();
    });

    it('login endpoint produces correct redirect URL', async function () {
      const response = await request(app)
        .get('/auth/oidc/login/test')
        .set('Accept', 'application/json');

      assert.match(response.headers['content-type'], /json/);
      assert.strictEqual(response.status, 200);
      assert.match(
        response.body.redirectUrl,
        /^https:\/\/example.com\/oauth\/authorize\?/
      );

      const params = new URL(response.body.redirectUrl);
      assert.strictEqual(params.searchParams.get('response_type'), 'code');
      assert.strictEqual(params.searchParams.get('client_id'), 'jellyseerr');
      assert.strictEqual(
        params.searchParams.get('scope'),
        'openid profile email'
      );
      assert.strictEqual(
        params.searchParams.get('redirect_uri'),
        'https://jellyseerr.example.com/login'
      );
      assert.ok(params.searchParams.get('state'));
    });

    it('callback endpoint successfully authorizes existing user', async function () {
      // Link the seeded friend user to the OIDC provider
      const userRepo = getRepository(User);
      const linkedAccountRepo = getRepository(LinkedAccount);

      const user = await userRepo.findOneOrFail({
        where: { email: 'friend@seerr.dev' },
      });

      const linkedAccount = new LinkedAccount({
        user,
        provider: 'test',
        sub: EXISTING_USER_CLAIMS.sub,
        username: 'friend',
      });
      await linkedAccountRepo.save(linkedAccount);

      // Setup mock to return the existing user's claims
      await setupFetchMock({
        supportsPKCE: false,
        idTokenClaims: EXISTING_USER_CLAIMS,
        userinfoResponse: EXISTING_USER_CLAIMS,
      });

      const response = await performOidcCallback();

      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(response.body, { status: 'ok', to: '/' });
    });
  });

  describe('with PKCE support (no state)', function () {
    before(async () => {
      await setupFetchMock({ supportsPKCE: true });
    });

    after(() => {
      fetchMock.hardReset();
    });

    it('login endpoint does not include state parameter', async function () {
      const response = await request(app)
        .get('/auth/oidc/login/test')
        .set('Accept', 'application/json');

      assert.strictEqual(response.status, 200);

      const params = new URL(response.body.redirectUrl);
      assert.strictEqual(params.searchParams.get('state'), null);
      assert.ok(params.searchParams.get('code_challenge'));
      assert.strictEqual(
        params.searchParams.get('code_challenge_method'),
        'S256'
      );
    });

    it('callback endpoint successfully authorizes existing user', async function () {
      // Link the seeded friend user to the OIDC provider
      const userRepo = getRepository(User);
      const linkedAccountRepo = getRepository(LinkedAccount);

      const user = await userRepo.findOneOrFail({
        where: { email: 'friend@seerr.dev' },
      });

      const linkedAccount = new LinkedAccount({
        user,
        provider: 'test',
        sub: EXISTING_USER_CLAIMS.sub,
        username: 'friend',
      });
      await linkedAccountRepo.save(linkedAccount);

      // Setup mock to return the existing user's claims
      await setupFetchMock({
        supportsPKCE: true,
        idTokenClaims: EXISTING_USER_CLAIMS,
        userinfoResponse: EXISTING_USER_CLAIMS,
      });

      const response = await performOidcCallback();

      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(response.body, { status: 'ok', to: '/' });
    });
  });

  describe('new user registration', function () {
    before(async () => {
      await setupFetchMock({ supportsPKCE: false });
    });

    after(() => {
      fetchMock.hardReset();
    });

    it('creates a new user when newUserLogin is enabled', async function () {
      const settings = getSettings();
      settings.oidc.providers[0].newUserLogin = true;

      const response = await performOidcCallback();

      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(response.body, { status: 'ok', to: '/' });

      // Verify user was created in the database
      const userRepo = getRepository(User);
      const createdUser = await userRepo.findOne({
        where: { email: DEFAULT_CLAIMS.email },
      });
      assert.notStrictEqual(createdUser, null);
      assert.strictEqual(createdUser!.email, DEFAULT_CLAIMS.email);

      // Verify linked account was created
      const linkedAccountRepo = getRepository(LinkedAccount);
      const createdLink = await linkedAccountRepo.findOne({
        where: { provider: 'test', sub: DEFAULT_CLAIMS.sub },
      });
      assert.notStrictEqual(createdLink, null);
    });

    it('rejects new user when newUserLogin is disabled', async function () {
      const settings = getSettings();
      settings.oidc.providers[0].newUserLogin = false;

      const response = await performOidcCallback();

      assert.strictEqual(response.status, 400);

      // Verify no new user was created (only seeded users should exist)
      const userRepo = getRepository(User);
      const newUser = await userRepo.findOne({
        where: { email: DEFAULT_CLAIMS.email },
      });
      assert.strictEqual(newUser, null);
    });
  });
});
