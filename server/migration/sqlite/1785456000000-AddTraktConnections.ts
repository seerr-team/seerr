import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableCheck, TableForeignKey, TableIndex } from 'typeorm';

export class AddTraktConnections1785456000000 implements MigrationInterface {
  name = 'AddTraktConnections1785456000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const connectionTable = new Table({
      name: 'trakt_connection',
      columns: [
        {
          name: 'id',
          type: 'integer',
          isPrimary: true,
          isGenerated: true,
          generationStrategy: 'increment',
        },
        { name: 'userId', type: 'integer' },
        { name: 'traktUserId', type: 'varchar' },
        { name: 'username', type: 'varchar', isNullable: true },
        { name: 'slug', type: 'varchar', isNullable: true },
        { name: 'displayName', type: 'varchar', isNullable: true },
        { name: 'status', type: 'varchar', default: "'active'" },
        { name: 'accessToken', type: 'text', isNullable: true },
        { name: 'refreshToken', type: 'text', isNullable: true },
        { name: 'expiresAt', type: 'datetime', isNullable: true },
        { name: 'tokenVersion', type: 'integer', default: '1' },
        { name: 'connectedByUserId', type: 'integer', isNullable: true },
        { name: 'lastValidatedAt', type: 'datetime', isNullable: true },
        {
          name: 'createdAt',
          type: 'datetime',
          default: 'CURRENT_TIMESTAMP',
        },
        {
          name: 'updatedAt',
          type: 'datetime',
          default: 'CURRENT_TIMESTAMP',
        },
      ],
    });
    connectionTable.checks.push(
      new TableCheck({
        name: 'CHK_trakt_connection_active_tokens',
        expression:
          `"status" != 'active' OR ("accessToken" IS NOT NULL AND ` +
          `"refreshToken" IS NOT NULL AND "expiresAt" IS NOT NULL)`,
      })
    );
    connectionTable.foreignKeys.push(
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['connectedByUserId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      })
    );
    connectionTable.indices.push(
      new TableIndex({
        name: 'UQ_trakt_connection_user',
        columnNames: ['userId'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'UQ_trakt_connection_identity',
        columnNames: ['traktUserId'],
        isUnique: true,
      })
    );
    await queryRunner.createTable(connectionTable);

    const transactionTable = new Table({
      name: 'trakt_oauth_transaction',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'stateHash', type: 'varchar', length: '64' },
        { name: 'actorUserId', type: 'integer' },
        { name: 'targetUserId', type: 'integer', isNullable: true },
        { name: 'origin', type: 'varchar' },
        { name: 'status', type: 'varchar', default: "'pending'" },
        { name: 'resultCode', type: 'varchar', isNullable: true },
        { name: 'expiresAt', type: 'datetime' },
        { name: 'consumedAt', type: 'datetime', isNullable: true },
        {
          name: 'createdAt',
          type: 'datetime',
          default: 'CURRENT_TIMESTAMP',
        },
      ],
    });
    transactionTable.foreignKeys.push(
      new TableForeignKey({
        columnNames: ['actorUserId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['targetUserId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      })
    );
    transactionTable.indices.push(
      new TableIndex({
        name: 'UQ_trakt_oauth_state',
        columnNames: ['stateHash'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_trakt_oauth_expires_at',
        columnNames: ['expiresAt'],
      }),
      new TableIndex({
        name: 'IDX_trakt_oauth_actor_user',
        columnNames: ['actorUserId'],
      }),
      new TableIndex({
        name: 'IDX_trakt_oauth_target_user',
        columnNames: ['targetUserId'],
      })
    );
    await queryRunner.createTable(transactionTable);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('trakt_oauth_transaction', true, true, true);
    await queryRunner.dropTable('trakt_connection', true, true, true);
  }
}
