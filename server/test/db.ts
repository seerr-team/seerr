import { resetTestDb, seedTestDb } from '@server/utils/seedTestDb';
import { before, beforeEach } from 'node:test';

export function setupTestDb() {
  before(async () => {
    await seedTestDb();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
}
