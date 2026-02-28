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
vi.mock('@server/mcp/tools/watchlist', () => ({
  registerWatchlistTools: vi.fn(),
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
vi.mock('@server/constants/media', () => ({
  MediaStatus: {
    UNKNOWN: 1,
    PENDING: 2,
    PROCESSING: 3,
    PARTIALLY_AVAILABLE: 4,
    AVAILABLE: 5,
    DELETED: 6,
  },
}));

vi.mock('@server/entity/Media', () => ({
  default: class MockMedia {},
}));

vi.mock('@server/entity/User', () => ({
  User: class MockUser {},
}));

vi.mock('@server/api/tautulli', () => ({
  default: class MockTautulliAPI {
    constructor() {}
    getMediaWatchStats = vi.fn().mockResolvedValue([]);
    getMediaWatchUsers = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock('typeorm', () => ({
  In: vi.fn((values: unknown[]) => values),
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

const mockSettings = {
  tautulli: {} as Record<string, unknown>,
};

vi.mock('@server/lib/settings', () => ({
  getSettings: vi.fn(() => mockSettings),
}));

const mockMediaRepo = createMockRepository();
mockMediaRepo.findAndCount = vi.fn().mockResolvedValue([[], 0]);
mockMediaRepo.remove = vi.fn().mockResolvedValue(undefined);

vi.mock('@server/datasource', () => ({
  getRepository: vi.fn(() => mockMediaRepo),
}));

describe('media tools', () => {
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
    mockMediaRepo.findAndCount.mockResolvedValue([[], 0]);
    mockSettings.tautulli = {};

    const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
    resolveUser.mockResolvedValue(mockUser as never);
  });

  // 1. list_media - returns paginated media items
  describe('list_media', () => {
    it('returns paginated media items', async () => {
      const mockMedia = [
        { id: 1, tmdbId: 550, status: 5 },
        { id: 2, tmdbId: 1396, status: 5 },
      ];
      mockMediaRepo.findAndCount.mockResolvedValueOnce([mockMedia, 2]);

      const result = await client.callTool({
        name: 'list_media',
        arguments: { take: 20, skip: 0 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.pageInfo.results).toBe(2);
      expect(parsed.results).toHaveLength(2);
    });

    // 2. list_media - applies status filter
    it('applies status filter', async () => {
      mockMediaRepo.findAndCount.mockResolvedValueOnce([[], 0]);

      await client.callTool({
        name: 'list_media',
        arguments: { filter: 'available' },
      });

      expect(mockMediaRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 5 },
        })
      );
    });
  });

  // 3. get_media - returns single media item
  describe('get_media', () => {
    it('returns single media item', async () => {
      const mockMedia = { id: 1, tmdbId: 550, status: 5 };
      mockMediaRepo.findOneOrFail.mockResolvedValueOnce(mockMedia);

      const result = await client.callTool({
        name: 'get_media',
        arguments: { mediaId: 1 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe(1);
      expect(parsed.tmdbId).toBe(550);
    });

    // 4. get_media - returns error when not found
    it('returns error when not found', async () => {
      mockMediaRepo.findOneOrFail.mockRejectedValueOnce(
        new Error('Entity not found')
      );

      const result = await client.callTool({
        name: 'get_media',
        arguments: { mediaId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Media not found');
    });
  });

  // 5. update_media_status - updates status
  describe('update_media_status', () => {
    it('updates status', async () => {
      const mockMedia = { id: 1, status: 1 };
      mockMediaRepo.findOneOrFail.mockResolvedValueOnce(mockMedia);
      mockMediaRepo.save.mockResolvedValueOnce({ ...mockMedia, status: 5 });

      const result = await client.callTool({
        name: 'update_media_status',
        arguments: { mediaId: 1, status: 'available' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockMediaRepo.save).toHaveBeenCalled();
      expect(mockMedia.status).toBe(5);
    });

    // 6. update_media_status - returns permission denied without MANAGE_REQUESTS
    it('returns permission denied without MANAGE_REQUESTS', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'update_media_status',
        arguments: { mediaId: 1, status: 'available' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_REQUESTS');
    });
  });

  // 7. delete_media - removes media
  describe('delete_media', () => {
    it('removes media', async () => {
      const mockMedia = { id: 1, tmdbId: 550 };
      mockMediaRepo.findOneOrFail.mockResolvedValueOnce(mockMedia);
      mockMediaRepo.remove.mockResolvedValueOnce(undefined);

      const result = await client.callTool({
        name: 'delete_media',
        arguments: { mediaId: 1 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('has been deleted');
      expect(mockMediaRepo.remove).toHaveBeenCalledWith(mockMedia);
    });

    // 8. delete_media - returns permission denied without MANAGE_REQUESTS
    it('returns permission denied without MANAGE_REQUESTS', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'delete_media',
        arguments: { mediaId: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_REQUESTS');
    });
  });

  // 9. get_watch_data - returns permission denied without ADMIN
  describe('get_watch_data', () => {
    it('returns permission denied without ADMIN', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'get_watch_data',
        arguments: { mediaId: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('ADMIN');
    });

    // 10. get_watch_data - returns error when Tautulli not configured
    it('returns error when Tautulli not configured', async () => {
      mockSettings.tautulli = {};

      const result = await client.callTool({
        name: 'get_watch_data',
        arguments: { mediaId: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Tautulli API is not configured');
    });

    // 11. get_watch_data - returns error when media not found
    it('returns error when media not found', async () => {
      mockSettings.tautulli = {
        hostname: 'localhost',
        port: 8181,
        apiKey: 'tautulli-key',
      };
      mockMediaRepo.findOne = vi.fn().mockResolvedValueOnce(null);

      const result = await client.callTool({
        name: 'get_watch_data',
        arguments: { mediaId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Media not found');
    });

    // 12. get_watch_data - returns watch stats when Tautulli configured and media has ratingKey
    it('returns watch stats when Tautulli configured and media has ratingKey', async () => {
      mockSettings.tautulli = {
        hostname: 'localhost',
        port: 8181,
        apiKey: 'tautulli-key',
      };
      const mockMedia = { id: 1, tmdbId: 550, ratingKey: 'abc123' };
      mockMediaRepo.findOne = vi.fn().mockResolvedValueOnce(mockMedia);

      const result = await client.callTool({
        name: 'get_watch_data',
        arguments: { mediaId: 1 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.data).toBeDefined();
    });
  });

  // list_media - additional filter and sort branches
  describe('list_media filters and sorts', () => {
    it('applies partial status filter', async () => {
      mockMediaRepo.findAndCount.mockResolvedValueOnce([[], 0]);

      await client.callTool({
        name: 'list_media',
        arguments: { filter: 'partial' },
      });

      expect(mockMediaRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 4 },
        })
      );
    });

    it('applies allavailable status filter using In()', async () => {
      mockMediaRepo.findAndCount.mockResolvedValueOnce([[], 0]);
      const { In } = vi.mocked(await import('typeorm'));

      await client.callTool({
        name: 'list_media',
        arguments: { filter: 'allavailable' },
      });

      expect(In).toHaveBeenCalledWith([5, 4]);
      expect(mockMediaRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: [5, 4] },
        })
      );
    });

    it('applies processing status filter', async () => {
      mockMediaRepo.findAndCount.mockResolvedValueOnce([[], 0]);

      await client.callTool({
        name: 'list_media',
        arguments: { filter: 'processing' },
      });

      expect(mockMediaRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 3 },
        })
      );
    });

    it('applies pending status filter', async () => {
      mockMediaRepo.findAndCount.mockResolvedValueOnce([[], 0]);

      await client.callTool({
        name: 'list_media',
        arguments: { filter: 'pending' },
      });

      expect(mockMediaRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 2 },
        })
      );
    });

    it('applies modified sort', async () => {
      mockMediaRepo.findAndCount.mockResolvedValueOnce([[], 0]);

      await client.callTool({
        name: 'list_media',
        arguments: { sort: 'modified' },
      });

      expect(mockMediaRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { updatedAt: 'DESC' },
        })
      );
    });

    it('applies mediaAdded sort', async () => {
      mockMediaRepo.findAndCount.mockResolvedValueOnce([[], 0]);

      await client.callTool({
        name: 'list_media',
        arguments: { sort: 'mediaAdded' },
      });

      expect(mockMediaRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { mediaAddedAt: 'DESC' },
        })
      );
    });
  });

  // update_media_status - additional status and 4k branches
  describe('update_media_status additional branches', () => {
    it('updates status4k when is4k is true', async () => {
      const mockMedia = { id: 1, status: 1, status4k: 1 } as Record<
        string,
        unknown
      >;
      mockMediaRepo.findOneOrFail.mockResolvedValueOnce(mockMedia);
      mockMediaRepo.save.mockResolvedValueOnce({ ...mockMedia, status4k: 5 });

      const result = await client.callTool({
        name: 'update_media_status',
        arguments: { mediaId: 1, status: 'available', is4k: true },
      });

      expect(result.isError).toBeFalsy();
      expect(mockMedia.status4k).toBe(5);
      // status should remain unchanged
      expect(mockMedia.status).toBe(1);
    });

    it('sets partial status (PARTIALLY_AVAILABLE)', async () => {
      const mockMedia = { id: 1, status: 1 } as Record<string, unknown>;
      mockMediaRepo.findOneOrFail.mockResolvedValueOnce(mockMedia);
      mockMediaRepo.save.mockResolvedValueOnce({ ...mockMedia, status: 4 });

      const result = await client.callTool({
        name: 'update_media_status',
        arguments: { mediaId: 1, status: 'partial' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockMedia.status).toBe(4);
    });

    it('sets processing status', async () => {
      const mockMedia = { id: 1, status: 1 } as Record<string, unknown>;
      mockMediaRepo.findOneOrFail.mockResolvedValueOnce(mockMedia);
      mockMediaRepo.save.mockResolvedValueOnce({ ...mockMedia, status: 3 });

      const result = await client.callTool({
        name: 'update_media_status',
        arguments: { mediaId: 1, status: 'processing' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockMedia.status).toBe(3);
    });

    it('sets pending status', async () => {
      const mockMedia = { id: 1, status: 1 } as Record<string, unknown>;
      mockMediaRepo.findOneOrFail.mockResolvedValueOnce(mockMedia);
      mockMediaRepo.save.mockResolvedValueOnce({ ...mockMedia, status: 2 });

      const result = await client.callTool({
        name: 'update_media_status',
        arguments: { mediaId: 1, status: 'pending' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockMedia.status).toBe(2);
    });

    it('sets unknown status', async () => {
      const mockMedia = { id: 1, status: 5 } as Record<string, unknown>;
      mockMediaRepo.findOneOrFail.mockResolvedValueOnce(mockMedia);
      mockMediaRepo.save.mockResolvedValueOnce({ ...mockMedia, status: 1 });

      const result = await client.callTool({
        name: 'update_media_status',
        arguments: { mediaId: 1, status: 'unknown' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockMedia.status).toBe(1);
    });
  });

  // get_watch_data - ratingKey4k and error handler branches
  describe('get_watch_data additional branches', () => {
    it('returns watch stats for ratingKey4k', async () => {
      mockSettings.tautulli = {
        hostname: 'localhost',
        port: 8181,
        apiKey: 'tautulli-key',
      };
      const mockMedia = { id: 1, tmdbId: 550, ratingKey4k: '4k-key-123' };
      mockMediaRepo.findOne = vi.fn().mockResolvedValueOnce(mockMedia);

      const result = await client.callTool({
        name: 'get_watch_data',
        arguments: { mediaId: 1 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.data4k).toBeDefined();
    });

    it('returns watch stats for both ratingKey and ratingKey4k', async () => {
      mockSettings.tautulli = {
        hostname: 'localhost',
        port: 8181,
        apiKey: 'tautulli-key',
      };
      const mockMedia = {
        id: 1,
        tmdbId: 550,
        ratingKey: 'key-123',
        ratingKey4k: '4k-key-123',
      };
      mockMediaRepo.findOne = vi.fn().mockResolvedValueOnce(mockMedia);

      const result = await client.callTool({
        name: 'get_watch_data',
        arguments: { mediaId: 1 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.data).toBeDefined();
      expect(parsed.data4k).toBeDefined();
    });

    it('returns error when Tautulli API throws', async () => {
      mockSettings.tautulli = {
        hostname: 'localhost',
        port: 8181,
        apiKey: 'tautulli-key',
      };
      mockMediaRepo.findOne = vi
        .fn()
        .mockRejectedValueOnce(new Error('Tautulli connection failed'));

      const result = await client.callTool({
        name: 'get_watch_data',
        arguments: { mediaId: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Get watch data failed');
    });
  });

  // 13. list_media - returns error on repository failure
  describe('list_media error handling', () => {
    it('returns error when repository throws', async () => {
      mockMediaRepo.findAndCount.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const result = await client.callTool({
        name: 'list_media',
        arguments: { take: 20, skip: 0 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('List media failed');
    });
  });

  // 14. update_media_status - returns error on repository failure
  describe('update_media_status error handling', () => {
    it('returns error when findOneOrFail throws', async () => {
      mockMediaRepo.findOneOrFail.mockRejectedValueOnce(
        new Error('Entity not found')
      );

      const result = await client.callTool({
        name: 'update_media_status',
        arguments: { mediaId: 999, status: 'available' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Update media status failed');
    });
  });

  // 15. delete_media - returns error on repository failure
  describe('delete_media error handling', () => {
    it('returns error when findOneOrFail throws', async () => {
      mockMediaRepo.findOneOrFail.mockRejectedValueOnce(
        new Error('Entity not found')
      );

      const result = await client.callTool({
        name: 'delete_media',
        arguments: { mediaId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Delete media failed');
    });
  });
});
