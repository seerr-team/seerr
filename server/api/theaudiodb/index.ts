import ExternalAPI from '@server/api/externalapi';
import { getRepository } from '@server/datasource';
import MetadataArtist from '@server/entity/MetadataArtist';
import cacheManager from '@server/lib/cache';
import logger from '@server/logger';
import { In } from 'typeorm';
import type { TadbArtistResponse } from './interfaces';

class TheAudioDb extends ExternalAPI {
  private static instance: TheAudioDb;
  private readonly apiKey = '195003';
  private readonly CACHE_TTL = 43200;
  private readonly STALE_THRESHOLD = 30 * 24 * 60 * 60 * 1000;

  constructor() {
    super(
      'https://www.theaudiodb.com/api/v1/json',
      {},
      {
        nodeCache: cacheManager.getCache('tadb').data,
        rateLimit: {
          maxRPS: 25,
          id: 'tadb',
        },
      }
    );
  }

  public static getInstance(): TheAudioDb {
    if (!TheAudioDb.instance) {
      TheAudioDb.instance = new TheAudioDb();
    }
    return TheAudioDb.instance;
  }

  private isMetadataStale(metadata: MetadataArtist | null): boolean {
    if (!metadata || !metadata.tadbUpdatedAt) return true;
    return Date.now() - metadata.tadbUpdatedAt.getTime() > this.STALE_THRESHOLD;
  }

  private createEmptyResponse() {
    return { artistThumb: null, artistBackground: null };
  }

  public async getArtistImagesFromCache(id: string): Promise<
    | {
        artistThumb: string | null;
        artistBackground: string | null;
      }
    | null
    | undefined
  > {
    try {
      const metadata = await getRepository(MetadataArtist).findOne({
        where: { mbArtistId: id },
        select: ['tadbThumb', 'tadbCover', 'tadbUpdatedAt'],
      });

      if (metadata) {
        return {
          artistThumb: metadata.tadbThumb,
          artistBackground: metadata.tadbCover,
        };
      }
      return undefined;
    } catch (error) {
      logger.error('Failed to fetch artist images from cache', {
        label: 'TheAudioDb',
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async getArtistImages(
    id: string
  ): Promise<{ artistThumb: string | null; artistBackground: string | null }> {
    try {
      const metadata = await getRepository(MetadataArtist).findOne({
        where: { mbArtistId: id },
        select: ['tadbThumb', 'tadbCover', 'tadbUpdatedAt'],
      });

      if (metadata?.tadbThumb || metadata?.tadbCover) {
        return {
          artistThumb: metadata.tadbThumb,
          artistBackground: metadata.tadbCover,
        };
      }

      if (metadata && !this.isMetadataStale(metadata)) {
        return this.createEmptyResponse();
      }

      return await this.fetchArtistImages(id);
    } catch (error) {
      logger.error('Failed to get artist images', {
        label: 'TheAudioDb',
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createEmptyResponse();
    }
  }

  private async fetchArtistImages(id: string): Promise<{
    artistThumb: string | null;
    artistBackground: string | null;
  }> {
    try {
      const data = await this.get<TadbArtistResponse>(
        `/${this.apiKey}/artist-mb.php`,
        { i: id },
        this.CACHE_TTL
      );

      const result = {
        artistThumb: data.artists?.[0]?.strArtistThumb || null,
        artistBackground: data.artists?.[0]?.strArtistFanart || null,
      };

      const metadataRepository = getRepository(MetadataArtist);
      await metadataRepository
        .upsert(
          {
            mbArtistId: id,
            tadbThumb: result.artistThumb,
            tadbCover: result.artistBackground,
            tadbUpdatedAt: new Date(),
          },
          {
            conflictPaths: ['mbArtistId'],
          }
        )
        .catch((e) => {
          logger.error('Failed to save artist metadata', {
            label: 'TheAudioDb',
            error: e instanceof Error ? e.message : 'Unknown error',
          });
        });

      return result;
    } catch (error) {
      await getRepository(MetadataArtist).upsert(
        {
          mbArtistId: id,
          tadbThumb: null,
          tadbCover: null,
          tadbUpdatedAt: new Date(),
        },
        {
          conflictPaths: ['mbArtistId'],
        }
      );
      return this.createEmptyResponse();
    }
  }

  public async batchGetArtistImages(ids: string[]): Promise<
    Record<
      string,
      {
        artistThumb: string | null;
        artistBackground: string | null;
      }
    >
  > {
    if (!ids.length) return {};

    const metadataRepository = getRepository(MetadataArtist);
    const existingMetadata = await metadataRepository.find({
      where: { mbArtistId: In(ids) },
      select: ['mbArtistId', 'tadbThumb', 'tadbCover', 'tadbUpdatedAt'],
    });

    const results: Record<
      string,
      {
        artistThumb: string | null;
        artistBackground: string | null;
      }
    > = {};
    const idsToFetch: string[] = [];

    ids.forEach((id) => {
      const metadata = existingMetadata.find((m) => m.mbArtistId === id);

      if (metadata?.tadbThumb || metadata?.tadbCover) {
        results[id] = {
          artistThumb: metadata.tadbThumb,
          artistBackground: metadata.tadbCover,
        };
      } else if (metadata && !this.isMetadataStale(metadata)) {
        results[id] = {
          artistThumb: null,
          artistBackground: null,
        };
      } else {
        idsToFetch.push(id);
      }
    });

    if (idsToFetch.length > 0) {
      const batchPromises = idsToFetch.map((id) =>
        this.fetchArtistImages(id)
          .then((response) => {
            results[id] = response;
            return true;
          })
          .catch(() => {
            results[id] = {
              artistThumb: null,
              artistBackground: null,
            };
            return false;
          })
      );

      await Promise.all(batchPromises);
    }

    return results;
  }
}

export default TheAudioDb;
