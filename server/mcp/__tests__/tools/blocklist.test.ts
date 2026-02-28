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
vi.mock('@server/mcp/tools/users', () => ({
  registerUserTools: vi.fn(),
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
const { mockAddToBlocklist } = vi.hoisted(() => ({
  mockAddToBlocklist: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@server/entity/Blocklist', () => ({
  Blocklist: class {
    static addToBlocklist = mockAddToBlocklist;
  },
}));

vi.mock('@server/entity/Media', () => ({
  default: class MockMedia {},
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

const mockBlocklistRepo = createMockRepository();
mockBlocklistRepo.remove = vi.fn().mockResolvedValue(undefined);
const mockMediaRepo = createMockRepository();
mockMediaRepo.remove = vi.fn().mockResolvedValue(undefined);
const mockBlocklistQb = createMockQueryBuilder();

vi.mock('@server/datasource', () => ({
  getRepository: vi.fn(
    (entity: { name?: string } | (new (...args: unknown[]) => unknown)) => {
      const name =
        typeof entity === 'function' ? (entity.name ?? entity.toString()) : '';
      if (name.includes('Media') || name === 'MockMedia') return mockMediaRepo;
      return mockBlocklistRepo;
    }
  ),
}));

describe('blocklist tools', () => {
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
    mockBlocklistRepo.createQueryBuilder.mockReturnValue(mockBlocklistQb);
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
      (mockBlocklistQb as Record<string, ReturnType<typeof vi.fn>>)[
        m
      ].mockReturnThis();
    }
    mockBlocklistQb.getManyAndCount.mockResolvedValue([[], 0]);

    const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
    resolveUser.mockResolvedValue(mockUser as never);
  });

  // 1. add_to_blocklist - adds item with permission
  describe('add_to_blocklist', () => {
    it('adds item with permission', async () => {
      const result = await client.callTool({
        name: 'add_to_blocklist',
        arguments: { tmdbId: 550, mediaType: 'movie', title: 'Fight Club' },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Added TMDB ID 550');
      expect(mockAddToBlocklist).toHaveBeenCalled();
    });

    // 2. add_to_blocklist - returns permission denied
    it('returns permission denied', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'add_to_blocklist',
        arguments: { tmdbId: 550, mediaType: 'movie' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_BLOCKLIST');
    });
  });

  // 3. remove_from_blocklist - removes item and media
  describe('remove_from_blocklist', () => {
    it('removes item and media', async () => {
      const mockBlocklistItem = { id: 1, tmdbId: 550 };
      mockBlocklistRepo.findOneOrFail.mockResolvedValueOnce(mockBlocklistItem);
      mockBlocklistRepo.remove.mockResolvedValueOnce(undefined);
      const mockMediaItem = { id: 10, tmdbId: 550 };
      mockMediaRepo.findOneOrFail.mockResolvedValueOnce(mockMediaItem);
      mockMediaRepo.remove.mockResolvedValueOnce(undefined);

      const result = await client.callTool({
        name: 'remove_from_blocklist',
        arguments: { tmdbId: 550 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Removed TMDB ID 550');
      expect(mockBlocklistRepo.remove).toHaveBeenCalledWith(mockBlocklistItem);
      expect(mockMediaRepo.remove).toHaveBeenCalledWith(mockMediaItem);
    });

    it('succeeds when media item does not exist', async () => {
      const mockBlocklistItem = { id: 1, tmdbId: 550 };
      mockBlocklistRepo.findOneOrFail.mockResolvedValueOnce(mockBlocklistItem);
      mockBlocklistRepo.remove.mockResolvedValueOnce(undefined);
      mockMediaRepo.findOneOrFail.mockRejectedValueOnce(new Error('Not found'));

      const result = await client.callTool({
        name: 'remove_from_blocklist',
        arguments: { tmdbId: 550 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Removed TMDB ID 550');
    });

    it('returns error when blocklist item not found', async () => {
      mockBlocklistRepo.findOneOrFail.mockRejectedValueOnce(
        new Error('Not found')
      );

      const result = await client.callTool({
        name: 'remove_from_blocklist',
        arguments: { tmdbId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Remove from blocklist failed');
    });

    // add_to_blocklist error handler
    it('add_to_blocklist returns error on failure', async () => {
      mockAddToBlocklist.mockRejectedValueOnce(new Error('Add failed'));

      const result = await client.callTool({
        name: 'add_to_blocklist',
        arguments: { tmdbId: 550, mediaType: 'movie' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Add to blocklist failed');
    });

    // 4. remove_from_blocklist - returns permission denied
    it('returns permission denied', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'remove_from_blocklist',
        arguments: { tmdbId: 550 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_BLOCKLIST');
    });
  });

  // 5. get_blocklist - returns paginated items
  describe('get_blocklist', () => {
    it('returns paginated items', async () => {
      const mockItems = [
        { id: 1, tmdbId: 550, title: 'Fight Club' },
        { id: 2, tmdbId: 680, title: 'Pulp Fiction' },
      ];
      mockBlocklistQb.getManyAndCount.mockResolvedValueOnce([mockItems, 2]);

      const result = await client.callTool({
        name: 'get_blocklist',
        arguments: { take: 25, skip: 0 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.pageInfo.results).toBe(2);
      expect(parsed.results).toHaveLength(2);
    });

    it('filters by manual entries', async () => {
      mockBlocklistQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await client.callTool({
        name: 'get_blocklist',
        arguments: { filter: 'manual' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockBlocklistQb.andWhere).toHaveBeenCalledWith(
        'blocklist.blocklistedTags IS NULL'
      );
    });

    it('filters by blocklistedTags entries', async () => {
      mockBlocklistQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await client.callTool({
        name: 'get_blocklist',
        arguments: { filter: 'blocklistedTags' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockBlocklistQb.andWhere).toHaveBeenCalledWith(
        'blocklist.blocklistedTags IS NOT NULL'
      );
    });

    it('applies search filter', async () => {
      mockBlocklistQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await client.callTool({
        name: 'get_blocklist',
        arguments: { search: 'Fight' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockBlocklistQb.andWhere).toHaveBeenCalledWith(
        'blocklist.title like :title',
        { title: '%Fight%' }
      );
    });

    it('returns error on query failure', async () => {
      mockBlocklistRepo.createQueryBuilder.mockImplementationOnce(() => {
        throw new Error('QB error');
      });

      const result = await client.callTool({
        name: 'get_blocklist',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Get blocklist failed');
    });

    // 6. get_blocklist - returns permission denied without VIEW_BLOCKLIST
    it('returns permission denied without VIEW_BLOCKLIST', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'get_blocklist',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('BLOCKLIST');
    });
  });
});
