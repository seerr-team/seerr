import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import {
  BlocklistedMediaError,
  DuplicateMediaRequestError,
  MediaRequest,
  NoSeasonsAvailableError,
  QuotaRestrictedError,
  RequestPermissionError,
} from '@server/entity/MediaRequest';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import {
  checkPermission,
  permissionDenied,
  resolveUser,
} from '@server/mcp/auth';
import { z } from 'zod';

export function registerRequestTools(server: McpServer): void {
  server.registerTool(
    'create_request',
    {
      title: 'Create Media Request',
      description:
        'Submit a new media request for a movie or TV show. For TV, you can specify which seasons to request.',
      inputSchema: {
        mediaType: z.enum(['movie', 'tv']).describe('Type of media to request'),
        mediaId: z.number().describe('TMDB ID of the media'),
        tvdbId: z.number().optional().describe('TVDB ID (optional, for TV)'),
        seasons: z
          .union([z.array(z.number()), z.literal('all')])
          .optional()
          .describe(
            'Season numbers to request, or "all" for all seasons (TV only)'
          ),
        is4k: z.boolean().optional().describe('Whether to request 4K version'),
        serverId: z
          .number()
          .optional()
          .describe('Radarr/Sonarr server ID to use'),
        profileId: z.number().optional().describe('Quality profile ID'),
        rootFolder: z.string().optional().describe('Root folder path override'),
        tags: z.array(z.number()).optional().describe('Tag IDs to apply'),
      },
    },
    async (params) => {
      try {
        const user = await resolveUser();
        if (!user) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Failed to resolve user for request creation.',
              },
            ],
            isError: true,
          };
        }

        const request = await MediaRequest.request(
          {
            mediaType: params.mediaType as MediaType,
            mediaId: params.mediaId,
            tvdbId: params.tvdbId,
            seasons: params.seasons,
            is4k: params.is4k,
            serverId: params.serverId,
            profileId: params.profileId,
            rootFolder: params.rootFolder,
            tags: params.tags,
          },
          user
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(request, null, 2),
            },
          ],
        };
      } catch (error) {
        const err = error as Error;
        let errorType = 'error';

        if (
          err instanceof RequestPermissionError ||
          err instanceof QuotaRestrictedError
        ) {
          errorType = 'permission';
        } else if (err instanceof DuplicateMediaRequestError) {
          errorType = 'duplicate';
        } else if (err instanceof NoSeasonsAvailableError) {
          errorType = 'no_seasons';
        } else if (err instanceof BlocklistedMediaError) {
          errorType = 'blocklisted';
        }

        logger.error('MCP create_request failed', {
          label: 'MCP',
          errorMessage: err.message,
          errorType,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Request failed (${errorType}): ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'list_requests',
    {
      title: 'List Media Requests',
      description: 'List media requests with pagination and filtering options.',
      inputSchema: {
        take: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Number of results per page (default: 10, max: 100)'),
        skip: z
          .number()
          .min(0)
          .optional()
          .describe('Number of results to skip'),
        filter: z
          .enum([
            'all',
            'pending',
            'approved',
            'processing',
            'failed',
            'available',
            'unavailable',
            'completed',
            'deleted',
          ])
          .optional()
          .describe('Filter requests by status'),
        sort: z.enum(['id', 'modified']).optional().describe('Sort field'),
        sortDirection: z
          .enum(['asc', 'desc'])
          .optional()
          .describe('Sort direction'),
        mediaType: z
          .enum(['all', 'movie', 'tv'])
          .optional()
          .describe('Filter by media type'),
        requestedBy: z
          .number()
          .optional()
          .describe('Filter by user ID who made the request'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params) => {
      try {
        const pageSize = params.take ?? 10;
        const skip = params.skip ?? 0;
        const mediaType = params.mediaType ?? 'all';

        let statusFilter: MediaRequestStatus[];
        switch (params.filter) {
          case 'approved':
          case 'processing':
            statusFilter = [MediaRequestStatus.APPROVED];
            break;
          case 'pending':
            statusFilter = [MediaRequestStatus.PENDING];
            break;
          case 'unavailable':
            statusFilter = [
              MediaRequestStatus.PENDING,
              MediaRequestStatus.APPROVED,
            ];
            break;
          case 'failed':
            statusFilter = [MediaRequestStatus.FAILED];
            break;
          case 'completed':
          case 'available':
          case 'deleted':
            statusFilter = [MediaRequestStatus.COMPLETED];
            break;
          default:
            statusFilter = [
              MediaRequestStatus.PENDING,
              MediaRequestStatus.APPROVED,
              MediaRequestStatus.DECLINED,
              MediaRequestStatus.FAILED,
              MediaRequestStatus.COMPLETED,
            ];
        }

        let mediaStatusFilter: MediaStatus[];
        switch (params.filter) {
          case 'available':
            mediaStatusFilter = [MediaStatus.AVAILABLE];
            break;
          case 'processing':
          case 'unavailable':
            mediaStatusFilter = [
              MediaStatus.UNKNOWN,
              MediaStatus.PENDING,
              MediaStatus.PROCESSING,
              MediaStatus.PARTIALLY_AVAILABLE,
            ];
            break;
          case 'deleted':
            mediaStatusFilter = [MediaStatus.DELETED];
            break;
          default:
            mediaStatusFilter = [
              MediaStatus.UNKNOWN,
              MediaStatus.PENDING,
              MediaStatus.PROCESSING,
              MediaStatus.PARTIALLY_AVAILABLE,
              MediaStatus.AVAILABLE,
              MediaStatus.DELETED,
            ];
        }

        const sortFilter =
          params.sort === 'modified' ? 'request.updatedAt' : 'request.id';
        const sortDirection = params.sortDirection === 'asc' ? 'ASC' : 'DESC';

        let query = getRepository(MediaRequest)
          .createQueryBuilder('request')
          .leftJoinAndSelect('request.media', 'media')
          .leftJoinAndSelect('request.seasons', 'seasons')
          .leftJoinAndSelect('request.modifiedBy', 'modifiedBy')
          .leftJoinAndSelect('request.requestedBy', 'requestedBy')
          .where('request.status IN (:...requestStatus)', {
            requestStatus: statusFilter,
          })
          .andWhere(
            '((request.is4k = false AND media.status IN (:...mediaStatus)) OR (request.is4k = true AND media.status4k IN (:...mediaStatus)))',
            { mediaStatus: mediaStatusFilter }
          );

        if (params.requestedBy) {
          query = query.andWhere('requestedBy.id = :id', {
            id: params.requestedBy,
          });
        }

        switch (mediaType) {
          case 'movie':
            query = query.andWhere('request.type = :type', {
              type: MediaType.MOVIE,
            });
            break;
          case 'tv':
            query = query.andWhere('request.type = :type', {
              type: MediaType.TV,
            });
            break;
        }

        const [requests, requestCount] = await query
          .orderBy(sortFilter, sortDirection as 'ASC' | 'DESC')
          .take(pageSize)
          .skip(skip)
          .getManyAndCount();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  pageInfo: {
                    pages: Math.ceil(requestCount / pageSize),
                    pageSize,
                    results: requestCount,
                    page: Math.ceil(skip / pageSize) + 1,
                  },
                  results: requests,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP list_requests failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `List requests failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_request',
    {
      title: 'Get Media Request',
      description: 'Get details of a specific media request by its ID.',
      inputSchema: {
        requestId: z.number().describe('The request ID'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ requestId }) => {
      try {
        const requestRepository = getRepository(MediaRequest);
        const request = await requestRepository.findOneOrFail({
          where: { id: requestId },
          relations: { requestedBy: true, modifiedBy: true },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(request, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_request failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Request not found: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'approve_request',
    {
      title: 'Approve Media Request',
      description:
        'Approve a pending media request. Requires MANAGE_REQUESTS permission.',
      inputSchema: {
        requestId: z.number().describe('The request ID to approve'),
      },
    },
    async ({ requestId }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.MANAGE_REQUESTS)) {
          return permissionDenied('MANAGE_REQUESTS');
        }

        const requestRepository = getRepository(MediaRequest);

        const request = await requestRepository.findOneOrFail({
          where: { id: requestId },
          relations: { requestedBy: true, modifiedBy: true },
        });

        request.status = MediaRequestStatus.APPROVED;
        request.modifiedBy = user ?? undefined;
        await requestRepository.save(request);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(request, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP approve_request failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Approve request failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'decline_request',
    {
      title: 'Decline Media Request',
      description:
        'Decline a pending media request. Requires MANAGE_REQUESTS permission.',
      inputSchema: {
        requestId: z.number().describe('The request ID to decline'),
      },
    },
    async ({ requestId }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.MANAGE_REQUESTS)) {
          return permissionDenied('MANAGE_REQUESTS');
        }

        const requestRepository = getRepository(MediaRequest);

        const request = await requestRepository.findOneOrFail({
          where: { id: requestId },
          relations: { requestedBy: true, modifiedBy: true },
        });

        request.status = MediaRequestStatus.DECLINED;
        request.modifiedBy = user ?? undefined;
        await requestRepository.save(request);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(request, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP decline_request failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Decline request failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'retry_request',
    {
      title: 'Retry Failed Request',
      description:
        'Retry a failed media request. Re-sends to Radarr/Sonarr. Requires MANAGE_REQUESTS permission.',
      inputSchema: {
        requestId: z.number().describe('The request ID to retry'),
      },
    },
    async ({ requestId }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.MANAGE_REQUESTS)) {
          return permissionDenied('MANAGE_REQUESTS');
        }

        const requestRepository = getRepository(MediaRequest);

        const request = await requestRepository.findOneOrFail({
          where: { id: requestId },
          relations: { requestedBy: true, modifiedBy: true },
        });

        request.status = MediaRequestStatus.APPROVED;
        await requestRepository.save(request);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(request, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP retry_request failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Retry request failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_request_count',
    {
      title: 'Get Request Counts',
      description:
        'Get aggregate request statistics (total, by type, by status).',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const requestRepository = getRepository(MediaRequest);

        const query = requestRepository
          .createQueryBuilder('request')
          .innerJoinAndSelect('request.media', 'media');

        const totalCount = await query.getCount();

        const movieCount = await query
          .where('request.type = :requestType', {
            requestType: MediaType.MOVIE,
          })
          .getCount();

        const tvCount = await query
          .where('request.type = :requestType', {
            requestType: MediaType.TV,
          })
          .getCount();

        const pendingCount = await query
          .where('request.status = :requestStatus', {
            requestStatus: MediaRequestStatus.PENDING,
          })
          .getCount();

        const approvedCount = await query
          .where('request.status = :requestStatus', {
            requestStatus: MediaRequestStatus.APPROVED,
          })
          .getCount();

        const declinedCount = await query
          .where('request.status = :requestStatus', {
            requestStatus: MediaRequestStatus.DECLINED,
          })
          .getCount();

        const processingCount = await query
          .where('request.status = :requestStatus', {
            requestStatus: MediaRequestStatus.APPROVED,
          })
          .andWhere(
            '((request.is4k = false AND media.status != :availableStatus) OR (request.is4k = true AND media.status4k != :availableStatus))',
            { availableStatus: MediaStatus.AVAILABLE }
          )
          .getCount();

        const availableCount = await query
          .where('request.status = :requestStatus', {
            requestStatus: MediaRequestStatus.APPROVED,
          })
          .andWhere(
            '((request.is4k = false AND media.status = :availableStatus) OR (request.is4k = true AND media.status4k = :availableStatus))',
            { availableStatus: MediaStatus.AVAILABLE }
          )
          .getCount();

        const completedCount = await query
          .where('request.status = :requestStatus', {
            requestStatus: MediaRequestStatus.COMPLETED,
          })
          .getCount();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  total: totalCount,
                  movie: movieCount,
                  tv: tvCount,
                  pending: pendingCount,
                  approved: approvedCount,
                  declined: declinedCount,
                  processing: processingCount,
                  available: availableCount,
                  completed: completedCount,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_request_count failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Get request counts failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
