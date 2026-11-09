import {
  MovieSortOptionsIterable,
  TvSortOptionsIterable,
} from '@server/api/themoviedb';
import type {
  TmdbSearchMovieResponse,
  TmdbSearchTvResponse,
} from '@server/api/themoviedb/interfaces';
import { MediaStatus, MediaType } from '@server/constants/media';
import dataSource from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import Media from '@server/entity/Media';
import type {
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { createTmdbWithBlocklistSettings } from '@server/routes/discover';
import type { EntityManager } from 'typeorm';
import { In } from 'typeorm';

const TMDB_API_DELAY_MS = 250;
const LIBRARY_OR_REQUESTED = [
  MediaStatus.AVAILABLE,
  MediaStatus.PARTIALLY_AVAILABLE,
  MediaStatus.PROCESSING,
  MediaStatus.PENDING,
];
class AbortTransaction extends Error {}

interface TagEntry {
  id: number;
  tmdbId: number;
  mediaType: MediaType;
  blocklistedTags: string;
  mediaId: number | null;
}

const titleKey = (tmdbId: number, mediaType: MediaType) =>
  `${mediaType}:${tmdbId}`;

class BlocklistedTagProcessor implements RunnableScanner<StatusBase> {
  private running = false;
  private progress = 0;
  private total = 0;
  private matchedKeywords = new Map<string, Set<string>>();
  private discoverFailed = false;

  public async run() {
    this.running = true;

    try {
      await dataSource.transaction(async (em) => {
        await this.createBlocklistEntries(em);
        await this.reconcileTagEntries(em);
      });
    } catch (err) {
      if (err instanceof AbortTransaction) {
        logger.info('Aborting job: Process Blocklisted Tags', {
          label: 'Jobs',
        });
      } else {
        throw err;
      }
    } finally {
      this.reset();
    }
  }

  public status(): StatusBase {
    return {
      running: this.running,
      progress: this.progress,
      total: this.total,
    };
  }

  public cancel() {
    this.running = false;
    this.progress = 0;
    this.total = 0;
  }

  private reset() {
    this.cancel();
    this.matchedKeywords.clear();
    this.discoverFailed = false;
  }

  private async createBlocklistEntries(em: EntityManager) {
    const tmdb = createTmdbWithBlocklistSettings();

    const settings = getSettings();
    const blocklistedTags = settings.main.blocklistedTags;
    const blocklistedTagsArr = blocklistedTags.split(',');

    const pageLimit = settings.main.blocklistedTagsLimit;
    const invalidKeywords = new Set<string>();

    if (blocklistedTags.length === 0) {
      return;
    }

    // The maximum number of queries we're expected to execute
    this.total =
      blocklistedTagsArr.length *
      pageLimit *
      (MovieSortOptionsIterable.length + TvSortOptionsIterable.length);

    for (const tag of blocklistedTagsArr) {
      const keywordDetails = await tmdb.getKeywordDetails({
        keywordId: Number(tag),
      });

      if (keywordDetails === null) {
        logger.warn('Skipping invalid keyword in blocklisted tags', {
          label: 'Blocklisted Tags Processor',
          keywordId: tag,
        });
        invalidKeywords.add(tag);
        continue;
      }

      await this.processTagForType(
        MediaType.MOVIE,
        tag,
        em,
        tmdb.getDiscoverMovies,
        MovieSortOptionsIterable,
        pageLimit
      );
      await this.processTagForType(
        MediaType.TV,
        tag,
        em,
        tmdb.getDiscoverTv,
        TvSortOptionsIterable,
        pageLimit
      );
    }

    if (invalidKeywords.size > 0) {
      const currentTags = blocklistedTagsArr.filter(
        (tag) => !invalidKeywords.has(tag)
      );
      const cleanedTags = currentTags.join(',');

      if (cleanedTags !== blocklistedTags) {
        settings.main.blocklistedTags = cleanedTags;
        await settings.save();

        logger.info('Cleaned up invalid keywords from settings', {
          label: 'Blocklisted Tags Processor',
          removedKeywords: Array.from(invalidKeywords),
          newBlocklistedTags: cleanedTags,
        });
      }
    }
  }

  private async processTagForType<S extends string>(
    type: MediaType,
    tag: string,
    em: EntityManager,
    getDiscover: (options: {
      page: number;
      sortBy?: S;
      keywords: string;
    }) => Promise<TmdbSearchMovieResponse | TmdbSearchTvResponse>,
    sortOptions: readonly S[],
    pageLimit: number
  ): Promise<void> {
    let queryMax = pageLimit * sortOptions.length;
    let fixedSortMode = false;

    for (let query = 0; query < queryMax; query++) {
      const page: number = fixedSortMode
        ? query + 1
        : Math.floor(query / sortOptions.length) + 1;
      const sortBy: S | undefined = fixedSortMode
        ? undefined
        : sortOptions[query % sortOptions.length];

      if (!this.running) {
        throw new AbortTransaction();
      }

      try {
        const response = await getDiscover({ page, sortBy, keywords: tag });

        await this.processResults(response, tag, type, em);
        await new Promise((res) => setTimeout(res, TMDB_API_DELAY_MS));

        this.progress++;
        if (page === 1 && response.total_pages <= queryMax) {
          this.progress += queryMax - response.total_pages;
          fixedSortMode = true;
          queryMax = response.total_pages;
          // restart the counter so sequential paging resumes at page 2 even if earlier queries failed
          query = 0;
        }
      } catch (error) {
        this.discoverFailed = true;
        logger.error('Error processing keyword in blocklisted tags', {
          label: 'Blocklisted Tags Processor',
          keywordId: tag,
          errorMessage: error.message,
        });
      }
    }
  }

  private async processResults(
    response: TmdbSearchMovieResponse | TmdbSearchTvResponse,
    keywordId: string,
    mediaType: MediaType,
    em: EntityManager
  ) {
    const blocklistRepository = em.getRepository(Blocklist);
    const mediaRepository = em.getRepository(Media);

    for (const entry of response.results) {
      const key = titleKey(entry.id, mediaType);
      const keywords = this.matchedKeywords.get(key);

      if (keywords) {
        keywords.add(keywordId);
        continue;
      }

      const inLibraryOrRequested = await mediaRepository.exist({
        where: [
          { tmdbId: entry.id, mediaType, status: In(LIBRARY_OR_REQUESTED) },
          { tmdbId: entry.id, mediaType, status4k: In(LIBRARY_OR_REQUESTED) },
        ],
      });

      if (inLibraryOrRequested) {
        continue;
      }

      this.matchedKeywords.set(key, new Set([keywordId]));

      const alreadyBlocklisted = await blocklistRepository.exist({
        where: { tmdbId: entry.id, mediaType },
      });

      if (!alreadyBlocklisted) {
        await Blocklist.addToBlocklist(
          {
            blocklistRequest: {
              mediaType,
              title: 'title' in entry ? entry.title : entry.name,
              tmdbId: entry.id,
              blocklistedTags: `,${keywordId},`,
            },
          },
          em
        );
      }
    }
  }

  private async reconcileTagEntries(em: EntityManager) {
    // This run's matches are incomplete, so neither staleness nor exact tags are known
    if (this.discoverFailed) {
      logger.warn(
        'Skipping stale blocklist removal after a failed discover query',
        { label: 'Blocklisted Tags Processor' }
      );
      return;
    }

    const blocklistRepository = em.getRepository(Blocklist);
    const tagEntries = await blocklistRepository
      .createQueryBuilder('blocklist')
      .select('blocklist.id', 'id')
      .addSelect('blocklist.tmdbId', 'tmdbId')
      .addSelect('blocklist.mediaType', 'mediaType')
      .addSelect('blocklist.blocklistedTags', 'blocklistedTags')
      .addSelect('media.id', 'mediaId')
      .leftJoin(
        Media,
        'media',
        'media.tmdbId = blocklist.tmdbId AND media.mediaType = blocklist.mediaType'
      )
      .where('blocklist.blocklistedTags IS NOT NULL')
      .getRawMany<TagEntry>();

    const staleEntries: TagEntry[] = [];

    for (const entry of tagEntries) {
      const keywords = this.matchedKeywords.get(
        titleKey(entry.tmdbId, entry.mediaType)
      );

      if (!keywords) {
        staleEntries.push(entry);
        continue;
      }

      const blocklistedTags = `,${[...keywords].join(',')},`;

      if (entry.blocklistedTags !== blocklistedTags) {
        await blocklistRepository.update(entry.id, { blocklistedTags });
      }
    }

    // Batch removes so the query doesn't get too large
    for (let i = 0; i < staleEntries.length; i += 500) {
      if (!this.running) {
        throw new AbortTransaction();
      }

      await this.removeStaleEntries(staleEntries.slice(i, i + 500), em);
    }
  }

  private async removeStaleEntries(entries: TagEntry[], em: EntityManager) {
    const mediaRepository = em.getRepository(Media);
    const mediaIds = entries.flatMap((entry) => entry.mediaId ?? []);

    await em.getRepository(Blocklist).delete(entries.map((entry) => entry.id));

    if (mediaIds.length === 0) {
      return;
    }

    const placeholders = await mediaRepository
      .createQueryBuilder('media')
      .select('media.id', 'id')
      .leftJoin('media.requests', 'request')
      .leftJoin('media.issues', 'issue')
      .leftJoin('media.watchlists', 'watchlist')
      .leftJoin('media.seasons', 'season')
      .where('media.id IN (:...mediaIds)', { mediaIds })
      .andWhere(
        'media.status = :blocklisted AND media.status4k = :blocklisted',
        { blocklisted: MediaStatus.BLOCKLISTED }
      )
      .andWhere(
        'request.id IS NULL AND issue.id IS NULL AND watchlist.id IS NULL AND season.id IS NULL'
      )
      .getRawMany<{ id: number }>();

    if (placeholders.length > 0) {
      await mediaRepository.delete(placeholders.map(({ id }) => id));
    }

    await mediaRepository.update(
      { id: In(mediaIds), status: MediaStatus.BLOCKLISTED },
      { status: MediaStatus.UNKNOWN }
    );
    await mediaRepository.update(
      { id: In(mediaIds), status4k: MediaStatus.BLOCKLISTED },
      { status4k: MediaStatus.UNKNOWN }
    );
  }
}

const blocklistedTagsProcessor = new BlocklistedTagProcessor();

export default blocklistedTagsProcessor;
