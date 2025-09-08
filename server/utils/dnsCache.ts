import logger from '@server/logger';
import { DnsCacheManager } from 'dns-caching';

export let dnsCache: DnsCacheManager | undefined;

export function initializeDnsCache({
  forceMinTtl,
  forceMaxTtl,
}: {
  forceMinTtl?: number;
  forceMaxTtl?: number;
}) {
  if (dnsCache) {
    logger.warn('DNS Cache is already initialized', { label: 'DNS Cache' });
    return;
  }

  logger.info('Initializing DNS Cache', { label: 'DNS Cache' });

  dnsCache = new DnsCacheManager({
    logger,
    forceMinTtl: typeof forceMinTtl === 'number' ? forceMinTtl * 1000 : 0,
    forceMaxTtl: typeof forceMaxTtl === 'number' ? forceMaxTtl * 1000 : -1,
  });
  dnsCache.initialize();
}
