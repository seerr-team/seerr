import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import TheMovieDb from '@server/api/themoviedb';
import Media from '@server/entity/Media';
import { findSearchProvider } from '@server/lib/search';
import logger from '@server/logger';
import { mapSearchResults } from '@server/models/Search';
import { z } from 'zod';

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    'search_media',
    {
      title: 'Search Media',
      description:
        'Search for movies, TV shows, and people. Supports special prefixes: "tmdb:<id>", "imdb:<id>", "tvdb:<id>", "year:<yyyy> <query>".',
      inputSchema: {
        query: z.string().min(1).describe('Search query text'),
        page: z.number().min(1).optional().describe('Page number (default: 1)'),
        language: z.string().optional().describe('ISO 639-1 language code'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ query, page, language }) => {
      try {
        const searchProvider = findSearchProvider(query.toLowerCase());
        let results;

        if (searchProvider) {
          const [id] = query
            .toLowerCase()
            .match(searchProvider.pattern) as RegExpMatchArray;
          results = await searchProvider.search({ id, language, query });
        } else {
          const tmdb = new TheMovieDb();
          results = await tmdb.searchMulti({
            query,
            page: page ?? 1,
            language,
          });
        }

        const media = await Media.getRelatedMedia(
          undefined,
          results.results.map((result) => result.id)
        );

        const mapped = mapSearchResults(results.results, media);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  page: results.page,
                  totalPages: results.total_pages,
                  totalResults: results.total_results,
                  results: mapped,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP search_media failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Search failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'search_keyword',
    {
      title: 'Search Keywords',
      description: 'Search for TMDB keywords by name.',
      inputSchema: {
        query: z.string().describe('Keyword search query'),
        page: z.number().optional().describe('Page number (default: 1)'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ query, page }) => {
      try {
        const tmdb = new TheMovieDb();
        const results = await tmdb.searchKeyword({
          query,
          page: page ?? 1,
        });

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(results, null, 2) },
          ],
        };
      } catch (e) {
        logger.error('MCP search_keyword failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Keyword search failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'search_company',
    {
      title: 'Search Companies',
      description: 'Search for production companies by name.',
      inputSchema: {
        query: z.string().describe('Company name search query'),
        page: z.number().optional().describe('Page number (default: 1)'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ query, page }) => {
      try {
        const tmdb = new TheMovieDb();
        const results = await tmdb.searchCompany({
          query,
          page: page ?? 1,
        });

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(results, null, 2) },
          ],
        };
      } catch (e) {
        logger.error('MCP search_company failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Company search failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
