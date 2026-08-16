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
    let guard = 0;
    while (!settled && guard++ < 100000) {
      await new Promise((resolve) => setImmediate(resolve));
      mock.timers.tick(tickMs);
    }
    return await runPromise;
  } finally {
    mock.timers.reset();
  }
}
