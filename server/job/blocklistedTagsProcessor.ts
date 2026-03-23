import type { SortOptions } from '@server/api/themoviedb';
import { SortOptionsIterable } from '@server/api/themoviedb';
import type {
  TmdbSearchMovieResponse,
  TmdbSearchTvResponse,
} from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import dataSource from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import Media from '@server/entity/Media';
import type {
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { createTmdbWithRegionLanguage } from '@server/routes/discover';
import type { EntityManager } from 'typeorm';

const TMDB_API_DELAY_MS = 250;
class AbortTransaction extends Error {}

class BlocklistedTagProcessor implements RunnableScanner<StatusBase> {
  private running = false;
  private progress = 0;
  private total = 0;

  public async run() {
    this.running = true;

    try {
      await dataSource.transaction(async (em) => {
        await this.cleanBlocklist(em);
        await this.createBlocklistEntries(em);
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
  }

  private async createBlocklistEntries(em: EntityManager) {
    const tmdb = createTmdbWithRegionLanguage();

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
      2 * blocklistedTagsArr.length * pageLimit * SortOptionsIterable.length;

    for (const type of [MediaType.MOVIE, MediaType.TV]) {
      const getDiscover =
        type === MediaType.MOVIE ? tmdb.getDiscoverMovies : tmdb.getDiscoverTv;

      // Iterate for each tag
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

        let queryMax = pageLimit * SortOptionsIterable.length;
        let fixedSortMode = false; // Set to true when the page limit allows for getting every page of tag

        for (let query = 0; query < queryMax; query++) {
          const page: number = fixedSortMode
            ? query + 1
            : (query % pageLimit) + 1;
          const sortBy: SortOptions | undefined = fixedSortMode
            ? undefined
            : SortOptionsIterable[query % SortOptionsIterable.length];

          if (!this.running) {
            throw new AbortTransaction();
          }

          try {
            const response = await getDiscover({
              page,
              sortBy,
              keywords: tag,
            });

            await this.processResults(response, tag, type, em);
            await new Promise((res) => setTimeout(res, TMDB_API_DELAY_MS));

            this.progress++;
            if (page === 1 && response.total_pages <= queryMax) {
              // We will finish the tag with less queries than expected, move progress accordingly
              this.progress += queryMax - response.total_pages;
              fixedSortMode = true;
              queryMax = response.total_pages;
            }
          } catch (error) {
            logger.error('Error processing keyword in blocklisted tags', {
              label: 'Blocklisted Tags Processor',
              keywordId: tag,
              errorMessage: error.message,
            });
          }
        }
      }
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

  private async processResults(
    response: TmdbSearchMovieResponse | TmdbSearchTvResponse,
    keywordId: string,
    mediaType: MediaType,
    em: EntityManager
  ) {
    const blocklistRepository = em.getRepository(Blocklist);

    for (const entry of response.results) {
      const blocklistEntry = await blocklistRepository.findOne({
        where: { tmdbId: entry.id, mediaType },
      });

      if (blocklistEntry) {
        // Don't mark manual blocklists with tags
        // If media wasn't previously blocklisted for this tag, add the tag to the media's blocklist
        if (
          blocklistEntry.blocklistedTags &&
          !blocklistEntry.blocklistedTags.includes(`,${keywordId},`)
        ) {
          await blocklistRepository.update(blocklistEntry.id, {
            blocklistedTags: `${blocklistEntry.blocklistedTags}${keywordId},`,
          });
        }
      } else {
        // Media wasn't previously blocklisted, add it to the blocklist
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

  private async cleanBlocklist(em: EntityManager) {
    // Remove blocklist and media entries blocklisted by tags
    const mediaRepository = em.getRepository(Media);
    const mediaToRemove = await mediaRepository
      .createQueryBuilder('media')
      .innerJoinAndSelect(
        Blocklist,
        'blist',
        'blist.tmdbId = media.tmdbId AND blist.mediaType = media.mediaType'
      )
      .where(`blist.blocklistedTags IS NOT NULL`)
      .getMany();

    // Batch removes so the query doesn't get too large
    for (let i = 0; i < mediaToRemove.length; i += 500) {
      await mediaRepository.remove(mediaToRemove.slice(i, i + 500)); // This also deletes the blocklist entries via cascading
    }
  }
}

const blocklistedTagsProcessor = new BlocklistedTagProcessor();

export default blocklistedTagsProcessor;
