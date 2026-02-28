import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import {
  checkPermission,
  permissionDenied,
  resolveUser,
} from '@server/mcp/auth';
import gravatarUrl from 'gravatar-url';
import { z } from 'zod';

export function registerUserTools(server: McpServer): void {
  server.registerTool(
    'list_users',
    {
      title: 'List Users',
      description:
        'List all users with pagination, search, and sorting. Requires MANAGE_USERS permission.',
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
        search: z
          .string()
          .max(200)
          .optional()
          .describe('Search by username or email'),
        sort: z
          .enum(['id', 'updated', 'displayname', 'requests'])
          .optional()
          .describe('Sort field'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params) => {
      try {
        const caller = await resolveUser();
        if (!caller || !checkPermission(caller, Permission.MANAGE_USERS)) {
          return permissionDenied('MANAGE_USERS');
        }

        const pageSize = params.take ?? 10;
        const skip = params.skip ?? 0;
        const q = params.search?.toLowerCase() ?? '';

        let query = getRepository(User).createQueryBuilder('user');

        if (q) {
          query = query.where(
            'LOWER(user.username) LIKE :q OR LOWER(user.email) LIKE :q OR LOWER(user.plexUsername) LIKE :q OR LOWER(user.jellyfinUsername) LIKE :q',
            { q: `%${q}%` }
          );
        }

        switch (params.sort) {
          case 'updated':
            query = query.orderBy('user.updatedAt', 'DESC');
            break;
          case 'displayname':
            query = query.orderBy('user.username', 'ASC');
            break;
          case 'requests':
            query = query
              .addSelect((subQuery) => {
                return subQuery
                  .select('COUNT(request.id)', 'request_count')
                  .from(MediaRequest, 'request')
                  .where('request.requestedBy.id = user.id');
              }, 'request_count')
              .orderBy('request_count', 'DESC');
            break;
          default:
            query = query.orderBy('user.id', 'ASC');
            break;
        }

        const [users, userCount] = await query
          .take(pageSize)
          .skip(skip)
          .distinct(true)
          .getManyAndCount();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  pageInfo: {
                    pages: Math.ceil(userCount / pageSize),
                    pageSize,
                    results: userCount,
                    page: Math.ceil(skip / pageSize) + 1,
                  },
                  results: User.filterMany(users, true),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP list_users failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `List users failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_user',
    {
      title: 'Get User',
      description: 'Get details of a specific user by ID.',
      inputSchema: {
        userId: z.number().describe('User ID'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ userId }) => {
      try {
        const userRepository = getRepository(User);
        const user = await userRepository.findOneOrFail({
          where: { id: userId },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(user.filter(true), null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_user failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `User not found: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'create_user',
    {
      title: 'Create User',
      description: 'Create a new local user. Requires MANAGE_USERS permission.',
      inputSchema: {
        email: z.string().optional().describe('User email address'),
        username: z.string().min(1).describe('Username'),
        password: z
          .string()
          .min(8)
          .optional()
          .describe(
            'Password (min 8 chars; if not provided, email notifications must be enabled)'
          ),
      },
    },
    async ({ email, username, password }) => {
      try {
        const caller = await resolveUser();
        if (!caller || !checkPermission(caller, Permission.MANAGE_USERS)) {
          return permissionDenied('MANAGE_USERS');
        }

        const settings = getSettings();
        const userRepository = getRepository(User);
        const userEmail = email || username;

        const existingUser = await userRepository
          .createQueryBuilder('user')
          .where('user.email = :email', { email: userEmail.toLowerCase() })
          .getOne();

        if (existingUser) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'User already exists with this email.',
              },
            ],
            isError: true,
          };
        }

        const hasPassword = password && password.length > 0;
        const avatar = gravatarUrl(userEmail, { default: 'mm', size: 200 });

        if (!hasPassword && !settings.notifications.agents.email.enabled) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'A password is required when email notifications are not enabled.',
              },
            ],
            isError: true,
          };
        }

        const user = new User({
          email: userEmail,
          avatar,
          username,
          password,
          permissions: settings.main.defaultPermissions,
          plexToken: '',
          userType: UserType.LOCAL,
        });

        if (hasPassword) {
          await user.setPassword(password);
        } else {
          await user.generatePassword();
        }

        await userRepository.save(user);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(user.filter(), null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP create_user failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Create user failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'update_user',
    {
      title: 'Update User',
      description:
        "Update a user's username and/or permissions. Requires MANAGE_USERS permission.",
      inputSchema: {
        userId: z.number().describe('User ID to update'),
        username: z.string().optional().describe('New username'),
        permissions: z.number().optional().describe('New permissions bitmask'),
      },
    },
    async ({ userId, username, permissions }) => {
      try {
        const caller = await resolveUser();
        if (!caller || !checkPermission(caller, Permission.MANAGE_USERS)) {
          return permissionDenied('MANAGE_USERS');
        }

        const userRepository = getRepository(User);
        const user = await userRepository.findOneOrFail({
          where: { id: userId },
        });

        if (user.id === 1) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Cannot modify the owner account via MCP.',
              },
            ],
            isError: true,
          };
        }

        if (username !== undefined) {
          user.username = username;
        }
        if (permissions !== undefined) {
          user.permissions = permissions;
        }

        await userRepository.save(user);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(user.filter(), null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP update_user failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Update user failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'delete_user',
    {
      title: 'Delete User',
      description:
        'Delete a user and their requests. Cannot delete the owner account. Requires MANAGE_USERS permission.',
      inputSchema: {
        userId: z.number().describe('User ID to delete'),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ userId }) => {
      try {
        const caller = await resolveUser();
        if (!caller || !checkPermission(caller, Permission.MANAGE_USERS)) {
          return permissionDenied('MANAGE_USERS');
        }

        const userRepository = getRepository(User);

        const user = await userRepository.findOne({
          where: { id: userId },
          relations: { requests: true },
        });

        if (!user) {
          return {
            content: [{ type: 'text' as const, text: 'User not found.' }],
            isError: true,
          };
        }

        if (user.id === 1) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'The owner account cannot be deleted.',
              },
            ],
            isError: true,
          };
        }

        if (user.hasPermission(Permission.ADMIN)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Cannot delete users with administrative privileges.',
              },
            ],
            isError: true,
          };
        }

        const requestRepository = getRepository(MediaRequest);
        await requestRepository.remove(user.requests, {
          chunk: user.requests.length / 1000,
        });

        await userRepository.delete(user.id);

        return {
          content: [
            {
              type: 'text' as const,
              text: `User ${userId} has been deleted.`,
            },
          ],
        };
      } catch (e) {
        logger.error('MCP delete_user failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Delete user failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_user_quota',
    {
      title: 'Get User Quota',
      description:
        "Get a user's remaining request quota for movies and TV shows.",
      inputSchema: {
        userId: z.number().describe('User ID'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ userId }) => {
      try {
        const userRepository = getRepository(User);
        const user = await userRepository.findOneOrFail({
          where: { id: userId },
        });

        const quotas = await user.getQuota();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(quotas, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_user_quota failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Get user quota failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
