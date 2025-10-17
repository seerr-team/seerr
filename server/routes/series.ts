import Hardcover from '@server/api/hardcover';
import { MediaType } from '@server/constants/media';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import { mapSeries } from '@server/models/Series';
import { Router } from 'express';

const seriesRoutes = Router();

seriesRoutes.get<{ id: string }>('/:id', async (req, res, next) => {
  const hardcover = new Hardcover();

  try {
    const series = await hardcover.getSeries(Number(req.params.id));

    const media = await Media.getRelatedMedia(
      req.user,
      series.book_series.map((book) => book.book.id),
      MediaType.BOOK
    );

    return res.status(200).json(mapSeries(series, media));
  } catch (e) {
    logger.debug('Something went wrong retrieving series', {
      label: 'API',
      errorMessage: e.message,
      seriesId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve series.',
    });
  }
});

export default seriesRoutes;
