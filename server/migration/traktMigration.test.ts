import dataSource from '@server/datasource';
import { seedTestDb } from '@server/utils/seedTestDb';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

interface SqliteForeignKey {
  from: string;
  on_delete: string;
  table: string;
  to: string;
}

interface SqliteIndex {
  name: string;
  unique: number;
}

interface SqliteTable {
  name: string;
  sql: string;
}

before(async () => {
  await seedTestDb({ withMigrations: true });
});

describe('Trakt migrations', () => {
  it('creates both Trakt tables with their unique indexes and foreign keys', async () => {
    const tables = await dataSource.query<SqliteTable[]>(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name IN ('trakt_connection', 'trakt_oauth_transaction')"
    );
    assert.deepEqual(tables.map((table) => table.name).sort(), [
      'trakt_connection',
      'trakt_oauth_transaction',
    ]);

    const connectionIndexes = await dataSource.query<SqliteIndex[]>(
      'PRAGMA index_list("trakt_connection")'
    );
    const transactionIndexes = await dataSource.query<SqliteIndex[]>(
      'PRAGMA index_list("trakt_oauth_transaction")'
    );
    const uniqueIndexes = [...connectionIndexes, ...transactionIndexes]
      .filter((index) => index.unique === 1)
      .map((index) => index.name);
    assert.deepEqual(
      uniqueIndexes.filter((name) => name.startsWith('UQ_trakt_')).sort(),
      [
        'UQ_trakt_connection_identity',
        'UQ_trakt_connection_user',
        'UQ_trakt_oauth_state',
      ]
    );

    const connectionForeignKeys = await dataSource.query<SqliteForeignKey[]>(
      'PRAGMA foreign_key_list("trakt_connection")'
    );
    const transactionForeignKeys = await dataSource.query<SqliteForeignKey[]>(
      'PRAGMA foreign_key_list("trakt_oauth_transaction")'
    );
    assert.deepEqual(
      connectionForeignKeys
        .map(({ from, on_delete, table, to }) => ({
          from,
          onDelete: on_delete,
          table,
          to,
        }))
        .sort((left, right) => left.from.localeCompare(right.from)),
      [
        {
          from: 'connectedByUserId',
          onDelete: 'SET NULL',
          table: 'user',
          to: 'id',
        },
        { from: 'userId', onDelete: 'CASCADE', table: 'user', to: 'id' },
      ]
    );
    assert.deepEqual(
      transactionForeignKeys
        .map(({ from, on_delete, table, to }) => ({
          from,
          onDelete: on_delete,
          table,
          to,
        }))
        .sort((left, right) => left.from.localeCompare(right.from)),
      [
        {
          from: 'actorUserId',
          onDelete: 'CASCADE',
          table: 'user',
          to: 'id',
        },
        {
          from: 'targetUserId',
          onDelete: 'SET NULL',
          table: 'user',
          to: 'id',
        },
      ]
    );
  });

  it('enforces the active-token check constraint', async () => {
    const [connectionTable] = await dataSource.query<SqliteTable[]>(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = 'trakt_connection'"
    );
    assert.match(connectionTable.sql, /CHK_trakt_connection_active_tokens/);

    await assert.rejects(
      dataSource.query(
        'INSERT INTO "trakt_connection" ("userId", "traktUserId", "status") VALUES (1, \'missing-tokens\', \'active\')'
      ),
      /CHECK constraint failed|constraint/i
    );
  });
});
