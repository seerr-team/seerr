import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import TautulliAPI from '@server/api/tautulli';
import { MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import {
  checkPermission,
  permissionDenied,
  resolveUser,
} from '@server/mcp/auth';
import type { FindOneOptions } from 'typeorm';
import { In } from 'typeorm';
import { z } from 'zod';

export function registerMediaTools(server: McpServer): void {
  server.registerTool(
    'list_media',
    {
      title: 'List Media',
      description:
        'List tracked media items with pagination and status filtering.',
      inputSchema: {
        take: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Number of results per page (default: 20, max: 100)'),
        skip: z
          .number()
          .min(0)
          .optional()
          .describe('Number of results to skip'),
        filter: z
          .enum([
            'available',
            'partial',
            'processing',
            'pending',
            'allavailable',
          ])
          .optional()
          .describe('Filter by media status'),
        sort: z
          .enum(['id', 'modified', 'mediaAdded'])
          .optional()
          .describe('Sort field'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params) => {
      try {
        const mediaRepository = getRepository(Media);
        const pageSize = params.take ?? 20;
        const skip = params.skip ?? 0;

        let statusFilter = undefined;
        switch (params.filter) {
          case 'available':
            statusFilter = MediaStatus.AVAILABLE;
            break;
          case 'partial':
            statusFilter = MediaStatus.PARTIALLY_AVAILABLE;
            break;
          case 'allavailable':
            statusFilter = In([
              MediaStatus.AVAILABLE,
              MediaStatus.PARTIALLY_AVAILABLE,
            ]);
            break;
          case 'processing':
            statusFilter = MediaStatus.PROCESSING;
            break;
          case 'pending':
            statusFilter = MediaStatus.PENDING;
            break;
        }

        let sortFilter: FindOneOptions<Media>['order'] = { id: 'DESC' };
        switch (params.sort) {
          case 'modified':
            sortFilter = { updatedAt: 'DESC' };
            break;
          case 'mediaAdded':
            sortFilter = { mediaAddedAt: 'DESC' };
            break;
        }

        const [media, mediaCount] = await mediaRepository.findAndCount({
          order: sortFilter,
          where: statusFilter ? { status: statusFilter } : undefined,
          take: pageSize,
          skip,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  pageInfo: {
                    pages: Math.ceil(mediaCount / pageSize),
                    pageSize,
                    results: mediaCount,
                    page: Math.ceil(skip / pageSize) + 1,
                  },
                  results: media,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP list_media failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `List media failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_media',
    {
      title: 'Get Media Item',
      description: 'Get a single tracked media item by its internal ID.',
      inputSchema: {
        mediaId: z.number().describe('Internal media ID'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ mediaId }) => {
      try {
        const mediaRepository = getRepository(Media);
        const media = await mediaRepository.findOneOrFail({
          where: { id: mediaId },
        });

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(media, null, 2) },
          ],
        };
      } catch (e) {
        logger.error('MCP get_media failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Media not found: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'update_media_status',
    {
      title: 'Update Media Status',
      description:
        'Change the availability status of a media item. Requires MANAGE_REQUESTS permission.',
      inputSchema: {
        mediaId: z.number().describe('Internal media ID'),
        status: z
          .enum(['available', 'partial', 'processing', 'pending', 'unknown'])
          .describe('New status to set'),
        is4k: z
          .boolean()
          .optional()
          .describe('Whether to update the 4K status (default: false)'),
      },
    },
    async ({ mediaId, status, is4k }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.MANAGE_REQUESTS)) {
          return permissionDenied('MANAGE_REQUESTS');
        }

        const mediaRepository = getRepository(Media);
        const media = await mediaRepository.findOneOrFail({
          where: { id: mediaId },
        });

        const use4k = is4k ?? false;
        const statusKey = use4k ? 'status4k' : 'status';

        switch (status) {
          case 'available':
            media[statusKey] = MediaStatus.AVAILABLE;
            break;
          case 'partial':
            media[statusKey] = MediaStatus.PARTIALLY_AVAILABLE;
            break;
          case 'processing':
            media[statusKey] = MediaStatus.PROCESSING;
            break;
          case 'pending':
            media[statusKey] = MediaStatus.PENDING;
            break;
          case 'unknown':
            media[statusKey] = MediaStatus.UNKNOWN;
            break;
        }

        await mediaRepository.save(media);

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(media, null, 2) },
          ],
        };
      } catch (e) {
        logger.error('MCP update_media_status failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Update media status failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'delete_media',
    {
      title: 'Delete Media',
      description:
        'Remove a media item from tracking. Requires MANAGE_REQUESTS permission.',
      inputSchema: {
        mediaId: z.number().describe('Internal media ID'),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ mediaId }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.MANAGE_REQUESTS)) {
          return permissionDenied('MANAGE_REQUESTS');
        }

        const mediaRepository = getRepository(Media);
        const media = await mediaRepository.findOneOrFail({
          where: { id: mediaId },
        });

        await mediaRepository.remove(media);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Media item ${mediaId} has been deleted.`,
            },
          ],
        };
      } catch (e) {
        logger.error('MCP delete_media failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Delete media failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_watch_data',
    {
      title: 'Get Watch Data',
      description:
        'Get Tautulli watch statistics for a media item. Requires ADMIN permission and Tautulli to be configured.',
      inputSchema: {
        mediaId: z.number().describe('Internal media ID'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ mediaId }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.ADMIN)) {
          return permissionDenied('ADMIN');
        }

        const settings = getSettings().tautulli;

        if (!settings.hostname || !settings.port || !settings.apiKey) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Tautulli API is not configured.',
              },
            ],
            isError: true,
          };
        }

        const media = await getRepository(Media).findOne({
          where: { id: mediaId },
        });

        if (!media) {
          return {
            content: [{ type: 'text' as const, text: 'Media not found.' }],
            isError: true,
          };
        }

        const tautulli = new TautulliAPI(settings);
        const userRepository = getRepository(User);
        const response: Record<string, unknown> = {};

        if (media.ratingKey) {
          const watchStats = await tautulli.getMediaWatchStats(media.ratingKey);
          const watchUsers = await tautulli.getMediaWatchUsers(media.ratingKey);

          const users = watchUsers.length
            ? await userRepository
                .createQueryBuilder('user')
                .where('user.plexId IN (:...plexIds)', {
                  plexIds: watchUsers.map((u) => u.user_id),
                })
                .getMany()
            : [];

          response.data = {
            users,
            playCount:
              watchStats.find((i) => i.query_days == 0)?.total_plays ?? 0,
            playCount7Days:
              watchStats.find((i) => i.query_days == 7)?.total_plays ?? 0,
            playCount30Days:
              watchStats.find((i) => i.query_days == 30)?.total_plays ?? 0,
          };
        }

        if (media.ratingKey4k) {
          const watchStats4k = await tautulli.getMediaWatchStats(
            media.ratingKey4k
          );
          const watchUsers4k = await tautulli.getMediaWatchUsers(
            media.ratingKey4k
          );

          const users = watchUsers4k.length
            ? await userRepository
                .createQueryBuilder('user')
                .where('user.plexId IN (:...plexIds)', {
                  plexIds: watchUsers4k.map((u) => u.user_id),
                })
                .getMany()
            : [];

          response.data4k = {
            users,
            playCount:
              watchStats4k.find((i) => i.query_days == 0)?.total_plays ?? 0,
            playCount7Days:
              watchStats4k.find((i) => i.query_days == 7)?.total_plays ?? 0,
            playCount30Days:
              watchStats4k.find((i) => i.query_days == 30)?.total_plays ?? 0,
          };
        }

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(response, null, 2) },
          ],
        };
      } catch (e) {
        logger.error('MCP get_watch_data failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Get watch data failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
