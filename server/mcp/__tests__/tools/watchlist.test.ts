import { Permission } from '@server/lib/permissions';
import {
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
vi.mock('@server/mcp/tools/blocklist', () => ({
  registerBlocklistTools: vi.fn(),
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
const { mockCreateWatchlist, mockDeleteWatchlist } = vi.hoisted(() => ({
  mockCreateWatchlist: vi.fn().mockResolvedValue({ id: 1, tmdbId: 550 }),
  mockDeleteWatchlist: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@server/entity/Watchlist', () => {
  class MockDuplicateWatchlistRequestError extends Error {
    constructor(message?: string) {
      super(message ?? 'Already on watchlist');
      this.name = 'DuplicateWatchlistRequestError';
    }
  }
  return {
    Watchlist: class {
      static createWatchlist = mockCreateWatchlist;
      static deleteWatchlist = mockDeleteWatchlist;
    },
    DuplicateWatchlistRequestError: MockDuplicateWatchlistRequestError,
    NotFoundError: class extends Error {},
  };
});

vi.mock('@server/entity/User', () => ({
  User: class MockUser {},
}));

vi.mock('@server/api/plextv', () => ({
  default: class MockPlexTvAPI {
    getWatchlist = vi.fn().mockResolvedValue({ totalSize: 0, items: [] });
  },
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

const mockUserRepo = createMockRepository();
const mockWatchlistRepo = createMockRepository();
mockWatchlistRepo.findAndCount = vi.fn().mockResolvedValue([[], 0]);

vi.mock('@server/datasource', () => ({
  getRepository: vi.fn(
    (entity: { name?: string } | (new (...args: unknown[]) => unknown)) => {
      const name =
        typeof entity === 'function' ? (entity.name ?? entity.toString()) : '';
      if (name.includes('Watchlist')) return mockWatchlistRepo;
      return mockUserRepo;
    }
  ),
}));

describe('watchlist tools', () => {
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
    mockCreateWatchlist.mockResolvedValue({ id: 1, tmdbId: 550 });
    mockDeleteWatchlist.mockResolvedValue(undefined);

    const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
    resolveUser.mockResolvedValue(mockUser as never);
  });

  // 1. add_to_watchlist - adds item
  describe('add_to_watchlist', () => {
    it('adds item', async () => {
      const result = await client.callTool({
        name: 'add_to_watchlist',
        arguments: { tmdbId: 550, mediaType: 'movie', title: 'Fight Club' },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.tmdbId).toBe(550);
      expect(mockCreateWatchlist).toHaveBeenCalled();
    });

    // 2. add_to_watchlist - handles duplicate error
    it('handles duplicate error', async () => {
      const { DuplicateWatchlistRequestError } =
        await import('@server/entity/Watchlist');
      mockCreateWatchlist.mockRejectedValueOnce(
        new DuplicateWatchlistRequestError('Item already exists')
      );

      const result = await client.callTool({
        name: 'add_to_watchlist',
        arguments: { tmdbId: 550, mediaType: 'movie' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Already on watchlist');
    });

    // 3. add_to_watchlist - returns error when no user
    it('returns error when no user', async () => {
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(null as never);

      const result = await client.callTool({
        name: 'add_to_watchlist',
        arguments: { tmdbId: 550, mediaType: 'movie' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Failed to resolve user');
    });
  });

  // 4. remove_from_watchlist - removes item
  describe('remove_from_watchlist', () => {
    it('removes item', async () => {
      const result = await client.callTool({
        name: 'remove_from_watchlist',
        arguments: { tmdbId: 550 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Removed TMDB ID 550');
      expect(mockDeleteWatchlist).toHaveBeenCalled();
    });
  });

  // 5. get_watchlist - returns local watchlist (no plex token)
  describe('get_watchlist', () => {
    it('returns local watchlist when no plex token', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce({
        id: 1,
        plexToken: '',
      });
      mockWatchlistRepo.findAndCount.mockResolvedValueOnce([
        [{ id: 1, tmdbId: 550 }],
        1,
      ]);

      const result = await client.callTool({
        name: 'get_watchlist',
        arguments: { page: 1 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.totalResults).toBe(1);
      expect(parsed.results).toHaveLength(1);
    });

    // 6. get_watchlist - returns error when no user
    it('returns error when no user', async () => {
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(null as never);

      const result = await client.callTool({
        name: 'get_watchlist',
        arguments: { page: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Failed to resolve user');
    });

    // 7. get_watchlist - returns plex watchlist when user has plex token
    it('returns plex watchlist when user has plex token', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce({
        id: 1,
        plexToken: 'valid-plex-token',
      });

      // The PlexTvAPI mock creates instances with a default getWatchlist returning
      // { totalSize: 0, items: [] }. The tool will call this on the new instance.
      const result = await client.callTool({
        name: 'get_watchlist',
        arguments: { page: 1 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.totalResults).toBe(0);
      expect(parsed.results).toHaveLength(0);
    });

    // 8. get_watchlist - returns error when repository throws
    it('returns error when repository throws', async () => {
      mockUserRepo.findOne.mockRejectedValueOnce(new Error('DB error'));

      const result = await client.callTool({
        name: 'get_watchlist',
        arguments: { page: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Get watchlist failed');
    });

    // 9. get_watchlist - returns empty results when activeUser is null
    it('returns empty results when activeUser is null (no plexToken)', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null);

      const result = await client.callTool({
        name: 'get_watchlist',
        arguments: { page: 1 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.totalResults).toBe(0);
      expect(parsed.results).toHaveLength(0);
    });
  });

  // 10. add_to_watchlist - returns error on generic failure
  describe('add_to_watchlist generic error handling', () => {
    it('returns error on unexpected failure', async () => {
      mockCreateWatchlist.mockRejectedValueOnce(
        new Error('Unexpected DB error')
      );

      const result = await client.callTool({
        name: 'add_to_watchlist',
        arguments: { tmdbId: 550, mediaType: 'movie', title: 'Fight Club' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Add to watchlist failed');
    });
  });

  // 11. remove_from_watchlist - returns error when no user
  describe('remove_from_watchlist error handling', () => {
    it('returns error when no user', async () => {
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(null as never);

      const result = await client.callTool({
        name: 'remove_from_watchlist',
        arguments: { tmdbId: 550 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Failed to resolve user');
    });

    it('returns error when deleteWatchlist throws', async () => {
      mockDeleteWatchlist.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await client.callTool({
        name: 'remove_from_watchlist',
        arguments: { tmdbId: 550 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Remove from watchlist failed');
    });
  });
});
