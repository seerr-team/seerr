import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TraktRefreshCoordinator } from './refreshCoordinator';

describe('TraktRefreshCoordinator', () => {
  it('shares one in-flight refresh per connection and forgets it afterward', async () => {
    const coordinator = new TraktRefreshCoordinator();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let refreshes = 0;
    const refresh = async () => {
      refreshes += 1;
      await blocked;
      return {
        connectionId: 17,
        accessToken: 'replacement-access-token',
        tokenVersion: 4,
      };
    };

    const first = coordinator.run(17, refresh);
    const second = coordinator.run(17, refresh);
    release();

    assert.deepEqual(await Promise.all([first, second]), [
      {
        connectionId: 17,
        accessToken: 'replacement-access-token',
        tokenVersion: 4,
      },
      {
        connectionId: 17,
        accessToken: 'replacement-access-token',
        tokenVersion: 4,
      },
    ]);
    assert.equal(refreshes, 1);

    await coordinator.run(17, refresh);
    assert.equal(refreshes, 2);
  });

  it('does not combine refreshes for different connections', async () => {
    const coordinator = new TraktRefreshCoordinator();
    const seen: number[] = [];

    const results = await Promise.all(
      [17, 18].map((connectionId) =>
        coordinator.run(connectionId, async () => {
          seen.push(connectionId);
          return {
            connectionId,
            accessToken: `access-${connectionId}`,
            tokenVersion: 2,
          };
        })
      )
    );

    assert.deepEqual(seen.sort(), [17, 18]);
    assert.deepEqual(
      results.map((result) => result.accessToken),
      ['access-17', 'access-18']
    );
  });
});
