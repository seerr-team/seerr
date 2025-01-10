import ImageProxy from '@server/lib/imageproxy';
import logger from '@server/logger';
import { Router } from 'express';

const router = Router();
const caaImageProxy = new ImageProxy('caa', 'http://coverartarchive.org', {
  rateLimitOptions: {
    maxRPS: 50,
  },
});

router.get('/*', async (req, res) => {
  const imagePath = req.path;
  try {
    const imageData = await caaImageProxy.getImage(imagePath);

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
    res.status(500).end();
  }
});

export default router;
