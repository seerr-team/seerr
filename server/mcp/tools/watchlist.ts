import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import PlexTvAPI from '@server/api/plextv';
import type { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import {
  DuplicateWatchlistRequestError,
  Watchlist,
} from '@server/entity/Watchlist';
import logger from '@server/logger';
import { resolveUser } from '@server/mcp/auth';
import { z } from 'zod';

export function registerWatchlistTools(server: McpServer): void {
  server.registerTool(
    'add_to_watchlist',
    {
      title: 'Add to Watchlist',
      description: 'Add a movie or TV show to the watchlist.',
      inputSchema: {
        tmdbId: z.number().describe('TMDB ID of the media'),
        mediaType: z.enum(['movie', 'tv']).describe('Type of media'),
        title: z.string().optional().describe('Title of the media (optional)'),
      },
    },
    async ({ tmdbId, mediaType, title }) => {
      try {
        const user = await resolveUser();
        if (!user) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Failed to resolve user for watchlist operation.',
              },
            ],
            isError: true,
          };
        }

        const result = await Watchlist.createWatchlist({
          watchlistRequest: {
            tmdbId,
            mediaType: mediaType as MediaType,
            title,
          },
          user,
        });

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        const err = error as Error;
        if (err instanceof DuplicateWatchlistRequestError) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Already on watchlist: ${err.message}`,
              },
            ],
            isError: true,
          };
        }
        logger.error('MCP add_to_watchlist failed', {
          label: 'MCP',
          errorMessage: err.message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Add to watchlist failed: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'remove_from_watchlist',
    {
      title: 'Remove from Watchlist',
      description: 'Remove a media item from the watchlist.',
      inputSchema: {
        tmdbId: z.number().describe('TMDB ID of the media to remove'),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ tmdbId }) => {
      try {
        const user = await resolveUser();
        if (!user) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Failed to resolve user for watchlist operation.',
              },
            ],
            isError: true,
          };
        }

        await Watchlist.deleteWatchlist(tmdbId, user);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Removed TMDB ID ${tmdbId} from watchlist.`,
            },
          ],
        };
      } catch (e) {
        logger.error('MCP remove_from_watchlist failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Remove from watchlist failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_watchlist',
    {
      title: 'Get Watchlist',
      description: 'Get the current watchlist with pagination.',
      inputSchema: {
        page: z.number().optional().describe('Page number (default: 1)'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ page }) => {
      try {
        const currentPage = page ?? 1;
        const itemsPerPage = 20;
        const offset = (currentPage - 1) * itemsPerPage;

        const user = await resolveUser();
        if (!user) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Failed to resolve user for watchlist operation.',
              },
            ],
            isError: true,
          };
        }

        const activeUser = await getRepository(User).findOne({
          where: { id: user.id },
          select: ['id', 'plexToken'],
        });

        if (activeUser && !activeUser.plexToken) {
          const [result, total] = await getRepository(Watchlist).findAndCount({
            where: { requestedBy: { id: activeUser.id } },
            take: itemsPerPage,
            skip: offset,
          });

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    page: currentPage,
                    totalPages: Math.ceil(total / itemsPerPage),
                    totalResults: total,
                    results: result,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (!activeUser?.plexToken) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  page: 1,
                  totalPages: 1,
                  totalResults: 0,
                  results: [],
                }),
              },
            ],
          };
        }

        const plexTV = new PlexTvAPI(activeUser.plexToken);
        const watchlist = await plexTV.getWatchlist({ offset });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  page: currentPage,
                  totalPages: Math.ceil(watchlist.totalSize / itemsPerPage),
                  totalResults: watchlist.totalSize,
                  results: watchlist.items.map((item) => ({
                    id: item.tmdbId,
                    ratingKey: item.ratingKey,
                    title: item.title,
                    mediaType: item.type === 'show' ? 'tv' : 'movie',
                    tmdbId: item.tmdbId,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_watchlist failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Get watchlist failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
