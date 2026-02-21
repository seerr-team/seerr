import { Permission } from '@server/lib/permissions';
import {
  createMockQueryBuilder,
  createMockRepository,
  createMockUser,
  createTestClient,
} from '@server/mcp/__tests__/setup';
import { createMcpServer } from '@server/mcp/index';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// ── Common mocks ──
vi.mock('@server/utils/appVersion', () => ({
  getAppVersion: vi.fn().mockReturnValue('1.0.0-test'),
  getCommitTag: vi.fn().mockReturnValue('test'),
}));
vi.mock('@server/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Mock all other tool/resource/prompt registrations ──
vi.mock('@server/mcp/tools/search', () => ({
  registerSearchTools: vi.fn(),
}));
vi.mock('@server/mcp/tools/discover', () => ({
  registerDiscoverTools: vi.fn(),
}));
vi.mock('@server/mcp/tools/requests', () => ({
  registerRequestTools: vi.fn(),
}));
vi.mock('@server/mcp/tools/media', () => ({
  registerMediaTools: vi.fn(),
}));
vi.mock('@server/mcp/tools/watchlist', () => ({
  registerWatchlistTools: vi.fn(),
}));
vi.mock('@server/mcp/tools/blocklist', () => ({
  registerBlocklistTools: vi.fn(),
}));
vi.mock('@server/mcp/tools/issues', () => ({
  registerIssueTools: vi.fn(),
}));
vi.mock('@server/mcp/tools/settings', () => ({
  registerSettingsTools: vi.fn(),
}));
vi.mock('@server/mcp/tools/system', () => ({
  registerSystemTools: vi.fn(),
}));
vi.mock('@server/mcp/resources/media-details', () => ({
  registerMediaDetailResources: vi.fn(),
}));
vi.mock('@server/mcp/resources/reference-data', () => ({
  registerReferenceDataResources: vi.fn(),
}));
vi.mock('@server/mcp/prompts', () => ({
  registerPrompts: vi.fn(),
}));

// ── Domain mocks ──
vi.mock('@server/constants/user', () => ({
  UserType: { LOCAL: 1, PLEX: 2, JELLYFIN: 3, EMBY: 4 },
}));

vi.mock('@server/entity/User', () => ({
  User: class MockUser {
    constructor(data?: Record<string, unknown>) {
      if (data) Object.assign(this, data);
    }
    filter = vi.fn().mockReturnThis();
    static filterMany = vi.fn((users: unknown[]) => users);
    setPassword = vi.fn().mockResolvedValue(undefined);
    generatePassword = vi.fn().mockResolvedValue(undefined);
    hasPermission = vi.fn().mockReturnValue(false);
    requests: unknown[] = [];
  },
}));

vi.mock('@server/entity/MediaRequest', () => ({
  MediaRequest: class MockMediaRequest {},
}));

vi.mock('gravatar-url', () => ({
  default: vi.fn().mockReturnValue('https://gravatar.com/avatar/test'),
}));

const mockUser = createMockUser({ permissions: Permission.ADMIN });

vi.mock('@server/mcp/auth', () => ({
  resolveUser: vi.fn(async () => mockUser),
  checkPermission: vi.fn(
    (
      user: {
        hasPermission: (
          p: Permission | Permission[],
          o?: { type: 'and' | 'or' }
        ) => boolean;
      },
      perms: Permission | Permission[],
      opts?: { type: 'and' | 'or' }
    ) => user.hasPermission(perms, opts)
  ),
  permissionDenied: vi.fn((name: string) => ({
    content: [
      {
        type: 'text',
        text: `Forbidden: This action requires the ${name} permission.`,
      },
    ],
    isError: true,
  })),
}));

vi.mock('@server/lib/settings', () => ({
  getSettings: vi.fn(() => ({
    main: { defaultPermissions: 32 },
    notifications: { agents: { email: { enabled: true } } },
  })),
}));

const mockUserRepo = createMockRepository();
const mockUserQb = createMockQueryBuilder();
mockUserQb.distinct = vi.fn().mockReturnThis();
mockUserQb.addSelect = vi.fn().mockReturnThis();
const mockRequestRepo = createMockRepository();
mockRequestRepo.remove = vi.fn().mockResolvedValue(undefined);

vi.mock('@server/datasource', () => ({
  getRepository: vi.fn(
    (entity: { name?: string } | (new (...args: unknown[]) => unknown)) => {
      const name =
        typeof entity === 'function' ? (entity.name ?? entity.toString()) : '';
      if (name.includes('Request') || name === 'MockMediaRequest')
        return mockRequestRepo;
      return mockUserRepo;
    }
  ),
}));

describe('user tools', () => {
  let client: Awaited<ReturnType<typeof createTestClient>>['client'];
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = createMcpServer();
    const testClient = await createTestClient(server);
    client = testClient.client;
    cleanup = testClient.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUserRepo.createQueryBuilder.mockReturnValue(mockUserQb);
    // Reset chainable methods
    for (const m of [
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
    ]) {
      (mockUserQb as Record<string, ReturnType<typeof vi.fn>>)[
        m
      ].mockReturnThis();
    }
    mockUserQb.distinct.mockReturnThis();
    mockUserQb.getManyAndCount.mockResolvedValue([[], 0]);
    mockUserQb.getOne.mockResolvedValue(null);

    const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
    resolveUser.mockResolvedValue(mockUser as never);
  });

  // 1. list_users - returns paginated users
  describe('list_users', () => {
    it('returns paginated users', async () => {
      const mockUsers = [
        { id: 1, email: 'admin@test.com' },
        { id: 2, email: 'user@test.com' },
      ];
      mockUserQb.getManyAndCount.mockResolvedValueOnce([mockUsers, 2]);

      const result = await client.callTool({
        name: 'list_users',
        arguments: { take: 10, skip: 0 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.pageInfo.results).toBe(2);
      expect(parsed.results).toHaveLength(2);
    });

    // 2. list_users - returns permission denied without MANAGE_USERS
    it('returns permission denied without MANAGE_USERS', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'list_users',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_USERS');
    });
  });

  // 3. get_user - returns user details (calls user.filter)
  describe('get_user', () => {
    it('returns user details', async () => {
      const mockFoundUser = {
        id: 2,
        email: 'user@test.com',
        filter: vi.fn().mockReturnValue({ id: 2, email: 'user@test.com' }),
      };
      mockUserRepo.findOneOrFail.mockResolvedValueOnce(mockFoundUser);

      const result = await client.callTool({
        name: 'get_user',
        arguments: { userId: 2 },
      });

      expect(result.isError).toBeFalsy();
      expect(mockFoundUser.filter).toHaveBeenCalledWith(true);
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe(2);
    });

    // 4. get_user - returns error when not found
    it('returns error when not found', async () => {
      mockUserRepo.findOneOrFail.mockRejectedValueOnce(
        new Error('Entity not found')
      );

      const result = await client.callTool({
        name: 'get_user',
        arguments: { userId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('User not found');
    });
  });

  // 5. create_user - creates local user
  describe('create_user', () => {
    it('creates local user', async () => {
      mockUserQb.getOne.mockResolvedValueOnce(null); // no existing user
      mockUserRepo.save.mockResolvedValueOnce({ id: 3, username: 'newuser' });

      const result = await client.callTool({
        name: 'create_user',
        arguments: {
          username: 'newuser',
          password: 'password123',
        },
      });

      expect(result.isError).toBeFalsy();
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    // 6. create_user - returns permission denied
    it('returns permission denied', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'create_user',
        arguments: {
          username: 'newuser',
          password: 'password123',
        },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_USERS');
    });
  });

  // 7. update_user - updates username
  describe('update_user', () => {
    it('updates username', async () => {
      const mockFoundUser = {
        id: 2,
        username: 'oldname',
        filter: vi.fn().mockReturnValue({ id: 2, username: 'newname' }),
      };
      mockUserRepo.findOneOrFail.mockResolvedValueOnce(mockFoundUser);
      mockUserRepo.save.mockResolvedValueOnce({
        ...mockFoundUser,
        username: 'newname',
      });

      const result = await client.callTool({
        name: 'update_user',
        arguments: { userId: 2, username: 'newname' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockFoundUser.username).toBe('newname');
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    // 8. update_user - prevents modifying owner account (id 1)
    it('prevents modifying owner account', async () => {
      const ownerUser = { id: 1, username: 'owner' };
      mockUserRepo.findOneOrFail.mockResolvedValueOnce(ownerUser);

      const result = await client.callTool({
        name: 'update_user',
        arguments: { userId: 1, username: 'hacked' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Cannot modify the owner account');
    });
  });

  // 9. delete_user - deletes user and requests
  describe('delete_user', () => {
    it('deletes user and requests', async () => {
      const mockFoundUser = {
        id: 5,
        requests: [{ id: 1 }, { id: 2 }],
        hasPermission: vi.fn().mockReturnValue(false),
      };
      mockUserRepo.findOne.mockResolvedValueOnce(mockFoundUser);
      mockRequestRepo.remove.mockResolvedValueOnce(undefined);
      mockUserRepo.delete.mockResolvedValueOnce({ affected: 1 });

      const result = await client.callTool({
        name: 'delete_user',
        arguments: { userId: 5 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('User 5 has been deleted');
      expect(mockRequestRepo.remove).toHaveBeenCalled();
      expect(mockUserRepo.delete).toHaveBeenCalledWith(5);
    });
  });

  // list_users search and sort branches
  describe('list_users search and sort', () => {
    it('applies search filter', async () => {
      mockUserQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await client.callTool({
        name: 'list_users',
        arguments: { search: 'john' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockUserQb.where).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(user.username)'),
        expect.objectContaining({ q: '%john%' })
      );
    });

    it('sorts by updated', async () => {
      mockUserQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await client.callTool({
        name: 'list_users',
        arguments: { sort: 'updated' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockUserQb.orderBy).toHaveBeenCalledWith('user.updatedAt', 'DESC');
    });

    it('sorts by displayname', async () => {
      mockUserQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await client.callTool({
        name: 'list_users',
        arguments: { sort: 'displayname' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockUserQb.orderBy).toHaveBeenCalledWith('user.username', 'ASC');
    });

    it('sorts by requests', async () => {
      mockUserQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await client.callTool({
        name: 'list_users',
        arguments: { sort: 'requests' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockUserQb.addSelect).toHaveBeenCalled();
      expect(mockUserQb.orderBy).toHaveBeenCalledWith('request_count', 'DESC');
    });
  });

  // create_user edge cases
  describe('create_user edge cases', () => {
    it('returns error when user already exists', async () => {
      mockUserQb.getOne.mockResolvedValueOnce({
        id: 2,
        email: 'existing@test.com',
      });

      const result = await client.callTool({
        name: 'create_user',
        arguments: { username: 'existing', password: 'password123' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('User already exists');
    });

    it('returns error when no password and email not enabled', async () => {
      const { getSettings } = vi.mocked(await import('@server/lib/settings'));
      getSettings.mockReturnValueOnce({
        main: { defaultPermissions: 32 },
        notifications: { agents: { email: { enabled: false } } },
      } as never);
      mockUserQb.getOne.mockResolvedValueOnce(null);

      const result = await client.callTool({
        name: 'create_user',
        arguments: { username: 'newuser' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('password is required');
    });
  });

  // update_user permissions branch
  describe('update_user permissions', () => {
    it('updates permissions', async () => {
      const mockFoundUser = {
        id: 2,
        permissions: 32,
        filter: vi.fn().mockReturnValue({ id: 2, permissions: 64 }),
      };
      mockUserRepo.findOneOrFail.mockResolvedValueOnce(mockFoundUser);
      mockUserRepo.save.mockResolvedValueOnce({
        ...mockFoundUser,
        permissions: 64,
      });

      const result = await client.callTool({
        name: 'update_user',
        arguments: { userId: 2, permissions: 64 },
      });

      expect(result.isError).toBeFalsy();
      expect(mockFoundUser.permissions).toBe(64);
    });
  });

  // delete_user edge cases
  describe('delete_user edge cases', () => {
    it('returns error when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null);

      const result = await client.callTool({
        name: 'delete_user',
        arguments: { userId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('User not found');
    });

    it('prevents deleting owner account', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce({
        id: 1,
        requests: [],
        hasPermission: vi.fn().mockReturnValue(false),
      });

      const result = await client.callTool({
        name: 'delete_user',
        arguments: { userId: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('owner account cannot be deleted');
    });

    it('prevents deleting admin users', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce({
        id: 3,
        requests: [],
        hasPermission: vi.fn().mockReturnValue(true),
      });

      const result = await client.callTool({
        name: 'delete_user',
        arguments: { userId: 3 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('administrative privileges');
    });
  });

  // get_user_quota error handler
  describe('get_user_quota error handling', () => {
    it('returns error when user not found', async () => {
      mockUserRepo.findOneOrFail.mockRejectedValueOnce(new Error('Not found'));

      const result = await client.callTool({
        name: 'get_user_quota',
        arguments: { userId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Get user quota failed');
    });
  });

  // 10. get_user_quota - returns quota info
  describe('get_user_quota', () => {
    it('returns quota info', async () => {
      const mockFoundUser = {
        id: 2,
        getQuota: vi.fn().mockResolvedValue({
          movie: { remaining: 5, limit: 10, days: 7 },
          tv: { remaining: 3, limit: 5, days: 7 },
        }),
      };
      mockUserRepo.findOneOrFail.mockResolvedValueOnce(mockFoundUser);

      const result = await client.callTool({
        name: 'get_user_quota',
        arguments: { userId: 2 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.movie.remaining).toBe(5);
      expect(parsed.tv.remaining).toBe(3);
    });
  });
});
