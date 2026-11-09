import {
  MovieSortOptionsIterable,
  TvSortOptionsIterable,
} from '@server/api/themoviedb';
import type {
  TmdbSearchMovieResponse,
  TmdbSearchTvResponse,
} from '@server/api/themoviedb/interfaces';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import dataSource from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
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
const ACTIVE_REQUEST_STATUSES = [
  MediaRequestStatus.PENDING,
  MediaRequestStatus.APPROVED,
  MediaRequestStatus.FAILED,
];
const BLOCK_ELIGIBLE = [
  MediaStatus.UNKNOWN,
  MediaStatus.DELETED,
  MediaStatus.BLOCKLISTED,
];
class AbortTransaction extends Error {}

interface TagEntry {
  id: number;
  tmdbId: number;
  mediaType: MediaType;
  blocklistedTags: string;
  mediaId: number | null;
  status: MediaStatus | null;
  status4k: MediaStatus | null;
}

const titleKey = (tmdbId: number, mediaType: MediaType) =>
  `${mediaType}:${tmdbId}`;

const isLibraryOrRequested = (status: MediaStatus | null) =>
  status !== null && LIBRARY_OR_REQUESTED.includes(status);

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

        if (!this.running) {
          throw new AbortTransaction();
        }
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

      // A BLOCKLISTED row can still hold live requests, so status alone isn't enough
      const inLibraryOrRequested =
        (await mediaRepository.exist({
          where: [
            { tmdbId: entry.id, mediaType, status: In(LIBRARY_OR_REQUESTED) },
            { tmdbId: entry.id, mediaType, status4k: In(LIBRARY_OR_REQUESTED) },
          ],
        })) ||
        (await em.getRepository(MediaRequest).exist({
          where: {
            media: { tmdbId: entry.id, mediaType },
            status: In(ACTIVE_REQUEST_STATUSES),
          },
        }));

      if (inLibraryOrRequested) {
        continue;
      }

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

      this.matchedKeywords.set(key, new Set([keywordId]));
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
      .addSelect('media.status', 'status')
      .addSelect('media.status4k', 'status4k')
      .leftJoin(
        Media,
        'media',
        'media.tmdbId = blocklist.tmdbId AND media.mediaType = blocklist.mediaType'
      )
      .where('blocklist.blocklistedTags IS NOT NULL')
      .getRawMany<TagEntry>();

    const staleEntries: TagEntry[] = [];
    const unblockedMediaIds: number[] = [];

    for (const entry of tagEntries) {
      const keywords = this.matchedKeywords.get(
        titleKey(entry.tmdbId, entry.mediaType)
      );

      // A scan or request can land after the title passed the guard earlier in the run
      if (
        !keywords ||
        isLibraryOrRequested(entry.status) ||
        isLibraryOrRequested(entry.status4k)
      ) {
        staleEntries.push(entry);
        continue;
      }

      if (entry.mediaId === null) {
        await this.createPlaceholderMedia(entry, em);
      } else if (
        entry.status !== MediaStatus.BLOCKLISTED ||
        entry.status4k !== MediaStatus.BLOCKLISTED
      ) {
        unblockedMediaIds.push(entry.mediaId);
      }

      const blocklistedTags = `,${[...keywords].join(',')},`;

      if (entry.blocklistedTags !== blocklistedTags) {
        await blocklistRepository.update(entry.id, { blocklistedTags });
      }
    }

    // Requests are blocked by the media status, not the blocklist row
    for (let i = 0; i < unblockedMediaIds.length; i += 500) {
      await em.getRepository(Media).update(
        {
          id: In(unblockedMediaIds.slice(i, i + 500)),
          status: In(BLOCK_ELIGIBLE),
          status4k: In(BLOCK_ELIGIBLE),
        },
        { status: MediaStatus.BLOCKLISTED, status4k: MediaStatus.BLOCKLISTED }
      );
    }

    // Batch removes so the query doesn't get too large
    for (let i = 0; i < staleEntries.length; i += 500) {
      if (!this.running) {
        throw new AbortTransaction();
      }

      await this.removeStaleEntries(staleEntries.slice(i, i + 500), em);
    }
  }

  private async createPlaceholderMedia(entry: TagEntry, em: EntityManager) {
    const media = await em.getRepository(Media).save(
      new Media({
        tmdbId: entry.tmdbId,
        mediaType: entry.mediaType,
        status: MediaStatus.BLOCKLISTED,
        status4k: MediaStatus.BLOCKLISTED,
      })
    );

    await em
      .getRepository(Blocklist)
      .update(entry.id, { media: { id: media.id } });
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

    const activeRequests = await em
      .getRepository(MediaRequest)
      .createQueryBuilder('request')
      .select('media.id', 'mediaId')
      .addSelect('request.status', 'status')
      .addSelect('request.is4k', 'is4k')
      .innerJoin('request.media', 'media')
      .where('media.id IN (:...mediaIds)', { mediaIds })
      .andWhere('request.status IN (:...statuses)', {
        statuses: ACTIVE_REQUEST_STATUSES,
      })
      .getRawMany<{
        mediaId: number;
        status: MediaRequestStatus;
        is4k: boolean | number;
      }>();

    for (const column of ['status', 'status4k'] as const) {
      const requests = activeRequests.filter(
        ({ is4k }) => Boolean(is4k) === (column === 'status4k')
      );
      const restoredStatuses: [MediaStatus, number[]][] = [
        [
          MediaStatus.PROCESSING,
          requests
            .filter(({ status }) => status !== MediaRequestStatus.PENDING)
            .map(({ mediaId }) => mediaId),
        ],
        [
          MediaStatus.PENDING,
          requests
            .filter(({ status }) => status === MediaRequestStatus.PENDING)
            .map(({ mediaId }) => mediaId),
        ],
        [MediaStatus.UNKNOWN, mediaIds],
      ];

      // Each update only sees rows still BLOCKLISTED, so this order sets the precedence
      for (const [status, ids] of restoredStatuses) {
        if (ids.length > 0) {
          await mediaRepository.update(
            { id: In(ids), [column]: MediaStatus.BLOCKLISTED },
            { [column]: status }
          );
        }
      }
    }
  }
}

const blocklistedTagsProcessor = new BlocklistedTagProcessor();

export default blocklistedTagsProcessor;
