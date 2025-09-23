import Hardcover from '@server/api/hardcover';
import type { HardcoverAuthorDetails } from '@server/api/hardcover/interfaces';
import { MediaType } from '@server/constants/media';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import { mapAuthorDetails } from '@server/models/Author';
import { mapBookResult } from '@server/models/Search';
import { Router } from 'express';

const authorRoutes = Router();

authorRoutes.get('/:id', async (req, res, next) => {
  const hardcover = new Hardcover();

  try {
    const hardcoverAuthor = (await hardcover.getAuthor(
      Number(req.params.id)
    )) as HardcoverAuthorDetails;

    const media = await Media.getRelatedMedia(
      req.user,
      hardcoverAuthor.contributions.map((result) => result.book.id),
      MediaType.BOOK
    );

    const books = hardcoverAuthor.contributions.map((result) =>
      mapBookResult(
        result.book,
        media.find(
          (req) =>
            req.hcId === result.book.id && req.mediaType === MediaType.BOOK
        )
      )
    );

    return res.status(200).json(mapAuthorDetails(hardcoverAuthor, books));
  } catch (e) {
    logger.debug('Something went wrong retrieving author', {
      label: 'API',
      errorMessage: e.message,
      authorId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve author.',
    });
  }
});

export default authorRoutes;
