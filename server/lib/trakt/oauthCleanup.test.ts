import logger from '@server/logger';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { startTraktOAuthCleanup } from './oauthCleanup';

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

describe('startTraktOAuthCleanup', () => {
  it('runs immediately and on the configured interval', async () => {
    mock.timers.enable({ apis: ['setInterval'] });
    let calls = 0;
    const timer = startTraktOAuthCleanup(
      {
        deleteExpiredTransactions: async () => {
          calls += 1;
          return 0;
        },
      },
      100
    );

    await Promise.resolve();
    assert.equal(calls, 1);
    mock.timers.tick(100);
    await Promise.resolve();
    assert.equal(calls, 2);
    clearInterval(timer);
  });

  it('logs cleanup failures without rejecting the timer callback', async () => {
    mock.timers.enable({ apis: ['setInterval'] });
    const warnings: unknown[] = [];
    const listener = (entry: unknown) => warnings.push(entry);
    const wasSilent = logger.silent;
    logger.silent = false;
    logger.on('data', listener);

    try {
      const timer = startTraktOAuthCleanup({
        deleteExpiredTransactions: async () => {
          throw new TypeError('database unavailable');
        },
      });
      await Promise.resolve();
      await Promise.resolve();
      clearInterval(timer);
    } finally {
      logger.off('data', listener);
      logger.silent = wasSilent;
    }

    const serialized = JSON.stringify(warnings);
    assert.match(serialized, /oauth_cleanup/);
    assert.match(serialized, /TypeError/);
    assert.doesNotMatch(serialized, /database unavailable/);
  });
});
