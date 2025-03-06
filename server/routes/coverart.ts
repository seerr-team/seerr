import CoverArtArchive from '@server/api/coverartarchive';
import logger from '@server/logger';
import { Router } from 'express';

const coverArtRoutes = Router();

coverArtRoutes.get('/batch/:ids', async (req, res) => {
  const coverArtArchive = CoverArtArchive.getInstance();
  const ids = (req.params.ids || '').split(',').filter(Boolean);

  if (!ids.length) {
    return res.status(200).json({});
  }

  try {
    const coverResults = await coverArtArchive.batchGetCoverArt(ids);
    return res.status(200).json(coverResults);
  } catch (e) {
    logger.error('Error fetching batch cover art', {
      label: 'CoverArtArchive',
      errorMessage: e instanceof Error ? e.message : 'Unknown error',
      count: ids.length,
    });
    return res.status(200).json({});
  }
});

export default coverArtRoutes;
