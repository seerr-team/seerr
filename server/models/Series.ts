import type { HardcoverSeries } from '@server/api/hardcover/interfaces';
import { MediaType } from '@server/constants/media';
import type Media from '@server/entity/Media';
import type { BookResult } from './Search';
import { mapBookResult } from './Search';

export interface Series {
  id: number;
  name: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  books: BookResult[];
}

export const mapSeries = (series: HardcoverSeries, media: Media[]): Series => ({
  id: series.id,
  name: series.name,
  overview: series.description,
  books: series.book_series.map((book_series) =>
    mapBookResult(
      book_series.book,
      media?.find(
        (req) =>
          req.hcId === book_series.book.id && req.mediaType === MediaType.BOOK
      ),
      book_series.position
    )
  ),
});
