import ExternalAPI from '@server/api/externalapi';
import TheMovieDb from '@server/api/themoviedb';
import { getRepository } from '@server/datasource';
import MetadataArtist from '@server/entity/MetadataArtist';
import cacheManager from '@server/lib/cache';
import logger from '@server/logger';
import { In } from 'typeorm';
import type { TmdbSearchPersonResponse } from './interfaces';

interface SearchPersonOptions {
  query: string;
  page?: number;
  includeAdult?: boolean;
  language?: string;
}

class TmdbPersonMapper extends ExternalAPI {
  private static instance: TmdbPersonMapper;
  private readonly CACHE_TTL = 43200;
  private readonly STALE_THRESHOLD = 30 * 24 * 60 * 60 * 1000;
  private tmdb: TheMovieDb;

  private constructor() {
    super(
      'https://api.themoviedb.org/3',
      {
        api_key: '431a8708161bcd1f1fbe7536137e61ed',
      },
      {
        nodeCache: cacheManager.getCache('tmdb').data,
        rateLimit: {
          maxRPS: 50,
          id: 'tmdb',
        },
      }
    );
    this.tmdb = new TheMovieDb();
  }

  public static getInstance(): TmdbPersonMapper {
    if (!TmdbPersonMapper.instance) {
      TmdbPersonMapper.instance = new TmdbPersonMapper();
    }
    return TmdbPersonMapper.instance;
  }

  private isMetadataStale(metadata: MetadataArtist | null): boolean {
    if (!metadata || !metadata.tmdbUpdatedAt) return true;
    return Date.now() - metadata.tmdbUpdatedAt.getTime() > this.STALE_THRESHOLD;
  }

  private createEmptyResponse() {
    return { personId: null, profilePath: null };
  }

  public async getMappingFromCache(
    artistId: string
  ): Promise<{ personId: number | null; profilePath: string | null } | null> {
    try {
      const metadata = await getRepository(MetadataArtist).findOne({
        where: { mbArtistId: artistId },
        select: ['tmdbPersonId', 'tmdbThumb', 'tmdbUpdatedAt'],
      });

      if (!metadata) {
        return null;
      }

      if (this.isMetadataStale(metadata)) {
        return null;
      }

      return {
        personId: metadata.tmdbPersonId ? Number(metadata.tmdbPersonId) : null,
        profilePath: metadata.tmdbThumb,
      };
    } catch (error) {
      logger.error('Failed to get person mapping from cache', {
        label: 'TmdbPersonMapper',
        artistId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async getMapping(
    artistId: string,
    artistName: string
  ): Promise<{ personId: number | null; profilePath: string | null }> {
    try {
      const metadata = await getRepository(MetadataArtist).findOne({
        where: { mbArtistId: artistId },
        select: ['tmdbPersonId', 'tmdbThumb', 'tmdbUpdatedAt'],
      });

      if (metadata?.tmdbPersonId || metadata?.tmdbThumb) {
        return {
          personId: metadata.tmdbPersonId
            ? Number(metadata.tmdbPersonId)
            : null,
          profilePath: metadata.tmdbThumb,
        };
      }

      if (metadata && !this.isMetadataStale(metadata)) {
        return this.createEmptyResponse();
      }

      return await this.fetchMapping(artistId, artistName);
    } catch (error) {
      logger.error('Failed to get person mapping', {
        label: 'TmdbPersonMapper',
        artistId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createEmptyResponse();
    }
  }

  private async fetchMapping(
    artistId: string,
    artistName: string
  ): Promise<{ personId: number | null; profilePath: string | null }> {
    try {
      const existingMetadata = await getRepository(MetadataArtist).findOne({
        where: { mbArtistId: artistId },
        select: ['tmdbPersonId', 'tmdbThumb', 'tmdbUpdatedAt'],
      });

      if (existingMetadata?.tmdbPersonId) {
        return {
          personId: Number(existingMetadata.tmdbPersonId),
          profilePath: existingMetadata.tmdbThumb,
        };
      }

      const cleanArtistName = artistName
        .split(/(?:(?:feat|ft)\.?\s+|&\s*|,\s+)/i)[0]
        .trim()
        .replace(/['']/g, "'");

      const searchResults = await this.get<TmdbSearchPersonResponse>(
        '/search/person',
        {
          query: cleanArtistName,
          page: '1',
          include_adult: 'false',
          language: 'en',
        },
        this.CACHE_TTL
      );

      const exactMatches = searchResults.results.filter((person) => {
        const normalizedPersonName = person.name
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/['']/g, "'")
          .replace(/[^a-z0-9\s]/g, '')
          .trim();

        const normalizedArtistName = cleanArtistName
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/['']/g, "'")
          .replace(/[^a-z0-9\s]/g, '')
          .trim();

        return normalizedPersonName === normalizedArtistName;
      });

      if (exactMatches.length > 0) {
        const tmdbPersonIds = exactMatches.map((match) => match.id.toString());
        const existingMappings = await getRepository(MetadataArtist).find({
          where: { tmdbPersonId: In(tmdbPersonIds) },
          select: ['mbArtistId', 'tmdbPersonId'],
        });

        const availableMatches = exactMatches.filter(
          (match) =>
            !existingMappings.some(
              (mapping) =>
                mapping.tmdbPersonId === match.id.toString() &&
                mapping.mbArtistId !== artistId
            )
        );

        const soundMatches = availableMatches.filter(
          (person) => person.known_for_department === 'Sound'
        );

        const exactMatch =
          soundMatches.length > 0
            ? soundMatches.reduce((prev, current) =>
                current.popularity > prev.popularity ? current : prev
              )
            : availableMatches.length > 0
            ? availableMatches.reduce((prev, current) =>
                current.popularity > prev.popularity ? current : prev
              )
            : null;

        const mapping = {
          personId: exactMatch?.id ?? null,
          profilePath: exactMatch?.profile_path
            ? `https://image.tmdb.org/t/p/w500${exactMatch.profile_path}`
            : null,
        };

        await getRepository(MetadataArtist)
          .upsert(
            {
              mbArtistId: artistId,
              tmdbPersonId: mapping.personId?.toString() ?? null,
              tmdbThumb: mapping.profilePath,
              tmdbUpdatedAt: new Date(),
            },
            {
              conflictPaths: ['mbArtistId'],
            }
          )
          .catch((e) => {
            logger.error('Failed to save artist metadata', {
              label: 'TmdbPersonMapper',
              error: e instanceof Error ? e.message : 'Unknown error',
            });
          });

        return mapping;
      } else {
        await getRepository(MetadataArtist).upsert(
          {
            mbArtistId: artistId,
            tmdbPersonId: null,
            tmdbThumb: null,
            tmdbUpdatedAt: new Date(),
          },
          {
            conflictPaths: ['mbArtistId'],
          }
        );
        return this.createEmptyResponse();
      }
    } catch (error) {
      await getRepository(MetadataArtist).upsert(
        {
          mbArtistId: artistId,
          tmdbPersonId: null,
          tmdbThumb: null,
          tmdbUpdatedAt: new Date(),
        },
        {
          conflictPaths: ['mbArtistId'],
        }
      );
      return this.createEmptyResponse();
    }
  }

  public async batchGetMappings(
    artists: { artistId: string; artistName: string }[]
  ): Promise<
    Record<string, { personId: number | null; profilePath: string | null }>
  > {
    if (!artists.length) return {};

    const metadataRepository = getRepository(MetadataArtist);
    const artistIds = artists.map((a) => a.artistId);

    const existingMetadata = await metadataRepository.find({
      where: { mbArtistId: In(artistIds) },
      select: ['mbArtistId', 'tmdbPersonId', 'tmdbThumb', 'tmdbUpdatedAt'],
    });

    const results: Record<
      string,
      { personId: number | null; profilePath: string | null }
    > = {};
    const artistsToFetch: { artistId: string; artistName: string }[] = [];

    artists.forEach(({ artistId, artistName }) => {
      const metadata = existingMetadata.find((m) => m.mbArtistId === artistId);

      if (metadata?.tmdbPersonId || metadata?.tmdbThumb) {
        results[artistId] = {
          personId: metadata.tmdbPersonId
            ? Number(metadata.tmdbPersonId)
            : null,
          profilePath: metadata.tmdbThumb,
        };
      } else if (metadata && !this.isMetadataStale(metadata)) {
        results[artistId] = this.createEmptyResponse();
      } else {
        artistsToFetch.push({ artistId, artistName });
      }
    });

    if (artistsToFetch.length > 0) {
      const batchSize = 5;
      for (let i = 0; i < artistsToFetch.length; i += batchSize) {
        const batch = artistsToFetch.slice(i, i + batchSize);
        const batchPromises = batch.map(({ artistId, artistName }) =>
          this.fetchMapping(artistId, artistName)
            .then((mapping) => {
              results[artistId] = mapping;
              return true;
            })
            .catch(() => {
              results[artistId] = this.createEmptyResponse();
              return false;
            })
        );

        await Promise.all(batchPromises);
      }
    }

    return results;
  }

  public async searchPerson(
    options: SearchPersonOptions
  ): Promise<TmdbSearchPersonResponse> {
    try {
      return await this.get<TmdbSearchPersonResponse>(
        '/search/person',
        {
          query: options.query,
          page: options.page?.toString() ?? '1',
          include_adult: options.includeAdult ? 'true' : 'false',
          language: options.language ?? 'en',
        },
        this.CACHE_TTL
      );
    } catch (e) {
      return {
        page: 1,
        results: [],
        total_pages: 1,
        total_results: 0,
      };
    }
  }
}

export default TmdbPersonMapper;
