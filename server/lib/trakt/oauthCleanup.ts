import type { TraktConnectionService } from '@server/lib/trakt/connectionService';
import logger from '@server/logger';

export const startTraktOAuthCleanup = (
  service: Pick<TraktConnectionService, 'deleteExpiredTransactions'>,
  intervalMs = 60 * 60 * 1000
): NodeJS.Timeout => {
  const run = () => {
    service.deleteExpiredTransactions().catch((error) => {
      logger.warn('Trakt OAuth transaction cleanup failed', {
        label: 'Trakt',
        operation: 'oauth_cleanup',
        errorClass: error instanceof Error ? error.name : 'UnknownError',
      });
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
};
