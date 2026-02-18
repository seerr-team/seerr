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
vi.mock('@server/mcp/tools/users', () => ({
  registerUserTools: vi.fn(),
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
vi.mock('@server/constants/issue', () => ({
  IssueStatus: { OPEN: 1, RESOLVED: 2 },
  IssueType: { VIDEO: 1, AUDIO: 2, SUBTITLES: 3, OTHER: 4 },
}));

vi.mock('@server/entity/Issue', () => ({
  default: class MockIssue {
    constructor(data: Record<string, unknown>) {
      Object.assign(this, data);
    }
    comments: unknown[] = [];
  },
}));

vi.mock('@server/entity/IssueComment', () => ({
  default: class MockIssueComment {
    constructor(data: Record<string, unknown>) {
      Object.assign(this, data);
    }
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

const mockMediaRepo = createMockRepository();
const mockIssueRepo = createMockRepository();
const mockIssueQb = createMockQueryBuilder();

vi.mock('@server/datasource', () => ({
  getRepository: vi.fn(
    (entity: { name?: string } | (new (...args: unknown[]) => unknown)) => {
      const name =
        typeof entity === 'function' ? (entity.name ?? entity.toString()) : '';
      if (name.includes('Media') || name === 'MockMedia') return mockMediaRepo;
      return mockIssueRepo;
    }
  ),
}));

describe('issue tools', () => {
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
    mockIssueRepo.createQueryBuilder.mockReturnValue(mockIssueQb);
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
      (mockIssueQb as Record<string, ReturnType<typeof vi.fn>>)[
        m
      ].mockReturnThis();
    }
    mockIssueQb.getManyAndCount.mockResolvedValue([[], 0]);
    mockIssueQb.getCount.mockResolvedValue(0);
    mockIssueQb.getOne.mockResolvedValue(null);

    const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
    resolveUser.mockResolvedValue(mockUser as never);
  });

  // 1. create_issue - creates issue successfully
  describe('create_issue', () => {
    it('creates issue successfully', async () => {
      mockMediaRepo.findOne.mockResolvedValueOnce({ id: 1, tmdbId: 550 });
      mockIssueRepo.save.mockResolvedValueOnce({
        id: 10,
        issueType: 1,
        media: { id: 1 },
      });

      const result = await client.callTool({
        name: 'create_issue',
        arguments: {
          mediaId: 1,
          issueType: 'video',
          message: 'Video stutters at 10:00',
        },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe(10);
    });

    // 2. create_issue - returns error when media not found
    it('returns error when media not found', async () => {
      mockMediaRepo.findOne.mockResolvedValueOnce(null);

      const result = await client.callTool({
        name: 'create_issue',
        arguments: {
          mediaId: 999,
          issueType: 'audio',
          message: 'No audio',
        },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Media not found');
    });

    it('creates issue with audio type', async () => {
      mockMediaRepo.findOne.mockResolvedValueOnce({ id: 1, tmdbId: 550 });
      mockIssueRepo.save.mockResolvedValueOnce({
        id: 11,
        issueType: 2,
        media: { id: 1 },
      });

      const result = await client.callTool({
        name: 'create_issue',
        arguments: {
          mediaId: 1,
          issueType: 'audio',
          message: 'No audio track',
        },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe(11);
      expect(parsed.issueType).toBe(2);
    });

    it('creates issue with subtitles type', async () => {
      mockMediaRepo.findOne.mockResolvedValueOnce({ id: 1, tmdbId: 550 });
      mockIssueRepo.save.mockResolvedValueOnce({
        id: 12,
        issueType: 3,
        media: { id: 1 },
      });

      const result = await client.callTool({
        name: 'create_issue',
        arguments: {
          mediaId: 1,
          issueType: 'subtitles',
          message: 'Missing subtitles',
        },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe(12);
      expect(parsed.issueType).toBe(3);
    });

    it('creates issue with other type', async () => {
      mockMediaRepo.findOne.mockResolvedValueOnce({ id: 1, tmdbId: 550 });
      mockIssueRepo.save.mockResolvedValueOnce({
        id: 13,
        issueType: 4,
        media: { id: 1 },
      });

      const result = await client.callTool({
        name: 'create_issue',
        arguments: {
          mediaId: 1,
          issueType: 'other',
          message: 'Other problem',
        },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe(13);
      expect(parsed.issueType).toBe(4);
    });

    // 3. create_issue - returns error when user not resolved
    it('returns error when user not resolved', async () => {
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(null as never);

      const result = await client.callTool({
        name: 'create_issue',
        arguments: {
          mediaId: 1,
          issueType: 'video',
          message: 'Broken',
        },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Failed to resolve user');
    });
  });

  // 4. list_issues - returns paginated issues
  describe('list_issues', () => {
    it('returns paginated issues', async () => {
      const mockIssues = [
        { id: 1, issueType: 1, status: 1 },
        { id: 2, issueType: 2, status: 1 },
      ];
      mockIssueQb.getManyAndCount.mockResolvedValueOnce([mockIssues, 2]);

      const result = await client.callTool({
        name: 'list_issues',
        arguments: { take: 10, skip: 0 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.pageInfo.results).toBe(2);
      expect(parsed.results).toHaveLength(2);
    });
  });

  // 5. get_issue - returns issue details
  describe('get_issue', () => {
    it('returns issue details', async () => {
      const mockIssue = {
        id: 1,
        issueType: 1,
        status: 1,
        comments: [],
        createdBy: { id: 1 },
      };
      mockIssueQb.getOneOrFail = vi.fn().mockResolvedValueOnce(mockIssue);

      const result = await client.callTool({
        name: 'get_issue',
        arguments: { issueId: 1 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.id).toBe(1);
    });
  });

  // 6. comment_on_issue - adds comment to issue
  describe('comment_on_issue', () => {
    it('adds comment to issue', async () => {
      const mockIssue = { id: 1, comments: [], status: 1 };
      mockIssueRepo.findOneOrFail.mockResolvedValueOnce(mockIssue);
      mockIssueRepo.save.mockResolvedValueOnce({
        ...mockIssue,
        comments: [{ message: 'Fixed now?' }],
      });

      const result = await client.callTool({
        name: 'comment_on_issue',
        arguments: { issueId: 1, message: 'Fixed now?' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockIssueRepo.save).toHaveBeenCalled();
    });
  });

  // 7. resolve_issue - sets status to RESOLVED
  describe('resolve_issue', () => {
    it('sets status to RESOLVED', async () => {
      const mockIssue = { id: 1, status: 1 };
      mockIssueRepo.findOneOrFail.mockResolvedValueOnce(mockIssue);
      mockIssueRepo.save.mockResolvedValueOnce({ ...mockIssue, status: 2 });

      const result = await client.callTool({
        name: 'resolve_issue',
        arguments: { issueId: 1 },
      });

      expect(result.isError).toBeFalsy();
      expect(mockIssue.status).toBe(2);
    });

    // 8. resolve_issue - returns permission denied without MANAGE_ISSUES
    it('returns permission denied without MANAGE_ISSUES', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'resolve_issue',
        arguments: { issueId: 1 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_ISSUES');
    });
  });

  // 9. reopen_issue - sets status to OPEN
  describe('reopen_issue', () => {
    it('sets status to OPEN', async () => {
      const mockIssue = { id: 1, status: 2 };
      mockIssueRepo.findOneOrFail.mockResolvedValueOnce(mockIssue);
      mockIssueRepo.save.mockResolvedValueOnce({ ...mockIssue, status: 1 });

      const result = await client.callTool({
        name: 'reopen_issue',
        arguments: { issueId: 1 },
      });

      expect(result.isError).toBeFalsy();
      expect(mockIssue.status).toBe(1);
    });
  });

  // list_issues filter/sort branches
  describe('list_issues filters and sort', () => {
    it('filters by open status', async () => {
      mockIssueQb.getManyAndCount.mockResolvedValueOnce([
        [{ id: 1, status: 1 }],
        1,
      ]);

      const result = await client.callTool({
        name: 'list_issues',
        arguments: { filter: 'open' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockIssueQb.where).toHaveBeenCalledWith(
        expect.stringContaining('issue.status IN'),
        expect.objectContaining({ issueStatus: [1] })
      );
    });

    it('filters by resolved status', async () => {
      mockIssueQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await client.callTool({
        name: 'list_issues',
        arguments: { filter: 'resolved' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockIssueQb.where).toHaveBeenCalledWith(
        expect.stringContaining('issue.status IN'),
        expect.objectContaining({ issueStatus: [2] })
      );
    });

    it('filters by createdBy', async () => {
      mockIssueQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await client.callTool({
        name: 'list_issues',
        arguments: { createdBy: 5 },
      });

      expect(result.isError).toBeFalsy();
      expect(mockIssueQb.andWhere).toHaveBeenCalledWith(
        'createdBy.id = :id',
        expect.objectContaining({ id: 5 })
      );
    });

    it('sorts by modified', async () => {
      mockIssueQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await client.callTool({
        name: 'list_issues',
        arguments: { sort: 'modified' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockIssueQb.orderBy).toHaveBeenCalledWith(
        'issue.updatedAt',
        'DESC'
      );
    });
  });

  // Error handlers
  describe('error handling', () => {
    it('create_issue returns error on save failure', async () => {
      mockMediaRepo.findOne.mockResolvedValueOnce({ id: 1, tmdbId: 550 });
      mockIssueRepo.save.mockRejectedValueOnce(new Error('DB error'));

      const result = await client.callTool({
        name: 'create_issue',
        arguments: { mediaId: 1, issueType: 'video', message: 'test' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Create issue failed');
    });

    it('list_issues returns error on query failure', async () => {
      mockIssueRepo.createQueryBuilder.mockImplementationOnce(() => {
        throw new Error('QB error');
      });

      const result = await client.callTool({
        name: 'list_issues',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('List issues failed');
    });

    it('get_issue returns error when not found', async () => {
      mockIssueQb.getOneOrFail = vi
        .fn()
        .mockRejectedValueOnce(new Error('Not found'));

      const result = await client.callTool({
        name: 'get_issue',
        arguments: { issueId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Issue not found');
    });

    it('comment_on_issue returns error on failure', async () => {
      mockIssueRepo.findOneOrFail.mockRejectedValueOnce(new Error('Not found'));

      const result = await client.callTool({
        name: 'comment_on_issue',
        arguments: { issueId: 999, message: 'test' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Comment failed');
    });

    it('resolve_issue returns error on failure', async () => {
      mockIssueRepo.findOneOrFail.mockRejectedValueOnce(new Error('Not found'));

      const result = await client.callTool({
        name: 'resolve_issue',
        arguments: { issueId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Resolve issue failed');
    });

    it('reopen_issue returns error on failure', async () => {
      mockIssueRepo.findOneOrFail.mockRejectedValueOnce(new Error('Not found'));

      const result = await client.callTool({
        name: 'reopen_issue',
        arguments: { issueId: 999 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Reopen issue failed');
    });

    it('get_issue_count returns error on failure', async () => {
      mockIssueRepo.createQueryBuilder.mockImplementationOnce(() => {
        throw new Error('Count error');
      });

      const result = await client.callTool({
        name: 'get_issue_count',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Get issue counts failed');
    });
  });

  // 10. get_issue_count - returns aggregate counts
  describe('get_issue_count', () => {
    it('returns aggregate counts', async () => {
      mockIssueQb.getCount
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3) // video
        .mockResolvedValueOnce(2) // audio
        .mockResolvedValueOnce(4) // subtitles
        .mockResolvedValueOnce(1) // others
        .mockResolvedValueOnce(7) // open
        .mockResolvedValueOnce(3); // closed

      const result = await client.callTool({
        name: 'get_issue_count',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.total).toBe(10);
      expect(parsed.video).toBe(3);
      expect(parsed.audio).toBe(2);
      expect(parsed.subtitles).toBe(4);
      expect(parsed.others).toBe(1);
      expect(parsed.open).toBe(7);
      expect(parsed.closed).toBe(3);
    });
  });
});
