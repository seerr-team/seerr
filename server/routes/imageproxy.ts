import ImageProxy from '@server/lib/imageproxy';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

const router = Router();

const MAX_CACHE_SIZE = 1024 * 1024 * 1024;

const isAllowedSegment = (segment: string) =>
  segment !== '.' &&
  segment !== '..' &&
  (/^[\w.-]+$/.test(segment) ||
    /^w\d+_filter\(duotone,[\da-f]{6},[\da-f]{6}\)$/i.test(segment));

// Delay the initialization of ImageProxy instances until the proxy (if any) is properly configured
let _tmdbImageProxy: ImageProxy;
function initTmdbImageProxy() {
  if (!_tmdbImageProxy) {
    _tmdbImageProxy = new ImageProxy('tmdb', 'https://image.tmdb.org', {
      rateLimitOptions: {
        maxRequests: 20,
        maxRPS: 50,
      },
      maxCacheSize: MAX_CACHE_SIZE,
    });
  }
  return _tmdbImageProxy;
}
let _tvdbImageProxy: ImageProxy;
function initTvdbImageProxy() {
  if (!_tvdbImageProxy) {
    _tvdbImageProxy = new ImageProxy('tvdb', 'https://artworks.thetvdb.com', {
      rateLimitOptions: {
        maxRequests: 20,
        maxRPS: 50,
      },
      maxCacheSize: MAX_CACHE_SIZE,
    });
  }
  return _tvdbImageProxy;
}

router.get<{
  type: string;
  path: string[];
}>('/:type/*path', async (req, res, next) => {
  if (!getSettings().main.cacheImages) {
    return next({ status: 404, message: 'Image caching is disabled.' });
  }

  const joinedPath = '/' + req.params.path.join('/');

  if (joinedPath.startsWith('//') || joinedPath.includes('://')) {
    logger.error('Invalid URL for image proxy', { imagePath: joinedPath });
    return next({ status: 403, message: 'Invalid URL for image proxy.' });
  }

  const segments = joinedPath.split('/').filter((segment) => segment !== '');

  if (!segments.every(isAllowedSegment)) {
    return next({ status: 400, message: 'Invalid image path.' });
  }

  const imagePath = '/' + segments.join('/');

  try {
    let imageData;
    if (req.params.type === 'tmdb') {
      imageData = await initTmdbImageProxy().getImage(imagePath);
    } else if (req.params.type === 'tvdb') {
      imageData = await initTvdbImageProxy().getImage(imagePath);
    } else {
      logger.error('Unsupported image type', {
        imagePath,
        type: req.params.type,
      });
      return next({ status: 400, message: 'Unsupported image type.' });
    }

    res.writeHead(200, {
      'Content-Type': `image/${imageData.meta.extension}`,
      'Content-Length': imageData.imageBuffer.length,
      'Cache-Control': `public, max-age=${imageData.meta.curRevalidate}`,
      'OS-Cache-Key': imageData.meta.cacheKey,
      'OS-Cache-Status': imageData.meta.cacheMiss ? 'MISS' : 'HIT',
    });

    res.end(imageData.imageBuffer);
  } catch (e) {
    logger.error('Failed to proxy image', {
      imagePath,
      errorMessage: e.message,
    });
    if (!res.headersSent) {
      return next({ status: 500, message: 'Failed to proxy image.' });
    }
    next(e);
  }
});

export default router;
