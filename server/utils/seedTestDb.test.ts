import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { resetTestDb, seedTestDb } from '@server/utils/seedTestDb';

// NODE_ENV is typed readonly, so it is swapped through the whole env object
function setNodeEnv(value: string | undefined) {
  Object.assign(process.env, { NODE_ENV: value });
}

describe('test database guard', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
  });

  it('refuses to seed when NODE_ENV is not test', async () => {
    setNodeEnv('production');

    await assert.rejects(() => seedTestDb(), /Refusing to seed/);
  });

  it('refuses to reset when NODE_ENV is not test', async () => {
    setNodeEnv('production');

    await assert.rejects(() => resetTestDb(), /Refusing to reset/);
  });
});
