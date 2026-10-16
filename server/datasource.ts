import { Blocklist } from '@server/entity/Blocklist';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import Issue from '@server/entity/Issue';
import IssueComment from '@server/entity/IssueComment';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import OverrideRule from '@server/entity/OverrideRule';
import Season from '@server/entity/Season';
import SeasonRequest from '@server/entity/SeasonRequest';
import { Session } from '@server/entity/Session';
import { User } from '@server/entity/User';
import { UserPushSubscription } from '@server/entity/UserPushSubscription';
import { UserSettings } from '@server/entity/UserSettings';
import { Watchlist } from '@server/entity/Watchlist';
import { IssueCommentSubscriber } from '@server/subscriber/IssueCommentSubscriber';
import { IssueSubscriber } from '@server/subscriber/IssueSubscriber';
import { MediaRequestSubscriber } from '@server/subscriber/MediaRequestSubscriber';
import { MediaSubscriber } from '@server/subscriber/MediaSubscriber';
import { isPgsql } from '@server/utils/dbType';
import fs from 'fs';
import type { TlsOptions } from 'tls';
import type { DataSourceOptions, EntityTarget, Repository } from 'typeorm';
import { DataSource } from 'typeorm';

const DB_SSL_PREFIX = 'DB_SSL_';

const entities = [
  Blocklist,
  DiscoverSlider,
  Issue,
  IssueComment,
  Media,
  MediaRequest,
  OverrideRule,
  Season,
  SeasonRequest,
  Session,
  User,
  UserPushSubscription,
  UserSettings,
  Watchlist,
];

const subscribers = [
  IssueCommentSubscriber,
  IssueSubscriber,
  MediaRequestSubscriber,
  MediaSubscriber,
];

function boolFromEnv(envVar: string, defaultVal = false) {
  if (process.env[envVar]) {
    return process.env[envVar]?.toLowerCase() === 'true';
  }
  return defaultVal;
}

function intFromEnv(envVar: string, defaultVal?: number): number | undefined {
  const val = process.env[envVar];
  if (val) {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultVal : parsed;
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

const testConfig: DataSourceOptions = {
  type: 'sqlite',
  database: ':memory:',
  synchronize: true,
  dropSchema: true,
  logging: boolFromEnv('DB_LOG_QUERIES'),
  entities,
  migrations: ['server/migration/sqlite/**/*.ts'],
  subscribers,
};

const devConfig: DataSourceOptions = {
  type: 'sqlite',
  database: process.env.CONFIG_DIRECTORY
    ? `${process.env.CONFIG_DIRECTORY}/db/db.sqlite3`
    : 'config/db/db.sqlite3',
  synchronize: true,
  migrationsRun: false,
  logging: boolFromEnv('DB_LOG_QUERIES'),
  enableWAL: true,
  entities,
  migrations: ['server/migration/sqlite/**/*.ts'],
  subscribers,
};

const prodConfig: DataSourceOptions = {
  type: 'sqlite',
  database: process.env.CONFIG_DIRECTORY
    ? `${process.env.CONFIG_DIRECTORY}/db/db.sqlite3`
    : 'config/db/db.sqlite3',
  synchronize: false,
  migrationsRun: false,
  logging: boolFromEnv('DB_LOG_QUERIES'),
  enableWAL: true,
  entities,
  migrations: ['dist/migration/sqlite/**/*.js'],
  subscribers,
};

const postgresDevConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_SOCKET_PATH || process.env.DB_HOST,
  port: process.env.DB_SOCKET_PATH
    ? undefined
    : parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME ?? 'seerr',
  ssl: buildSslConfig(),
  poolSize: intFromEnv('DB_POOL_SIZE'),
  // Bounds pool acquisition waits so exhaustion surfaces as errors instead of a silent hang
  connectTimeoutMS: intFromEnv('DB_CONNECT_TIMEOUT_MS', 30000),
  synchronize: false,
  migrationsRun: true,
  logging: boolFromEnv('DB_LOG_QUERIES'),
  entities,
  migrations: ['server/migration/postgres/**/*.ts'],
  subscribers,
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
  poolSize: intFromEnv('DB_POOL_SIZE'),
  // Bounds pool acquisition waits so exhaustion surfaces as errors instead of a silent hang
  connectTimeoutMS: intFromEnv('DB_CONNECT_TIMEOUT_MS', 30000),
  synchronize: false,
  migrationsRun: false,
  logging: boolFromEnv('DB_LOG_QUERIES'),
  entities,
  migrations: ['dist/migration/postgres/**/*.js'],
  subscribers,
};

function getDataSource(): DataSourceOptions {
  if (process.env.NODE_ENV === 'test') {
    return testConfig;
  } else if (process.env.NODE_ENV === 'production') {
    return isPgsql ? postgresProdConfig : prodConfig;
  } else {
    return isPgsql ? postgresDevConfig : devConfig;
  }
}

const dataSource = new DataSource(getDataSource());

export const getRepository = <Entity extends object>(
  target: EntityTarget<Entity>
): Repository<Entity> => {
  return dataSource.getRepository(target);
};

export default dataSource;
