import { MediaRequestStatus } from '@server/constants/media';
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

const mockRepository = createMockRepository();
const mockUser = createMockUser({ permissions: Permission.ADMIN });

vi.mock('@server/datasource', () => ({
  getRepository: vi.fn(() => mockRepository),
}));

vi.mock('@server/mcp/auth', () => ({
  resolveUser: vi.fn(async () => mockUser),
  checkPermission: vi.fn(
    (
      user: { hasPermission: (p: number, o?: object) => boolean },
      perms: number,
      opts?: object
    ) => user.hasPermission(perms, opts as { type: 'and' | 'or' })
  ),
  permissionDenied: vi.fn((name: string) => ({
    content: [
      {
        type: 'text' as const,
        text: `Forbidden: This action requires the ${name} permission.`,
      },
    ],
    isError: true,
  })),
}));

vi.mock('@server/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@server/utils/appVersion', () => ({
  getAppVersion: vi.fn().mockReturnValue('1.0.0-test'),
  getCommitTag: vi.fn().mockReturnValue('test'),
}));

vi.mock('@server/entity/MediaRequest', () => ({
  MediaRequest: class MockMediaRequest {
    static request = vi.fn();
  },
  MediaRequestStatus: {
    PENDING: 1,
    APPROVED: 2,
    DECLINED: 3,
    FAILED: 4,
    COMPLETED: 5,
  },
  DuplicateMediaRequestError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'DuplicateMediaRequestError';
    }
  },
  RequestPermissionError: class extends Error {},
  QuotaRestrictedError: class extends Error {},
  NoSeasonsAvailableError: class extends Error {},
  BlocklistedMediaError: class extends Error {},
}));

// Mock other tool registrations
vi.mock('@server/mcp/tools/search', () => ({
  registerSearchTools: vi.fn(),
}));
vi.mock('@server/mcp/tools/discover', () => ({
  registerDiscoverTools: vi.fn(),
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

describe('request tools', () => {
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
    // Restore default mock implementations
    const { getRepository } = vi.mocked(await import('@server/datasource'));
    getRepository.mockReturnValue(mockRepository as never);

    const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
    resolveUser.mockResolvedValue(mockUser);
  });

  describe('approve_request', () => {
    it('returns permission denied when user lacks MANAGE_REQUESTS', async () => {
      const noPermUser = createMockUser({
        permissions: Permission.REQUEST,
      });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValue(noPermUser);

      const result = await client.callTool({
        name: 'approve_request',
        arguments: { requestId: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_REQUESTS');
    });

    it('sets status to APPROVED when permitted', async () => {
      const mockRequest = {
        id: 1,
        status: MediaRequestStatus.PENDING,
        modifiedBy: undefined,
      };
      mockRepository.findOneOrFail.mockResolvedValue(mockRequest);
      mockRepository.save.mockResolvedValue({
        ...mockRequest,
        status: MediaRequestStatus.APPROVED,
      });

      const result = await client.callTool({
        name: 'approve_request',
        arguments: { requestId: 1 },
      });

      expect(result.isError).toBeFalsy();
      expect(mockRepository.save).toHaveBeenCalled();
      const savedRequest = mockRepository.save.mock.calls[0][0];
      expect(savedRequest.status).toBe(MediaRequestStatus.APPROVED);
    });
  });

  describe('decline_request', () => {
    it('returns permission denied when user lacks MANAGE_REQUESTS', async () => {
      const noPermUser = createMockUser({
        permissions: Permission.REQUEST,
      });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValue(noPermUser);

      const result = await client.callTool({
        name: 'decline_request',
        arguments: { requestId: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_REQUESTS');
    });

    it('sets status to DECLINED when permitted', async () => {
      const mockRequest = {
        id: 1,
        status: MediaRequestStatus.PENDING,
        modifiedBy: undefined,
      };
      mockRepository.findOneOrFail.mockResolvedValue(mockRequest);

      const result = await client.callTool({
        name: 'decline_request',
        arguments: { requestId: 1 },
      });

      expect(result.isError).toBeFalsy();
      const savedRequest = mockRepository.save.mock.calls[0][0];
      expect(savedRequest.status).toBe(MediaRequestStatus.DECLINED);
    });
  });

  describe('create_request', () => {
    it('calls MediaRequest.request and returns result', async () => {
      const { MediaRequest } = await import('@server/entity/MediaRequest');
      vi.mocked(MediaRequest.request).mockResolvedValue({
        id: 42,
        status: MediaRequestStatus.PENDING,
      } as never);

      const result = await client.callTool({
        name: 'create_request',
        arguments: { mediaType: 'movie', mediaId: 550 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe(42);
    });

    it('handles DuplicateMediaRequestError', async () => {
      const { MediaRequest, DuplicateMediaRequestError } =
        await import('@server/entity/MediaRequest');
      vi.mocked(MediaRequest.request).mockRejectedValue(
        new DuplicateMediaRequestError('Already requested')
      );

      const result = await client.callTool({
        name: 'create_request',
        arguments: { mediaType: 'movie', mediaId: 550 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('duplicate');
    });
  });

  describe('list_requests', () => {
    it('returns paginated results', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[{ id: 1 }, { id: 2 }], 2]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { take: 10, skip: 0 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.pageInfo.results).toBe(2);
      expect(parsed.results).toHaveLength(2);
    });
  });

  describe('get_request_count', () => {
    it('returns aggregate counts', async () => {
      const qb = createMockQueryBuilder();
      qb.getCount.mockResolvedValue(5);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'get_request_count',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.total).toBe(5);
    });

    it('returns error when repository throws', async () => {
      mockRepository.createQueryBuilder.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const result = await client.callTool({
        name: 'get_request_count',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Get request counts failed');
    });
  });

  describe('approve_request error handling', () => {
    it('returns error when findOneOrFail throws', async () => {
      mockRepository.findOneOrFail.mockRejectedValueOnce(
        new Error('Request not found')
      );

      const result = await client.callTool({
        name: 'approve_request',
        arguments: { requestId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Approve request failed');
    });
  });

  describe('decline_request error handling', () => {
    it('returns error when findOneOrFail throws', async () => {
      mockRepository.findOneOrFail.mockRejectedValueOnce(
        new Error('Request not found')
      );

      const result = await client.callTool({
        name: 'decline_request',
        arguments: { requestId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Decline request failed');
    });
  });

  describe('list_requests error handling', () => {
    it('returns error when query builder throws', async () => {
      mockRepository.createQueryBuilder.mockImplementationOnce(() => {
        throw new Error('Query failed');
      });

      const result = await client.callTool({
        name: 'list_requests',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('List requests failed');
    });
  });

  describe('retry_request', () => {
    it('returns permission denied when user lacks MANAGE_REQUESTS', async () => {
      const noPermUser = createMockUser({
        permissions: Permission.REQUEST,
      });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValue(noPermUser);

      const result = await client.callTool({
        name: 'retry_request',
        arguments: { requestId: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_REQUESTS');
    });

    it('sets status to APPROVED when permitted', async () => {
      const mockRequest = {
        id: 1,
        status: MediaRequestStatus.FAILED,
        modifiedBy: undefined,
      };
      mockRepository.findOneOrFail.mockResolvedValue(mockRequest);
      mockRepository.save.mockResolvedValue({
        ...mockRequest,
        status: MediaRequestStatus.APPROVED,
      });

      const result = await client.callTool({
        name: 'retry_request',
        arguments: { requestId: 1 },
      });

      expect(result.isError).toBeFalsy();
      expect(mockRepository.save).toHaveBeenCalled();
      const savedRequest = mockRepository.save.mock.calls[0][0];
      expect(savedRequest.status).toBe(MediaRequestStatus.APPROVED);
    });

    it('returns error when findOneOrFail throws', async () => {
      mockRepository.findOneOrFail.mockRejectedValueOnce(
        new Error('Request not found')
      );

      const result = await client.callTool({
        name: 'retry_request',
        arguments: { requestId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Retry request failed');
    });
  });

  describe('create_request error types', () => {
    it('handles RequestPermissionError', async () => {
      const { MediaRequest, RequestPermissionError } =
        await import('@server/entity/MediaRequest');
      vi.mocked(MediaRequest.request).mockRejectedValue(
        new RequestPermissionError('Not allowed')
      );

      const result = await client.callTool({
        name: 'create_request',
        arguments: { mediaType: 'movie', mediaId: 550 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('permission');
    });

    it('handles QuotaRestrictedError', async () => {
      const { MediaRequest, QuotaRestrictedError } =
        await import('@server/entity/MediaRequest');
      vi.mocked(MediaRequest.request).mockRejectedValue(
        new QuotaRestrictedError('Quota exceeded')
      );

      const result = await client.callTool({
        name: 'create_request',
        arguments: { mediaType: 'movie', mediaId: 550 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('permission');
    });

    it('handles NoSeasonsAvailableError', async () => {
      const { MediaRequest, NoSeasonsAvailableError } =
        await import('@server/entity/MediaRequest');
      vi.mocked(MediaRequest.request).mockRejectedValue(
        new NoSeasonsAvailableError('No seasons')
      );

      const result = await client.callTool({
        name: 'create_request',
        arguments: { mediaType: 'tv', mediaId: 1396 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('no_seasons');
    });

    it('handles BlocklistedMediaError', async () => {
      const { MediaRequest, BlocklistedMediaError } =
        await import('@server/entity/MediaRequest');
      vi.mocked(MediaRequest.request).mockRejectedValue(
        new BlocklistedMediaError('Blocklisted')
      );

      const result = await client.callTool({
        name: 'create_request',
        arguments: { mediaType: 'movie', mediaId: 550 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('blocklisted');
    });
  });

  describe('list_requests filters', () => {
    it('filters by pending', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { filter: 'pending' },
      });

      expect(result.isError).toBeFalsy();
    });

    it('filters by approved', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { filter: 'approved' },
      });

      expect(result.isError).toBeFalsy();
    });

    it('filters by failed', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { filter: 'failed' },
      });

      expect(result.isError).toBeFalsy();
    });

    it('filters by available', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { filter: 'available' },
      });

      expect(result.isError).toBeFalsy();
    });

    it('filters by unavailable', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { filter: 'unavailable' },
      });

      expect(result.isError).toBeFalsy();
    });

    it('filters by deleted', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { filter: 'deleted' },
      });

      expect(result.isError).toBeFalsy();
    });

    it('filters by mediaType movie', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { mediaType: 'movie' },
      });

      expect(result.isError).toBeFalsy();
    });

    it('filters by mediaType tv', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { mediaType: 'tv' },
      });

      expect(result.isError).toBeFalsy();
    });

    it('filters by requestedBy', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { requestedBy: 5 },
      });

      expect(result.isError).toBeFalsy();
    });

    it('sorts by modified asc', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await client.callTool({
        name: 'list_requests',
        arguments: { sort: 'modified', sortDirection: 'asc' },
      });

      expect(result.isError).toBeFalsy();
    });
  });

  describe('get_request success', () => {
    it('returns request details', async () => {
      mockRepository.findOneOrFail.mockResolvedValueOnce({
        id: 1,
        status: 1,
        requestedBy: { id: 1 },
      });

      const result = await client.callTool({
        name: 'get_request',
        arguments: { requestId: 1 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe(1);
    });
  });

  describe('get_request error handling', () => {
    it('returns error when request not found', async () => {
      mockRepository.findOneOrFail.mockRejectedValueOnce(
        new Error('Entity not found')
      );

      const result = await client.callTool({
        name: 'get_request',
        arguments: { requestId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Request not found');
    });
  });
});
