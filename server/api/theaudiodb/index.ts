import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { TadbArtistResponse } from './interfaces';

export const THE_AUDIO_DB_BASE_URL = 'https://www.theaudiodb.com/api/v1/json';
export const THE_AUDIO_DB_DEFAULT_API_KEY = '195003';
export const THE_AUDIO_DB_DEFAULT_MAX_RPS = 25;
export const THE_AUDIO_DB_DEFAULT_MAX_REQUESTS = 20;

class TheAudioDb extends ExternalAPI {
  // 6 hours, matching the cache's stdTtl and the public docs.
  private readonly CACHE_TTL = 21600;
  private readonly apiKey: string;

  constructor() {
    const { theAudioDb } = getSettings().artworkProviders;
    const apiKey = theAudioDb.apiKey;
    const maxRPS =
      theAudioDb.maxRPS > 0 ? theAudioDb.maxRPS : THE_AUDIO_DB_DEFAULT_MAX_RPS;
    const maxRequests =
      theAudioDb.maxRequests > 0
        ? theAudioDb.maxRequests
        : THE_AUDIO_DB_DEFAULT_MAX_REQUESTS;

    super(
      THE_AUDIO_DB_BASE_URL,
      {},
      {
        nodeCache: cacheManager.getCache('tadb').data,
        rateLimit: {
          maxRequests,
          maxRPS,
        },
      }
    );

    this.apiKey = apiKey;
  }

  private createEmptyResponse() {
    return { artistThumb: null, artistBackground: null };
  }

  public async getArtistImages(
    id: string
  ): Promise<{ artistThumb: string | null; artistBackground: string | null }> {
    if (!this.apiKey) {
      return this.createEmptyResponse();
    }
    try {
      const data = await this.get<TadbArtistResponse>(
        `/${this.apiKey}/artist-mb.php`,
        { params: { i: id } },
        this.CACHE_TTL
      );

      return {
        artistThumb: data.artists?.[0]?.strArtistThumb || null,
        artistBackground: data.artists?.[0]?.strArtistFanart || null,
      };
    } catch (error) {
      logger.error('Failed to fetch artist images', {
        label: 'TheAudioDb',
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createEmptyResponse();
    }
  }

  public hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }

  public async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    try {
      // Hit a known MusicBrainz artist ID (Coldplay) to verify the API key
      // is accepted and the upstream responds with a parseable payload.
      const data = await this.get<TadbArtistResponse>(
        `/${this.apiKey}/artist-mb.php`,
        { params: { i: 'cc197bad-dc9c-440d-a5b5-d52ba2e14234' } },
        0
      );
      return Array.isArray(data.artists);
    } catch (error) {
      logger.error('TheAudioDB connection test failed', {
        label: 'TheAudioDb',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

export default TheAudioDb;
