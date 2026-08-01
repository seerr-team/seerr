import { getRepository } from '@server/datasource';
import {
  TraktConnection,
  TraktConnectionStatus,
} from '@server/entity/TraktConnection';
import { TraktOAuthTransaction } from '@server/entity/TraktOAuthTransaction';
import { User } from '@server/entity/User';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

setupTestDb();

describe('Trakt persistence', () => {
  it('allows only one connection per Seerr user and per Trakt identity', async () => {
    const users = getRepository(User);
    const connections = getRepository(TraktConnection);
    const admin = await users.findOneByOrFail({ email: 'admin@seerr.dev' });
    const friend = await users.findOneByOrFail({ email: 'friend@seerr.dev' });

    await connections.save(
      connections.create({
        user: admin,
        traktUserId: '101',
        username: 'admin-trakt',
        status: TraktConnectionStatus.ACTIVE,
        accessToken: 'access-one',
        refreshToken: 'refresh-one',
        expiresAt: new Date(Date.now() + 3_600_000),
        connectedByUserId: admin.id,
      })
    );

    await assert.rejects(
      connections.save(
        connections.create({
          user: admin,
          traktUserId: '202',
          status: TraktConnectionStatus.RECONNECT_REQUIRED,
          connectedByUserId: admin.id,
        })
      ),
      /UNIQUE|unique/i
    );

    await assert.rejects(
      connections.save(
        connections.create({
          user: friend,
          traktUserId: '101',
          status: TraktConnectionStatus.RECONNECT_REQUIRED,
          connectedByUserId: admin.id,
        })
      ),
      /UNIQUE|unique/i
    );
  });

  it('rejects an active connection without a complete token set', async () => {
    const users = getRepository(User);
    const connections = getRepository(TraktConnection);
    const admin = await users.findOneByOrFail({ email: 'admin@seerr.dev' });

    await assert.rejects(
      connections.save(
        connections.create({
          user: admin,
          traktUserId: '303',
          status: TraktConnectionStatus.ACTIVE,
          connectedByUserId: admin.id,
        })
      ),
      /CHECK|constraint/i
    );
  });

  it('stores only the SHA-256 state digest in an OAuth transaction', async () => {
    const users = getRepository(User);
    const transactions = getRepository(TraktOAuthTransaction);
    const admin = await users.findOneByOrFail({ email: 'admin@seerr.dev' });
    const row = await transactions.save(
      transactions.create({
        id: '8f80ad5d-fb12-488f-b46d-afc4b36027e6',
        stateHash:
          '17f165d5a5ba695f27c023a83aa2b346f69e455e443bc71f201727fdad53139f',
        actorUserId: admin.id,
        targetUserId: admin.id,
        origin: 'https://requests.example.com',
        expiresAt: new Date(Date.now() + 600_000),
      })
    );

    assert.equal(row.stateHash.length, 64);
    assert.equal('rawState' in row, false);
  });

  it('cascades a target connection while retaining a cross-user OAuth transaction', async () => {
    const users = getRepository(User);
    const connections = getRepository(TraktConnection);
    const transactions = getRepository(TraktOAuthTransaction);
    const admin = await users.findOneByOrFail({ email: 'admin@seerr.dev' });
    const friend = await users.findOneByOrFail({ email: 'friend@seerr.dev' });

    await connections.save(
      connections.create({
        user: friend,
        traktUserId: '404',
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
        connectedByUserId: admin.id,
      })
    );
    await transactions.save(
      transactions.create({
        id: '22379984-7a84-4191-bd61-0d4b55b2d1d4',
        stateHash:
          'aa2c5e1f4f26fa6044ada4e1668fb7f1130b7e35052f51e9ad68a95c5e31947d',
        actorUserId: admin.id,
        targetUserId: friend.id,
        origin: 'https://requests.example.com',
        expiresAt: new Date(Date.now() + 600_000),
      })
    );

    await users.remove(friend);

    assert.equal(await connections.count(), 0);
    assert.equal(
      (
        await transactions.findOneByOrFail({
          id: '22379984-7a84-4191-bd61-0d4b55b2d1d4',
        })
      ).targetUserId,
      null
    );
  });

  it('cascades OAuth transactions when their actor is deleted', async () => {
    const users = getRepository(User);
    const transactions = getRepository(TraktOAuthTransaction);
    const admin = await users.findOneByOrFail({ email: 'admin@seerr.dev' });
    const friend = await users.findOneByOrFail({ email: 'friend@seerr.dev' });

    await transactions.save(
      transactions.create({
        id: '4db5a50a-4236-4b33-bc2b-23e156dd0b49',
        stateHash:
          'f7d7a7d56ca27d9854e378e20958313ce992611d0f1b31a6bc294625f2c75285',
        actorUserId: admin.id,
        targetUserId: friend.id,
        origin: 'https://requests.example.com',
        expiresAt: new Date(Date.now() + 600_000),
      })
    );

    await users.remove(admin);

    assert.equal(await transactions.count(), 0);
  });

  it('retains another target connection when its connecting actor is deleted', async () => {
    const users = getRepository(User);
    const connections = getRepository(TraktConnection);
    const admin = await users.findOneByOrFail({ email: 'admin@seerr.dev' });
    const friend = await users.findOneByOrFail({ email: 'friend@seerr.dev' });
    const connection = await connections.save(
      connections.create({
        user: friend,
        traktUserId: '505',
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
        connectedByUserId: admin.id,
      })
    );

    await users.remove(admin);

    assert.equal(
      (await connections.findOneByOrFail({ id: connection.id }))
        .connectedByUserId,
      null
    );
  });
});
