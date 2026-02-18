import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SortOptions } from '@server/api/themoviedb';
import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import {
  mapCollectionResult,
  mapMovieResult,
  mapPersonResult,
  mapTvResult,
} from '@server/models/Search';
import { isCollection, isMovie, isPerson } from '@server/utils/typeHelpers';
import { z } from 'zod';

export function registerDiscoverTools(server: McpServer): void {
  server.registerTool(
    'discover_movies',
    {
      title: 'Discover Movies',
      description:
        'Discover movies with rich filtering options including genre, year, studio, keywords, streaming providers, ratings, and certifications.',
      inputSchema: {
        page: z.number().optional().describe('Page number'),
        sortBy: z
          .string()
          .optional()
          .describe('Sort order (e.g. "popularity.desc", "vote_average.desc")'),
        genre: z.string().optional().describe('Comma-separated genre IDs'),
        studio: z.string().optional().describe('Studio ID'),
        keywords: z.string().optional().describe('Comma-separated keyword IDs'),
        excludeKeywords: z
          .string()
          .optional()
          .describe('Comma-separated keyword IDs to exclude'),
        language: z.string().optional().describe('ISO 639-1 language code'),
        primaryReleaseDateGte: z
          .string()
          .optional()
          .describe('Minimum release date (YYYY-MM-DD)'),
        primaryReleaseDateLte: z
          .string()
          .optional()
          .describe('Maximum release date (YYYY-MM-DD)'),
        voteAverageGte: z.string().optional().describe('Minimum vote average'),
        voteAverageLte: z.string().optional().describe('Maximum vote average'),
        voteCountGte: z.string().optional().describe('Minimum vote count'),
        voteCountLte: z.string().optional().describe('Maximum vote count'),
        withRuntimeGte: z
          .string()
          .optional()
          .describe('Minimum runtime in minutes'),
        withRuntimeLte: z
          .string()
          .optional()
          .describe('Maximum runtime in minutes'),
        watchProviders: z
          .string()
          .optional()
          .describe('Comma-separated watch provider IDs'),
        watchRegion: z
          .string()
          .optional()
          .describe('ISO 3166-1 region code for watch providers'),
        certification: z.string().optional().describe('Exact certification'),
        certificationCountry: z
          .string()
          .optional()
          .describe('Country for certification filter'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params) => {
      try {
        const tmdb = new TheMovieDb();

        const data = await tmdb.getDiscoverMovies({
          page: params.page ?? 1,
          sortBy: params.sortBy as SortOptions,
          language: params.language,
          genre: params.genre,
          studio: params.studio,
          keywords: params.keywords,
          excludeKeywords: params.excludeKeywords,
          primaryReleaseDateGte: params.primaryReleaseDateGte,
          primaryReleaseDateLte: params.primaryReleaseDateLte,
          voteAverageGte: params.voteAverageGte,
          voteAverageLte: params.voteAverageLte,
          voteCountGte: params.voteCountGte,
          voteCountLte: params.voteCountLte,
          withRuntimeGte: params.withRuntimeGte,
          withRuntimeLte: params.withRuntimeLte,
          watchProviders: params.watchProviders,
          watchRegion: params.watchRegion,
          certification: params.certification,
          certificationCountry: params.certificationCountry,
        });

        const media = await Media.getRelatedMedia(
          undefined,
          data.results.map((result) => result.id)
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  page: data.page,
                  totalPages: data.total_pages,
                  totalResults: data.total_results,
                  results: data.results.map((result) =>
                    mapMovieResult(
                      result,
                      media.find(
                        (m) =>
                          m.tmdbId === result.id &&
                          m.mediaType === MediaType.MOVIE
                      )
                    )
                  ),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP discover_movies failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Discover movies failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'discover_tv',
    {
      title: 'Discover TV Shows',
      description:
        'Discover TV shows with rich filtering options including genre, network, air dates, keywords, streaming providers, ratings, and certifications.',
      inputSchema: {
        page: z.number().optional().describe('Page number'),
        sortBy: z
          .string()
          .optional()
          .describe('Sort order (e.g. "popularity.desc", "vote_average.desc")'),
        genre: z.string().optional().describe('Comma-separated genre IDs'),
        network: z.number().optional().describe('Network ID'),
        keywords: z.string().optional().describe('Comma-separated keyword IDs'),
        excludeKeywords: z
          .string()
          .optional()
          .describe('Comma-separated keyword IDs to exclude'),
        language: z.string().optional().describe('ISO 639-1 language code'),
        firstAirDateGte: z
          .string()
          .optional()
          .describe('Minimum first air date (YYYY-MM-DD)'),
        firstAirDateLte: z
          .string()
          .optional()
          .describe('Maximum first air date (YYYY-MM-DD)'),
        voteAverageGte: z.string().optional().describe('Minimum vote average'),
        voteAverageLte: z.string().optional().describe('Maximum vote average'),
        voteCountGte: z.string().optional().describe('Minimum vote count'),
        voteCountLte: z.string().optional().describe('Maximum vote count'),
        withRuntimeGte: z
          .string()
          .optional()
          .describe('Minimum runtime in minutes'),
        withRuntimeLte: z
          .string()
          .optional()
          .describe('Maximum runtime in minutes'),
        watchProviders: z
          .string()
          .optional()
          .describe('Comma-separated watch provider IDs'),
        watchRegion: z
          .string()
          .optional()
          .describe('ISO 3166-1 region code for watch providers'),
        status: z
          .string()
          .optional()
          .describe(
            'Show status filter (e.g. "0" Returning, "1" Planned, "2" In Production, "3" Ended, "4" Cancelled, "5" Pilot)'
          ),
        certification: z.string().optional().describe('Exact certification'),
        certificationCountry: z
          .string()
          .optional()
          .describe('Country for certification filter'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params) => {
      try {
        const tmdb = new TheMovieDb();

        const data = await tmdb.getDiscoverTv({
          page: params.page ?? 1,
          sortBy: params.sortBy as SortOptions,
          language: params.language,
          genre: params.genre,
          network: params.network,
          keywords: params.keywords,
          excludeKeywords: params.excludeKeywords,
          firstAirDateGte: params.firstAirDateGte,
          firstAirDateLte: params.firstAirDateLte,
          voteAverageGte: params.voteAverageGte,
          voteAverageLte: params.voteAverageLte,
          voteCountGte: params.voteCountGte,
          voteCountLte: params.voteCountLte,
          withRuntimeGte: params.withRuntimeGte,
          withRuntimeLte: params.withRuntimeLte,
          watchProviders: params.watchProviders,
          watchRegion: params.watchRegion,
          withStatus: params.status,
          certification: params.certification,
          certificationCountry: params.certificationCountry,
        });

        const media = await Media.getRelatedMedia(
          undefined,
          data.results.map((result) => result.id)
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  page: data.page,
                  totalPages: data.total_pages,
                  totalResults: data.total_results,
                  results: data.results.map((result) =>
                    mapTvResult(
                      result,
                      media.find(
                        (m) =>
                          m.tmdbId === result.id && m.mediaType === MediaType.TV
                      )
                    )
                  ),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP discover_tv failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Discover TV failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'discover_trending',
    {
      title: 'Trending Media',
      description: 'Get trending movies, TV shows, and people.',
      inputSchema: {
        page: z.number().optional().describe('Page number'),
        language: z.string().optional().describe('ISO 639-1 language code'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ page, language }) => {
      try {
        const tmdb = new TheMovieDb();

        const data = await tmdb.getAllTrending({
          page: page ?? 1,
          language,
        });

        const media = await Media.getRelatedMedia(
          undefined,
          data.results.map((result) => result.id)
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  page: data.page,
                  totalPages: data.total_pages,
                  totalResults: data.total_results,
                  results: data.results.map((result) =>
                    isMovie(result)
                      ? mapMovieResult(
                          result,
                          media.find(
                            (m) =>
                              m.tmdbId === result.id &&
                              m.mediaType === MediaType.MOVIE
                          )
                        )
                      : isPerson(result)
                        ? mapPersonResult(result)
                        : isCollection(result)
                          ? mapCollectionResult(result)
                          : mapTvResult(
                              result,
                              media.find(
                                (m) =>
                                  m.tmdbId === result.id &&
                                  m.mediaType === MediaType.TV
                              )
                            )
                  ),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP discover_trending failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Trending failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
