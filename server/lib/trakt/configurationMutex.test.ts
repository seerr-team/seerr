import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TraktConfigurationMutex } from './configurationMutex';

describe('TraktConfigurationMutex', () => {
  it('runs operations in FIFO order and propagates results', async () => {
    const mutex = new TraktConfigurationMutex();
    const events: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = mutex.run(async () => {
      events.push('first:start');
      await firstGate;
      events.push('first:end');
      return 1;
    });
    const second = mutex.run(async () => {
      events.push('second');
      return 2;
    });

    await Promise.resolve();
    assert.deepEqual(events, ['first:start']);
    releaseFirst();
    assert.deepEqual(await Promise.all([first, second]), [1, 2]);
    assert.deepEqual(events, ['first:start', 'first:end', 'second']);
  });

  it('propagates thrown errors and releases the next operation', async () => {
    const mutex = new TraktConfigurationMutex();
    const failure = new Error('expected failure');
    const first = mutex.run(async () => {
      throw failure;
    });
    const second = mutex.run(async () => 'released');

    await assert.rejects(first, failure);
    assert.equal(await second, 'released');
  });
});
