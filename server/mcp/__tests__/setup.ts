import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { vi } from 'vitest';

/**
 * Creates a mock User entity with configurable permissions.
 */
export function createMockUser(
  overrides: Partial<User> & { permissions?: number } = {}
): User {
  const permissions = overrides.permissions ?? Permission.ADMIN;
  return {
    id: 1,
    email: 'admin@test.com',
    displayName: 'Test Admin',
    permissions,
    hasPermission(
      perms: Permission | Permission[],
      options?: { type: 'and' | 'or' }
    ): boolean {
      if (permissions & Permission.ADMIN) return true;
      if (Array.isArray(perms)) {
        if (options?.type === 'or') {
          return perms.some((p) => (permissions & p) !== 0);
        }
        return perms.every((p) => (permissions & p) !== 0);
      }
      return (permissions & perms) !== 0;
    },
    ...overrides,
  } as unknown as User;
}

/**
 * Creates a mock repository with common TypeORM methods.
 */
export function createMockRepository() {
  return {
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    find: vi.fn(),
    save: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
    delete: vi.fn(),
    remove: vi.fn(),
    count: vi.fn(),
    findAndCount: vi.fn(),
    createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
  };
}

/**
 * Creates a mock TypeORM query builder.
 */
export function createMockQueryBuilder() {
  const qb: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = [
    'leftJoinAndSelect',
    'innerJoinAndSelect',
    'where',
    'andWhere',
    'orWhere',
    'orderBy',
    'take',
    'skip',
    'select',
    'addSelect',
  ];

  for (const method of chainMethods) {
    qb[method] = vi.fn().mockReturnThis();
  }

  qb.getMany = vi.fn().mockResolvedValue([]);
  qb.getManyAndCount = vi.fn().mockResolvedValue([[], 0]);
  qb.getCount = vi.fn().mockResolvedValue(0);
  qb.getOne = vi.fn().mockResolvedValue(null);

  return qb;
}

/**
 * Connects an MCP server to an in-memory client for testing.
 * Returns the client which can call tools directly.
 */
export async function createTestClient(server: McpServer) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    async cleanup() {
      await client.close();
      await server.close();
    },
  };
}
