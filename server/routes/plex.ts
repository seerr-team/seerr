import { plexRecentScanner } from '@server/lib/scanners/plex';
import logger from '@server/logger';
import { Router } from 'express';

const plexRoutes = Router();

plexRoutes.post('/recently-added', async (req, res, next) => {
  const ratingKey = req.body?.ratingKey;

  if (!ratingKey || typeof ratingKey !== 'string') {
    return next({
      status: 400,
      message: 'Plex ratingKey is required.',
    });
  }

  try {
    const metadata = await plexRecentScanner.processRatingKey(ratingKey);

    return res.status(200).json({
      ratingKey: metadata.ratingKey,
      type: metadata.type,
      title: metadata.title,
    });
  } catch (e) {
    logger.error('Failed to process pushed Plex recently added media', {
      label: 'Plex Scan',
      ratingKey,
      errorMessage: e.message,
    });

    return next({
      status: 500,
      message: 'Unable to process Plex media.',
    });
  }
});

export default plexRoutes;
