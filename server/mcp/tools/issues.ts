import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IssueStatus, IssueType } from '@server/constants/issue';
import { getRepository } from '@server/datasource';
import Issue from '@server/entity/Issue';
import IssueComment from '@server/entity/IssueComment';
import Media from '@server/entity/Media';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import {
  checkPermission,
  permissionDenied,
  resolveUser,
} from '@server/mcp/auth';
import { z } from 'zod';

export function registerIssueTools(server: McpServer): void {
  server.registerTool(
    'create_issue',
    {
      title: 'Create Issue',
      description:
        'Report an issue with a media item (video, audio, subtitles, or other problems).',
      inputSchema: {
        mediaId: z.number().describe('Internal media ID'),
        issueType: z
          .enum(['video', 'audio', 'subtitles', 'other'])
          .describe('Type of issue'),
        message: z.string().min(1).describe('Description of the issue'),
        problemSeason: z
          .number()
          .optional()
          .describe('Season number with the problem (TV only)'),
        problemEpisode: z
          .number()
          .optional()
          .describe('Episode number with the problem (TV only)'),
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
                text: 'Failed to resolve user for issue creation.',
              },
            ],
            isError: true,
          };
        }

        const mediaRepository = getRepository(Media);
        const media = await mediaRepository.findOne({
          where: { id: params.mediaId },
        });

        if (!media) {
          return {
            content: [{ type: 'text' as const, text: 'Media not found.' }],
            isError: true,
          };
        }

        const issueTypeMap: Record<string, IssueType> = {
          video: IssueType.VIDEO,
          audio: IssueType.AUDIO,
          subtitles: IssueType.SUBTITLES,
          other: IssueType.OTHER,
        };

        const issueRepository = getRepository(Issue);
        const issue = new Issue({
          createdBy: user,
          issueType: issueTypeMap[params.issueType],
          problemSeason: params.problemSeason ?? 0,
          problemEpisode: params.problemEpisode ?? 0,
          media,
          comments: [
            new IssueComment({
              user,
              message: params.message,
            }),
          ],
        });

        const newIssue = await issueRepository.save(issue);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(newIssue, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP create_issue failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Create issue failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'list_issues',
    {
      title: 'List Issues',
      description: 'List reported issues with pagination and filtering.',
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
          .enum(['all', 'open', 'resolved'])
          .optional()
          .describe('Filter by issue status'),
        sort: z.enum(['created', 'modified']).optional().describe('Sort field'),
        createdBy: z
          .number()
          .optional()
          .describe('Filter by user ID who created the issue'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params) => {
      try {
        const pageSize = params.take ?? 10;
        const skip = params.skip ?? 0;

        const sortFilter =
          params.sort === 'modified' ? 'issue.updatedAt' : 'issue.createdAt';

        let statusFilter: IssueStatus[];
        switch (params.filter) {
          case 'open':
            statusFilter = [IssueStatus.OPEN];
            break;
          case 'resolved':
            statusFilter = [IssueStatus.RESOLVED];
            break;
          default:
            statusFilter = [IssueStatus.OPEN, IssueStatus.RESOLVED];
        }

        let query = getRepository(Issue)
          .createQueryBuilder('issue')
          .leftJoinAndSelect('issue.createdBy', 'createdBy')
          .leftJoinAndSelect('issue.media', 'media')
          .leftJoinAndSelect('issue.modifiedBy', 'modifiedBy')
          .leftJoinAndSelect('issue.comments', 'comments')
          .where('issue.status IN (:...issueStatus)', {
            issueStatus: statusFilter,
          });

        if (params.createdBy) {
          query = query.andWhere('createdBy.id = :id', {
            id: params.createdBy,
          });
        }

        const [issues, issueCount] = await query
          .orderBy(sortFilter, 'DESC')
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
                    pages: Math.ceil(issueCount / pageSize),
                    pageSize,
                    results: issueCount,
                    page: Math.ceil(skip / pageSize) + 1,
                  },
                  results: issues,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP list_issues failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `List issues failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_issue',
    {
      title: 'Get Issue',
      description:
        'Get details of a specific issue by ID, including all comments.',
      inputSchema: {
        issueId: z.number().describe('Issue ID'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ issueId }) => {
      try {
        const issue = await getRepository(Issue)
          .createQueryBuilder('issue')
          .leftJoinAndSelect('issue.comments', 'comments')
          .leftJoinAndSelect('issue.createdBy', 'createdBy')
          .leftJoinAndSelect('comments.user', 'user')
          .leftJoinAndSelect('issue.media', 'media')
          .where('issue.id = :issueId', { issueId })
          .getOneOrFail();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(issue, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_issue failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Issue not found: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'comment_on_issue',
    {
      title: 'Comment on Issue',
      description: 'Add a comment to an existing issue.',
      inputSchema: {
        issueId: z.number().describe('Issue ID'),
        message: z.string().min(1).describe('Comment message'),
      },
    },
    async ({ issueId, message }) => {
      try {
        const user = await resolveUser();
        if (!user) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Failed to resolve user for comment.',
              },
            ],
            isError: true,
          };
        }

        const issueRepository = getRepository(Issue);
        const issue = await issueRepository.findOneOrFail({
          where: { id: issueId },
        });

        const comment = new IssueComment({
          message,
          user,
        });

        issue.comments = [...issue.comments, comment];
        await issueRepository.save(issue);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(issue, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP comment_on_issue failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Comment failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'resolve_issue',
    {
      title: 'Resolve Issue',
      description:
        'Mark an issue as resolved. Requires MANAGE_ISSUES permission.',
      inputSchema: {
        issueId: z.number().describe('Issue ID to resolve'),
      },
    },
    async ({ issueId }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.MANAGE_ISSUES)) {
          return permissionDenied('MANAGE_ISSUES');
        }

        const issueRepository = getRepository(Issue);

        const issue = await issueRepository.findOneOrFail({
          where: { id: issueId },
        });

        issue.status = IssueStatus.RESOLVED;
        issue.modifiedBy = user ?? undefined;
        await issueRepository.save(issue);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(issue, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP resolve_issue failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Resolve issue failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'reopen_issue',
    {
      title: 'Reopen Issue',
      description:
        'Reopen a resolved issue. Requires MANAGE_ISSUES permission.',
      inputSchema: {
        issueId: z.number().describe('Issue ID to reopen'),
      },
    },
    async ({ issueId }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.MANAGE_ISSUES)) {
          return permissionDenied('MANAGE_ISSUES');
        }

        const issueRepository = getRepository(Issue);

        const issue = await issueRepository.findOneOrFail({
          where: { id: issueId },
        });

        issue.status = IssueStatus.OPEN;
        issue.modifiedBy = user ?? undefined;
        await issueRepository.save(issue);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(issue, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP reopen_issue failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Reopen issue failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_issue_count',
    {
      title: 'Get Issue Counts',
      description:
        'Get aggregate issue statistics (total, by type, open/resolved).',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const issueRepository = getRepository(Issue);
        const query = issueRepository.createQueryBuilder('issue');

        const totalCount = await query.getCount();

        const videoCount = await query
          .where('issue.issueType = :issueType', {
            issueType: IssueType.VIDEO,
          })
          .getCount();

        const audioCount = await query
          .where('issue.issueType = :issueType', {
            issueType: IssueType.AUDIO,
          })
          .getCount();

        const subtitlesCount = await query
          .where('issue.issueType = :issueType', {
            issueType: IssueType.SUBTITLES,
          })
          .getCount();

        const othersCount = await query
          .where('issue.issueType = :issueType', {
            issueType: IssueType.OTHER,
          })
          .getCount();

        const openCount = await query
          .where('issue.status = :issueStatus', {
            issueStatus: IssueStatus.OPEN,
          })
          .getCount();

        const closedCount = await query
          .where('issue.status = :issueStatus', {
            issueStatus: IssueStatus.RESOLVED,
          })
          .getCount();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  total: totalCount,
                  video: videoCount,
                  audio: audioCount,
                  subtitles: subtitlesCount,
                  others: othersCount,
                  open: openCount,
                  closed: closedCount,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_issue_count failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Get issue counts failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
