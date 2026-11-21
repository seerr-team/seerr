/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';
import type { TlsOptions } from 'tls';
import {
  DataSource,
  type DataSourceOptions,
  type ObjectLiteral,
} from 'typeorm';

const DB_SSL_PREFIX = 'DB_SSL_';

function boolFromEnv(envVar: string, defaultVal = false) {
  if (process.env[envVar]) {
    return process.env[envVar]?.toLowerCase() === 'true';
  }
  return defaultVal;
}

function stringOrReadFileFromEnv(envVar: string): Buffer | string | undefined {
  if (process.env[envVar]) {
    return process.env[envVar];
  }
  const filePath = process.env[`${envVar}_FILE`];
  if (filePath) {
    return fs.readFileSync(filePath);
  }
  return undefined;
}

function buildSslConfig(): TlsOptions | undefined {
  if (process.env.DB_USE_SSL?.toLowerCase() !== 'true') {
    return undefined;
  }
  return {
    rejectUnauthorized: boolFromEnv(
      `${DB_SSL_PREFIX}REJECT_UNAUTHORIZED`,
      true
    ),
    ca: stringOrReadFileFromEnv(`${DB_SSL_PREFIX}CA`),
    key: stringOrReadFileFromEnv(`${DB_SSL_PREFIX}KEY`),
    cert: stringOrReadFileFromEnv(`${DB_SSL_PREFIX}CERT`),
  };
}

const prodConfig: DataSourceOptions = {
  type: 'sqlite',
  database: process.env.CONFIG_DIRECTORY
    ? `${process.env.CONFIG_DIRECTORY}/db/db.sqlite3`
    : 'config/db/db.sqlite3',
  synchronize: false,
  migrationsRun: false,
  logging: boolFromEnv('DB_LOG_QUERIES'),
  enableWAL: true,
  // entities: ['dist/entity/**/*.js'],
  migrations: ['dist/migration/sqlite/**/*.js'],
  subscribers: ['dist/subscriber/**/*.js'],
};

const postgresProdConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_SOCKET_PATH || process.env.DB_HOST,
  port: process.env.DB_SOCKET_PATH
    ? undefined
    : parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME ?? 'seerr',
  ssl: buildSslConfig(),
  synchronize: false,
  migrationsRun: true,
  logging: boolFromEnv('DB_LOG_QUERIES'),
  // entities: ['dist/entity/**/*.js'],
  migrations: ['dist/migration/postgres/**/*.js'],
  subscribers: ['dist/subscriber/**/*.js'],
};

async function loadEntities(type: 'sqlite' | 'postgres') {
  process.env.DB_TYPE = type;
  Object.keys(require.cache).forEach((key) => {
    if (key.includes(path.join(__dirname, '../../dist'))) {
      delete require.cache[key];
    }
  });
  const entities = await Promise.all(
    fs
      .readdirSync(path.join(__dirname, '../../dist/entity'))
      .filter((file) => file.endsWith('.js'))
      .map((file) => {
        /* eslint @typescript-eslint/no-var-requires: "off" */
        const entityModule = require(
          path.join(__dirname, '../../dist/entity', file)
        );
        return entityModule.default || entityModule[file.replace('.js', '')];
      })
  );
  return entities;
}

async function migrate() {
  const sqliteEntities = await loadEntities('sqlite');
  const sqliteDataSource = new DataSource({
    entities: sqliteEntities,
    ...prodConfig,
  });
  await sqliteDataSource.initialize();
  console.log('SQLite DataSource initialized.');

  const postgresEntities = await loadEntities('postgres');
  const postgresDataSource = new DataSource({
    entities: postgresEntities,
    ...postgresProdConfig,
  });
  await postgresDataSource.initialize();
  console.log('Postgres DataSource initialized.');

  // create query runner and disable foreign key constraints for Postgres
  const queryRunner = postgresDataSource.createQueryRunner();
  await queryRunner.connect();
  console.log('Disabling foreign key constraints...');
  await queryRunner.query(`SET session_replication_role = 'replica';`);

  try {
    const entities = sqliteDataSource.entityMetadatas;

    for (const entity of entities) {
      const entityName = entity.name;
      const tableName = entity.tableName;

      console.log(`Migrating table: ${tableName} (${entityName})...`);

      const sourceRepo = sqliteDataSource.getRepository(entityName);
      // const targetRepo = postgresDataSource.getRepository(entityName);
      const targetRepo = queryRunner.manager.getRepository(entityName);

      const BATCH_SIZE = 1000;
      let skip = 0;
      let totalCount = 0;

      let rows: ObjectLiteral[];
      do {
        rows = await sourceRepo.find({
          take: BATCH_SIZE,
          skip: skip,
          loadEagerRelations: false,
          loadRelationIds: true,
        });

        for (const row of rows) {
          // set postgres ID seq to because TypeORM ignores the ID field when saving
          if (row.id && typeof row.id === 'number' && row.id > 1) {
            await queryRunner.query(`
              SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), ${row.id - 1}, true);
            `);
          }
          await targetRepo.save(row, {
            transaction: false,
            listeners: false,
            reload: false,
          });
        }

        skip += BATCH_SIZE;
        totalCount += rows.length;
      } while (rows.length !== 0);
      console.log(`  -> Copied ${totalCount} rows.`);
    }
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    console.log('Re-enabling foreign key constraints...');
    await queryRunner.query(`SET session_replication_role = 'origin';`);
    await queryRunner.release();

    await sqliteDataSource.destroy();
    await postgresDataSource.destroy();
    console.log('Migration complete.');
  }
}

migrate();
