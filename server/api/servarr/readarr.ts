import logger from '@server/logger';
import ServarrBase from './base';

export interface MetadataProfile {
  id: number;
  name: string;
  minPopularity: number;
  skipMissingDate: boolean;
  skipMissingIsbn: boolean;
  skipPartsAndSets: boolean;
  skipSeriesSecondary: boolean;
  allowedLanguages: string;
  minPages: number;
  ignored: string[];
}

export interface ReadarrBookOptions {
  title: string;
  qualityProfileId: number;
  metadataProfileId: number;
  tags: number[];
  profileId: number;
  rootFolderPath: string;
  hcId: number;
  authorHcId: number;
  monitored?: boolean;
  searchNow?: boolean;
}

export interface ReadarrBook {
  id: number;
  title: string;
  authorTitle: string;
  seriesTitle: string;
  disambiguation: string;
  authorId: number;
  foreignBookId: string;
  foreignEditionId: string;
  titleSlug: string;
  monitored: boolean;
  anyEditionOk: boolean;
  author?: object;
  edition?: object;
  ratings: {
    votes: number;
    value: number;
    popularity: number;
  };
  releaseDate: string;
  pageCount: number;
  genres: string[];
  images: {
    url: string;
    coverType: string;
    extension: string;
  }[];
  links: {
    url: string;
    name: string;
  }[];
  added: string;
  remoteCover: string;
  grabbed: boolean;
  statistics: {
    bookFileCount: number;
    bookCount: number;
    totalBookCount: number;
    sizeOnDisk: number;
    percentOfBooks: number;
  };
}

interface ReadarrEdition {
  bookId: number;
  foreignEditionId: string;
  titleSlug: string;
  asin: string;
  title: string;
  language: string;
  overview: string;
  format: string;
  isEbook: boolean;
  disambiguation: string;
  publisher: string;
  pageCount: number;
  releaseDate: string;
  images: {
    url: string;
    coverType: string;
    extension: string;
  }[];
  links: {
    url: string;
    name: string;
  }[];
  ratings: {
    votes: number;
    value: number;
    popularity: number;
  };
  monitored: boolean;
  manualAdd: boolean;
  grabbed: boolean;
  id: number;
  isbn13?: string;
}

class ReadarrAPI extends ServarrBase<{ bookId: number }> {
  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    super({ url, apiKey, cacheName: 'readarr', apiName: 'Readarr' });
  }

  public getMetadataProfiles = async (): Promise<MetadataProfile[]> => {
    try {
      const data = await this.getRolling<MetadataProfile[]>(
        `/metadataprofile`,
        undefined,
        3600
      );

      return data;
    } catch (e) {
      throw new Error(
        `[Readarr] Failed to retrieve metadata profiles: ${e.message}`
      );
    }
  };

  public getBooks = async (): Promise<ReadarrBook[]> => {
    try {
      const data = await this.get<ReadarrBook[]>('/book');

      return data;
    } catch (e) {
      throw new Error(`[Readarr] Failed to retrieve books: ${e.message}`);
    }
  };

  public getBook = async (id: number): Promise<ReadarrBook> => {
    try {
      const data = await this.get<ReadarrBook>(`/book/${id}`);

      return data;
    } catch (e) {
      throw new Error(`[Readarr] Failed to retrieve book: ${e.message}`);
    }
  };

  public async getBookByHcId(id: number): Promise<ReadarrBook> {
    try {
      const newBookId = id;
      const response = await this.axios.get<ReadarrBook[]>('/book/lookup', {
        params: { term: `work:${newBookId}` },
      });
      const data = response.data;

      if (!data[0]) {
        throw new Error('Book not found');
      }

      return data[0];
    } catch (e) {
      logger.error('Error retrieving book by ID', {
        label: 'Readarr API',
        errorMessage: e.message,
        hcId: id,
      });
      throw new Error('Book not found');
    }
  }

  public getEditions = async (id: number): Promise<ReadarrEdition[]> => {
    try {
      const response = await this.get<ReadarrEdition[]>(`/edition`, {
        params: { bookId: id },
      });

      return response;
    } catch (e) {
      throw new Error(`[Readarr] Failed to retrieve book: ${e.message}`);
    }
  };

  public addBook = async (
    options: ReadarrBookOptions
  ): Promise<ReadarrBook> => {
    try {
      const newAuthorId = options.authorHcId.toString();
      const book = await this.getBookByHcId(options.hcId);

      if (book.grabbed) {
        logger.info(
          'Book already exists and is available. Skipping add and returning success',
          {
            label: 'Readarr',
            book: book,
          }
        );
        return book;
      }

      // book exists in Readarr but is neither downloaded nor monitored
      if (book.id && !book.monitored) {
        const bookData = await this.getBook(book.id);
        const editionData = await this.getEditions(book.id);
        const response = await this.axios.put<ReadarrBook>(`/book`, {
          ...bookData,
          monitored: true,
          author: {
            ...bookData.author,
            qualityProfileId: options.qualityProfileId,
            metadataProfileId: options.metadataProfileId,
            tags: options.tags,
            rootFolderPath: options.rootFolderPath,
          },
          editions: editionData.map((edition) => ({
            ...edition,
            monitored: edition.foreignEditionId === book.foreignEditionId,
          })),
          addOptions: {
            searchForNewBook: options.searchNow,
          },
        });
        const data = response.data;

        if (data.monitored) {
          logger.info(
            'Found existing book in Readarr and set it to monitored.',
            {
              label: 'Readarr',
              bookId: data.id,
              bookTitle: data.title,
            }
          );
          logger.debug('Readarr update details', {
            label: 'Readarr',
            book: data,
          });

          if (options.searchNow) {
            this.searchBook(data.id);
          }

          return data;
        } else {
          logger.error('Failed to update existing book in Readarr.', {
            label: 'Readarr',
            options,
          });
          throw new Error('Failed to update existing book in Readarr');
        }
      }

      if (book.id) {
        logger.info(
          'Book is already monitored in Readarr. Skipping add and returning success',
          { label: 'Readarr' }
        );
        return book;
      }

      const data = await this.post<ReadarrBook>(`/book`, {
        authorId: 0,
        foreignBookId: book.foreignBookId,
        monitored: true,
        anyEditionOk: false,
        author: {
          authorMetadataId: 0,
          foreignAuthorId: newAuthorId,
          qualityProfileId: options.qualityProfileId,
          metadataProfileId: options.metadataProfileId,
          monitored: true,
          monitorNewItems: 'none',
          tags: options.tags,
          addOptions: {
            searchForMissingBooks: false,
            booksToMonitor: [book.foreignBookId],
          },
          rootFolderPath: options.rootFolderPath,
        },
        editions: [
          {
            bookId: 0,
            foreignEditionId: book.foreignEditionId,
            monitored: true,
            manualAdd: false,
            grabbed: false,
          },
        ],
        grabbed: false,
        addOptions: {
          searchForNewBook: options.searchNow,
        },
      });

      if (data.id) {
        logger.info('Readarr accepted request', { label: 'Readarr' });
        logger.debug('Readarr add details', {
          label: 'Readarr',
          book: data,
        });
      } else {
        logger.error('Failed to add book to Readarr', {
          label: 'Readarr',
          options,
        });
        throw new Error('Failed to add book to Readarr');
      }
      return data;
    } catch (e) {
      logger.error(
        'Failed to add book to Readarr. This might happen if the book already exists, in which case you can safely ignore this error.',
        {
          label: 'Readarr',
          errorMessage: e.message,
          options,
          response: e?.response?.data,
        }
      );
      throw new Error('Failed to add book to Readarr');
    }
  };

  public async searchBook(bookId: number): Promise<void> {
    logger.info('Executing book search command', {
      label: 'Readarr API',
      bookId: bookId,
    });

    try {
      await this.runCommand('BookSearch', { bookIds: [bookId] });
    } catch (e) {
      logger.error(
        'Something went wrong while executing Readarr book search.',
        {
          label: 'Readarr API',
          errorMessage: e.message,
          bookId: bookId,
        }
      );
    }
  }

  public clearCache = ({
    tmdbId: hcId,
    externalId,
  }: {
    tmdbId?: number | null;
    externalId?: number | null;
  }) => {
    if (hcId) {
      this.removeCache('/book/lookup', {
        term: `work:${hcId}`,
      });
    }
    if (externalId) {
      this.removeCache(`/book/${externalId}`);
    }
  };
}

export default ReadarrAPI;
