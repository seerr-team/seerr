import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';
import { getAppVersion } from '@server/utils/appVersion';

import type { MbAlbumDetails, MbArtistDetails } from './interfaces';

const CACHE_TTL = 43200;
const BASE_URL = 'https://musicbrainz.org/ws/2/';
const MAX_RPS = 1;

const window = new JSDOM('').window;
const purify = DOMPurify(window);

const UUID_REGEX =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export const getDefaultMusicBrainzUserAgent = (): string =>
  `Seerr/${getAppVersion()}`;

export const headers: Record<string, string> = {
  Accept: 'application/json',
  'User-Agent': getDefaultMusicBrainzUserAgent(),
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

class MusicBrainz extends ExternalAPI {
  constructor() {
    super(
      BASE_URL,
      {},
      {
        headers,
        nodeCache: cacheManager.getCache('musicbrainz').data,
        rateLimit: {
          maxRequests: MAX_RPS,
          maxRPS: MAX_RPS,
        },
      }
    );
  }

  public async searchAlbum({
    query,
    limit = 30,
    offset = 0,
  }: {
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<MbAlbumDetails[]> {
    try {
      const data = await this.get<{
        'release-groups': MbAlbumDetails[];
      }>(
        '/release-group',
        {
          params: {
            query,
            fmt: 'json',
            limit: String(limit),
            offset: String(offset),
          },
        },
        CACHE_TTL
      );

      return data['release-groups'];
    } catch (error) {
      throw new Error(
        `[MusicBrainz] Failed to search albums: ${getErrorMessage(error)}`
      );
    }
  }

  public async searchArtist({
    query,
    limit = 50,
    offset = 0,
  }: {
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<MbArtistDetails[]> {
    try {
      const data = await this.get<{
        artists: MbArtistDetails[];
      }>(
        '/artist',
        {
          params: {
            query,
            fmt: 'json',
            limit: String(limit),
            offset: String(offset),
          },
        },
        CACHE_TTL
      );

      return data.artists;
    } catch (error) {
      throw new Error(
        `[MusicBrainz] Failed to search artists: ${getErrorMessage(error)}`
      );
    }
  }

  public async getArtistWikipediaExtract({
    artistMbid,
    language = 'en',
  }: {
    artistMbid: string;
    language?: string;
  }): Promise<{ title: string; url: string; content: string } | null> {
    if (!UUID_REGEX.test(artistMbid)) {
      throw new Error('Invalid MusicBrainz artist ID format');
    }

    try {
      const webRoot = BASE_URL.replace(/\/ws\/\d+\/?$/, '').replace(/\/+$/, '');

      const response = await this.axios.get(
        `${webRoot}/artist/${artistMbid}/wikipedia-extract`,
        {
          headers: {
            Accept: 'application/json',
            'Accept-Language': language,
            'User-Agent': getDefaultMusicBrainzUserAgent(),
          },
        }
      );

      const extract = response.data?.wikipediaExtract;

      if (!extract?.content) {
        return null;
      }

      return {
        title: extract.title,
        url: extract.url,
        content: purify
          .sanitize(extract.content, {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: [],
          })
          .trim(),
      };
    } catch (error) {
      throw new Error(
        `[MusicBrainz] Failed to fetch Wikipedia extract: ${getErrorMessage(
          error
        )}`
      );
    }
  }

  public async getReleaseGroup({
    releaseId,
  }: {
    releaseId: string;
  }): Promise<string | null> {
    try {
      const data = await this.get<{
        'release-group'?: {
          id: string;
        };
      }>(
        `/release/${releaseId}`,
        {
          params: {
            inc: 'release-groups',
            fmt: 'json',
          },
        },
        CACHE_TTL
      );

      return data['release-group']?.id ?? null;
    } catch (error) {
      throw new Error(
        `[MusicBrainz] Failed to fetch release group: ${getErrorMessage(error)}`
      );
    }
  }
}

export default MusicBrainz;
