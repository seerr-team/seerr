import { MediaStatus } from '@server/constants/media';
import { entities } from '@server/datasource';
import MediaServiceStatus from '@server/entity/MediaServiceStatus';
import { upsertMediaServiceStatus } from '@server/lib/mediaServiceStatus';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { DataSource } from 'typeorm';

describe('upsertMediaServiceStatus', () => {
  let dir: string;
  let dbPath: string;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'seerr-mss-'));
    dbPath = join(dir, 'test.sqlite');
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  async function connect(): Promise<DataSource> {
    const ds = new DataSource({
      type: 'sqlite',
      database: dbPath,
      synchronize: true,
      entities,
    });
    await ds.initialize();
    await ds.query('PRAGMA foreign_keys = OFF');
    return ds;
  }

  it('updates an existing row when the upsert is the first write on a fresh connection', async () => {
    const dsA = await connect();
    await upsertMediaServiceStatus(dsA.getRepository(MediaServiceStatus), {
      mediaId: 42,
      serviceId: 0,
      serviceType: 'sonarr',
      status: MediaStatus.PROCESSING,
    });
    await dsA.destroy();

    const dsB = await connect();
    const repoB = dsB.getRepository(MediaServiceStatus);
    try {
      await upsertMediaServiceStatus(repoB, {
        mediaId: 42,
        serviceId: 0,
        serviceType: 'sonarr',
        status: MediaStatus.AVAILABLE,
        externalServiceId: 7,
        externalServiceSlug: 'a-show',
      });

      const rows = await repoB.find({ where: { mediaId: 42, serviceId: 0 } });
      assert.strictEqual(rows.length, 1, 'should not create a duplicate row');
      assert.strictEqual(rows[0].status, MediaStatus.AVAILABLE);
      assert.strictEqual(rows[0].externalServiceId, 7);
      assert.strictEqual(rows[0].externalServiceSlug, 'a-show');
    } finally {
      await dsB.destroy();
    }
  });

  it('inserts a new row when none exists', async () => {
    const ds = await connect();
    const repo = ds.getRepository(MediaServiceStatus);
    try {
      await upsertMediaServiceStatus(repo, {
        mediaId: 99,
        serviceId: 1,
        serviceType: 'radarr',
        status: MediaStatus.PROCESSING,
      });

      const row = await repo.findOneOrFail({
        where: { mediaId: 99, serviceId: 1 },
      });
      assert.strictEqual(row.serviceType, 'radarr');
      assert.strictEqual(row.status, MediaStatus.PROCESSING);
    } finally {
      await ds.destroy();
    }
  });

  it('does not overwrite seasonStatuses unless explicitly requested', async () => {
    const dsA = await connect();
    await upsertMediaServiceStatus(
      dsA.getRepository(MediaServiceStatus),
      {
        mediaId: 7,
        serviceId: 0,
        serviceType: 'sonarr',
        status: MediaStatus.AVAILABLE,
        seasonStatuses: { 1: MediaStatus.AVAILABLE },
      },
      ['status', 'externalServiceId', 'externalServiceSlug', 'seasonStatuses']
    );
    await dsA.destroy();

    const dsB = await connect();
    const repoB = dsB.getRepository(MediaServiceStatus);
    try {
      await upsertMediaServiceStatus(repoB, {
        mediaId: 7,
        serviceId: 0,
        serviceType: 'sonarr',
        status: MediaStatus.PROCESSING,
      });

      const row = await repoB.findOneOrFail({
        where: { mediaId: 7, serviceId: 0 },
      });
      assert.strictEqual(row.status, MediaStatus.PROCESSING);
      assert.deepStrictEqual(row.seasonStatuses, { 1: MediaStatus.AVAILABLE });
    } finally {
      await dsB.destroy();
    }
  });
});
