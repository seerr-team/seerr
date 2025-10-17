import type { HardcoverAuthorDetails } from '@server/api/hardcover/interfaces';
import type { BookResult } from './Search';

export interface AuthorDetails {
  bio: string;
  books_count: number;
  id: number;
  name: string;
  born_date: string;
  posterPath?: string;
  books?: BookResult[];
}

export const mapAuthorDetails = (
  author: HardcoverAuthorDetails,
  books?: BookResult[]
): AuthorDetails => ({
  id: author.id,
  name: author.name,
  born_date: author.born_date,
  books_count: author.books_count,
  posterPath: author.image?.url,
  bio: author.bio,
  books: books,
});
