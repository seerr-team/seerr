import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import userRoutes from './index';

let app: Express;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      // secure: false is intentional -- supertest uses HTTP, not HTTPS
      cookie: { secure: false },
    })
  );
  app.use(checkUser);
  app.use('/auth', authRoutes);
  app.use('/user', userRoutes);
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

setupTestDb();

/** Create a supertest agent that is logged in as the given user. */
async function authenticatedAgent(email: string, password: string) {
  const agent = request.agent(app);
  const settings = getSettings();
  const prevLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;
  try {
    const res = await agent.post('/auth/local').send({ email, password });
    assert.strictEqual(res.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = prevLocalLogin;
  }
}

describe('POST /user/:id/settings/notifications', () => {
  it('persists notification settings to the database', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const adminUser = await getRepository(User).findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const res = await agent
      .post(`/user/${adminUser.id}/settings/notifications`)
      .send({
        discordId: 'test-discord-123',
        telegramChatId: 'test-telegram-456',
      });

    assert.strictEqual(res.status, 200);

    const updatedUser = await getRepository(User).findOne({
      where: { id: adminUser.id },
      relations: { settings: true },
    });

    assert.ok(updatedUser?.settings, 'User settings should exist');
    assert.strictEqual(updatedUser.settings.discordId, 'test-discord-123');
    assert.strictEqual(
      updatedUser.settings.telegramChatId,
      'test-telegram-456'
    );
  });

  it('returns the updated values in the response', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const adminUser = await getRepository(User).findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const res = await agent
      .post(`/user/${adminUser.id}/settings/notifications`)
      .send({
        discordId: 'discord-response-check',
        telegramChatId: 'telegram-response-check',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.discordId, 'discord-response-check');
    assert.strictEqual(res.body.telegramChatId, 'telegram-response-check');
  });

  it('returns 404 for a non-existent user', async () => {
    const agent = await authenticatedAgent('admin@seerr.dev', 'test1234');

    const res = await agent
      .post('/user/99999/settings/notifications')
      .send({ discordId: 'test' });

    assert.strictEqual(res.status, 404);
  });

  it('returns 403 for a non-owner non-admin trying to update another user settings', async () => {
    const agent = await authenticatedAgent('friend@seerr.dev', 'test1234');

    const adminUser = await getRepository(User).findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });

    const res = await agent
      .post(`/user/${adminUser.id}/settings/notifications`)
      .send({ discordId: 'should-not-work' });

    assert.strictEqual(res.status, 403);
  });
});
