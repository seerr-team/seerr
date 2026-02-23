import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import type { MbAlbumDetails, MbArtistDetails } from './interfaces';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

const escapeLucene = (s: string): string =>
  s.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');

class MusicBrainz extends ExternalAPI {
  constructor() {
    super(
      'https://musicbrainz.org/ws/2',
      {},
      {
        headers: {
          'User-Agent': 'Seerr/1.0.0 (https://github.com/seerr-team/seerr)',
          Accept: 'application/json',
        },
        nodeCache: cacheManager.getCache('musicbrainz').data,
        rateLimit: {
          maxRequests: 1,
          maxRPS: 1,
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
        created: string;
        count: number;
        offset: number;
        'release-groups': MbAlbumDetails[];
      }>(
        '/release-group',
        {
          params: {
            query,
            fmt: 'json',
            limit: limit.toString(),
            offset: offset.toString(),
          },
        },
        43200
      );

      return data['release-groups'];
    } catch (e) {
      throw new Error(
        `[MusicBrainz] Failed to search albums: ${
          e instanceof Error ? e.message : 'Unknown error'
        }`
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
        created: string;
        count: number;
        offset: number;
        artists: MbArtistDetails[];
      }>(
        '/artist',
        {
          params: {
            query,
            fmt: 'json',
            limit: limit.toString(),
            offset: offset.toString(),
          },
        },
        43200
      );

      return data.artists;
    } catch (e) {
      throw new Error(
        `[MusicBrainz] Failed to search artists: ${
          e instanceof Error ? e.message : 'Unknown error'
        }`
      );
    }
  }

  public async searchReleaseGroupsByTag({
    tags,
    primaryTypes,
    releaseDateGte,
    releaseDateLte,
    limit = 25,
    offset = 0,
  }: {
    tags: string[];
    primaryTypes?: string[];
    releaseDateGte?: string;
    releaseDateLte?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ releaseGroups: MbAlbumDetails[]; totalCount: number }> {
    try {
      // Build MusicBrainz Lucene query
      const tagQuery = tags.map((t) => `tag:"${escapeLucene(t)}"`).join(' OR ');
      let query = `(${tagQuery})`;

      if (primaryTypes && primaryTypes.length > 0) {
        const typeQuery = primaryTypes
          .map((t) => `primarytype:"${escapeLucene(t)}"`)
          .join(' OR ');
        query += ` AND (${typeQuery})`;
      }

      if (releaseDateGte || releaseDateLte) {
        const datePattern = /^\d{4}(-\d{2}(-\d{2})?)?$/;
        const from =
          releaseDateGte && datePattern.test(releaseDateGte)
            ? releaseDateGte
            : '*';
        const to =
          releaseDateLte && datePattern.test(releaseDateLte)
            ? releaseDateLte
            : '*';
        query += ` AND firstreleasedate:[${from} TO ${to}]`;
      }

      query += ' AND status:"official"';

      const data = await this.get<{
        created: string;
        count: number;
        offset: number;
        'release-groups': MbAlbumDetails[];
      }>(
        '/release-group',
        {
          params: {
            query,
            fmt: 'json',
            limit: limit.toString(),
            offset: offset.toString(),
          },
        },
        43200
      );

      return {
        releaseGroups: data['release-groups'],
        totalCount: data.count,
      };
    } catch (e) {
      throw new Error(
        `[MusicBrainz] Failed to search release groups by tag: ${
          e instanceof Error ? e.message : 'Unknown error'
        }`
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
    if (
      !artistMbid ||
      typeof artistMbid !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        artistMbid
      )
    ) {
      throw new Error('Invalid MusicBrainz artist ID format');
    }

    try {
      const safeUrl = `https://musicbrainz.org/artist/${artistMbid}/wikipedia-extract`;

      const response = await axios.get(safeUrl, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': language,
          'User-Agent': 'Seerr/1.0.0 (https://github.com/seerr-team/seerr)',
        },
      });

      const data = response.data;
      if (!data.wikipediaExtract || !data.wikipediaExtract.content) {
        return null;
      }

      const cleanContent = purify.sanitize(data.wikipediaExtract.content, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });

      return {
        title: data.wikipediaExtract.title,
        url: data.wikipediaExtract.url,
        content: cleanContent.trim(),
      };
    } catch (error) {
      throw new Error(
        `[MusicBrainz] Failed to fetch Wikipedia extract: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
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
        'release-group': {
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
        43200
      );

      return data['release-group']?.id ?? null;
    } catch (e) {
      throw new Error(
        `[MusicBrainz] Failed to fetch release group: ${
          e instanceof Error ? e.message : 'Unknown error'
        }`
      );
    }
  }
}

export default MusicBrainz;
