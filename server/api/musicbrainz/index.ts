import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';
import DOMPurify from 'dompurify';
import type {
  MbAlbumDetails,
  MbArtistDetails,
  MbLink,
  MbSearchMultiResponse,
} from './interfaces';

class MusicBrainz extends ExternalAPI {
  constructor() {
    super(
      'https://api.lidarr.audio/api/v0.4',
      {},
      {
        nodeCache: cacheManager.getCache('musicbrainz').data,
        rateLimit: {
          maxRPS: 50,
          id: 'musicbrainz',
        },
      }
    );
  }

  public searchMulti = async ({
    query,
  }: {
    query: string;
  }): Promise<MbSearchMultiResponse[]> => {
    try {
      const data = await this.get<MbSearchMultiResponse[]>('/search', {
        type: 'all',
        query,
      });

      return data.filter(
        (result) => !result.artist || result.artist.type === 'Group'
      );
    } catch (e) {
      return [];
    }
  };

  public async searchArtist({
    query,
  }: {
    query: string;
  }): Promise<MbArtistDetails[]> {
    try {
      const data = await this.get<MbArtistDetails[]>(
        '/search',
        {
          type: 'artist',
          query,
        },
        43200
      );

      return data;
    } catch (e) {
      throw new Error(`[MusicBrainz] Failed to search artists: ${e.message}`);
    }
  }

  public async getAlbum({
    albumId,
  }: {
    albumId?: string;
  }): Promise<MbAlbumDetails> {
    try {
      const data = await this.get<MbAlbumDetails>(
        `/album/${albumId}`,
        {},
        43200
      );

      return data;
    } catch (e) {
      throw new Error(
        `[MusicBrainz] Failed to fetch album details: ${e.message}`
      );
    }
  }

  public async getArtist({
    artistId,
  }: {
    artistId: string;
  }): Promise<MbArtistDetails> {
    try {
      const artistData = await this.get<MbArtistDetails>(
        `/artist/${artistId}`,
        {},
        43200
      );

      return artistData;
    } catch (e) {
      throw new Error(
        `[MusicBrainz] Failed to fetch artist details: ${e.message}`
      );
    }
  }

  private static requestQueue: Promise<void> = Promise.resolve();
  private lastRequestTime = 0;
  private readonly RATE_LIMIT_DELAY = 1100;

  public async getReleaseGroup({
    releaseId,
  }: {
    releaseId: string;
  }): Promise<string | null> {
    try {
      await MusicBrainz.requestQueue;

      MusicBrainz.requestQueue = (async () => {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.RATE_LIMIT_DELAY - timeSinceLastRequest)
          );
        }
        this.lastRequestTime = Date.now();
      })();

      await MusicBrainz.requestQueue;

      const data = await this.getRolling<any>(
        `/release/${releaseId}`,
        {
          inc: 'release-groups',
          fmt: 'json',
        },
        43200,
        {
          headers: {
            'User-Agent':
              'Jellyseerr/1.0.0 (https://github.com/Fallenbagel/jellyseerr; hello@jellyseerr.com)',
            Accept: 'application/json',
          },
        },
        'https://musicbrainz.org/ws/2'
      );

      return data['release-group']?.id || null;
    } catch (e) {
      if (e.message.includes('503')) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.RATE_LIMIT_DELAY * 2)
        );

        await MusicBrainz.requestQueue;
        MusicBrainz.requestQueue = Promise.resolve();
        this.lastRequestTime = Date.now();

        try {
          return await this.getReleaseGroup({ releaseId });
        } catch (retryError) {
          throw new Error(
            `[MusicBrainz] Failed to fetch release group after retry: ${retryError.message}`
          );
        }
      }
      throw new Error(
        `[MusicBrainz] Failed to fetch release group: ${e.message}`
      );
    }
  }

  public async getWikipediaExtract(
    id: string,
    language = 'en',
    type: 'artist' | 'album' = 'album'
  ): Promise<string | null> {
    try {
      const data =
        type === 'album'
          ? await this.get<MbAlbumDetails>(`/album/${id}`, { language }, 43200)
          : await this.get<MbArtistDetails>(
              `/artist/${id}`,
              { language },
              43200
            );

      let targetLinks: MbLink[] | undefined;
      if (type === 'album') {
        const albumData = data as MbAlbumDetails;
        const artistId = albumData.artists?.[0]?.id;
        if (!artistId) return null;

        const artistData = await this.get<MbArtistDetails>(
          `/artist/${artistId}`,
          { language },
          43200
        );
        targetLinks = artistData.links;
      } else {
        const artistData = data as MbArtistDetails;
        targetLinks = artistData.links;
      }

      const wikiLink = targetLinks?.find(
        (l: MbLink) => l.type.toLowerCase() === 'wikidata'
      )?.target;

      if (!wikiLink) return null;

      const wikiId = wikiLink.split('/').pop();
      if (!wikiId) return null;

      interface WikidataResponse {
        entities: {
          [key: string]: {
            sitelinks?: {
              [key: string]: {
                title: string;
              };
            };
          };
        };
      }

      interface WikipediaResponse {
        query: {
          pages: {
            [key: string]: {
              extract: string;
            };
          };
        };
      }

      const wikiResponse = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&ids=${wikiId}&format=json`
      );
      const wikiData = (await wikiResponse.json()) as WikidataResponse;

      const wikipediaTitle =
        wikiData.entities[wikiId]?.sitelinks?.[`${language}wiki`]?.title;
      if (!wikipediaTitle) return null;

      const extractResponse = await fetch(
        `https://${language}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&titles=${encodeURIComponent(
          wikipediaTitle
        )}&format=json&origin=*`
      );
      const extractData = (await extractResponse.json()) as WikipediaResponse;
      const extract = Object.values(extractData.query.pages)[0]?.extract;

      if (!extract) return null;

      const decoded = DOMPurify.sanitize(extract, {
        ALLOWED_TAGS: [], // Strip all HTML tags
        ALLOWED_ATTR: [], // Strip all attributes
      })
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

      return decoded;
    } catch (e) {
      return null;
    }
  }
}

export default MusicBrainz;
