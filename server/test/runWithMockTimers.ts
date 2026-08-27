import { mock } from 'node:test';

export async function runWithMockTimers<T>(
  runPromise: Promise<T>,
  tickMs = 4000
): Promise<T> {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let settled = false;
    runPromise
      .catch(() => undefined)
      .finally(() => {
        settled = true;
      });
    const maxTicks = 100000;
    for (let i = 0; i < maxTicks && !settled; i++) {
      await new Promise((resolve) => setImmediate(resolve));
      mock.timers.tick(tickMs);
    }
    if (!settled) {
      throw new Error(
        `runWithMockTimers: promise did not settle after ${maxTicks} ticks`
      );
    }
    return await runPromise;
  } finally {
    mock.timers.reset();
  }
}
