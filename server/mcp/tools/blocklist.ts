import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import Media from '@server/entity/Media';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import {
  checkPermission,
  permissionDenied,
  resolveUser,
} from '@server/mcp/auth';
import { z } from 'zod';

export function registerBlocklistTools(server: McpServer): void {
  server.registerTool(
    'add_to_blocklist',
    {
      title: 'Add to Blocklist',
      description:
        'Add a media item to the blocklist. Requires MANAGE_BLOCKLIST permission.',
      inputSchema: {
        tmdbId: z.number().describe('TMDB ID of the media'),
        mediaType: z.enum(['movie', 'tv']).describe('Type of media'),
        title: z.string().optional().describe('Title of the media (optional)'),
      },
    },
    async ({ tmdbId, mediaType, title }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.MANAGE_BLOCKLIST)) {
          return permissionDenied('MANAGE_BLOCKLIST');
        }

        await Blocklist.addToBlocklist({
          blocklistRequest: {
            tmdbId,
            mediaType: mediaType as MediaType,
            title,
          },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Added TMDB ID ${tmdbId} (${mediaType}) to blocklist.`,
            },
          ],
        };
      } catch (e) {
        logger.error('MCP add_to_blocklist failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Add to blocklist failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'remove_from_blocklist',
    {
      title: 'Remove from Blocklist',
      description:
        'Remove a media item from the blocklist. Also removes the associated media tracking. Requires MANAGE_BLOCKLIST permission.',
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
        if (!user || !checkPermission(user, Permission.MANAGE_BLOCKLIST)) {
          return permissionDenied('MANAGE_BLOCKLIST');
        }

        const blocklistRepository = getRepository(Blocklist);
        const blocklistItem = await blocklistRepository.findOneOrFail({
          where: { tmdbId },
        });

        await blocklistRepository.remove(blocklistItem);

        const mediaRepository = getRepository(Media);
        try {
          const mediaItem = await mediaRepository.findOneOrFail({
            where: { tmdbId },
          });
          await mediaRepository.remove(mediaItem);
        } catch {
          // Media item may not exist, that's fine
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Removed TMDB ID ${tmdbId} from blocklist.`,
            },
          ],
        };
      } catch (e) {
        logger.error('MCP remove_from_blocklist failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Remove from blocklist failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_blocklist',
    {
      title: 'Get Blocklist',
      description:
        'Get blocklisted media items with pagination, search, and filtering.',
      inputSchema: {
        take: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Number of results per page (default: 25, max: 100)'),
        skip: z
          .number()
          .min(0)
          .optional()
          .describe('Number of results to skip'),
        search: z.string().max(200).optional().describe('Search by title'),
        filter: z
          .enum(['all', 'manual', 'blocklistedTags'])
          .optional()
          .describe(
            'Filter type: all, manual entries only, or tag-based entries'
          ),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params) => {
      try {
        const user = await resolveUser();
        if (
          !user ||
          !checkPermission(
            user,
            [Permission.MANAGE_BLOCKLIST, Permission.VIEW_BLOCKLIST],
            { type: 'or' }
          )
        ) {
          return permissionDenied('MANAGE_BLOCKLIST or VIEW_BLOCKLIST');
        }

        const take = params.take ?? 25;
        const skip = params.skip ?? 0;

        let query = getRepository(Blocklist)
          .createQueryBuilder('blocklist')
          .leftJoinAndSelect('blocklist.user', 'user')
          .where('1 = 1');

        switch (params.filter) {
          case 'manual':
            query = query.andWhere('blocklist.blocklistedTags IS NULL');
            break;
          case 'blocklistedTags':
            query = query.andWhere('blocklist.blocklistedTags IS NOT NULL');
            break;
        }

        if (params.search) {
          query = query.andWhere('blocklist.title like :title', {
            title: `%${params.search}%`,
          });
        }

        const [blocklistedItems, itemsCount] = await query
          .orderBy('blocklist.createdAt', 'DESC')
          .take(take)
          .skip(skip)
          .getManyAndCount();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  pageInfo: {
                    pages: Math.ceil(itemsCount / take),
                    pageSize: take,
                    results: itemsCount,
                    page: Math.ceil(skip / take) + 1,
                  },
                  results: blocklistedItems,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_blocklist failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Get blocklist failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
