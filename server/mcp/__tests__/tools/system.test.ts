import { Permission } from '@server/lib/permissions';
import { createMockUser, createTestClient } from '@server/mcp/__tests__/setup';
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
vi.mock('@server/mcp/tools/issues', () => ({
  registerIssueTools: vi.fn(),
}));
vi.mock('@server/mcp/tools/settings', () => ({
  registerSettingsTools: vi.fn(),
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
const { mockGetSeerrCommits, mockGetSeerrReleases } = vi.hoisted(() => ({
  mockGetSeerrCommits: vi.fn().mockResolvedValue([]),
  mockGetSeerrReleases: vi.fn().mockResolvedValue([]),
}));

vi.mock('@server/api/github', () => ({
  default: class MockGithubAPI {
    getSeerrCommits = mockGetSeerrCommits;
    getSeerrReleases = mockGetSeerrReleases;
  },
}));

vi.mock('@server/utils/restartFlag', () => ({
  default: { isSet: vi.fn().mockReturnValue(false) },
}));

const { mockInvokeFn, mockCancelFn } = vi.hoisted(() => ({
  mockInvokeFn: vi.fn(),
  mockCancelFn: vi.fn(),
}));

vi.mock('@server/job/schedule', () => ({
  scheduledJobs: [
    {
      id: 'test-job',
      name: 'Test Job',
      type: 'process',
      interval: 'fixed',
      cronSchedule: '0 * * * *',
      job: {
        nextInvocation: vi
          .fn()
          .mockReturnValue(new Date('2025-01-01T00:00:00Z')),
        invoke: mockInvokeFn,
      },
      running: vi.fn().mockReturnValue(false),
      cancelFn: mockCancelFn,
    },
  ],
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi
      .fn()
      .mockResolvedValue(
        '{"timestamp":"2024-01-01","level":"info","label":"Server","message":"Started"}\n' +
          '{"timestamp":"2024-01-01","level":"error","label":"API","message":"Failed"}\n'
      ),
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

describe('system tools', () => {
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

    const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
    resolveUser.mockResolvedValue(mockUser as never);
  });

  // 1. get_status - returns version info
  describe('get_status', () => {
    it('returns version info', async () => {
      const result = await client.callTool({
        name: 'get_status',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.version).toBe('1.0.0-test');
      expect(parsed.commitTag).toBe('test');
      expect(parsed.restartRequired).toBe(false);
    });
  });

  // 2. list_jobs - returns job list with admin user
  describe('list_jobs', () => {
    it('returns job list with admin user', async () => {
      const result = await client.callTool({
        name: 'list_jobs',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('test-job');
      expect(parsed[0].name).toBe('Test Job');
    });

    // 3. list_jobs - returns permission denied without ADMIN
    it('returns permission denied without ADMIN', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'list_jobs',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('ADMIN');
    });
  });

  // 4. run_job - invokes job
  describe('run_job', () => {
    it('invokes job', async () => {
      const result = await client.callTool({
        name: 'run_job',
        arguments: { jobId: 'test-job' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockInvokeFn).toHaveBeenCalled();
    });

    // 5. run_job - returns error for unknown job
    it('returns error for unknown job', async () => {
      const result = await client.callTool({
        name: 'run_job',
        arguments: { jobId: 'nonexistent-job' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Job not found');
    });
  });

  // 6. cancel_job - calls cancelFn
  describe('cancel_job', () => {
    it('calls cancelFn', async () => {
      const result = await client.callTool({
        name: 'cancel_job',
        arguments: { jobId: 'test-job' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockCancelFn).toHaveBeenCalled();
    });

    // 7. cancel_job - returns error for unknown job
    it('returns error for unknown job', async () => {
      const result = await client.callTool({
        name: 'cancel_job',
        arguments: { jobId: 'nonexistent-job' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Job not found');
    });
  });

  // 8. get_logs - returns paginated logs
  describe('get_logs', () => {
    it('returns paginated logs', async () => {
      const result = await client.callTool({
        name: 'get_logs',
        arguments: { take: 25, skip: 0 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.pageInfo).toBeDefined();
      expect(parsed.results).toBeDefined();
      expect(parsed.pageInfo.results).toBe(2);
    });

    // 9. get_logs - filters by level
    it('filters by level', async () => {
      const result = await client.callTool({
        name: 'get_logs',
        arguments: { filter: 'error' },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.pageInfo.results).toBe(1);
      expect(parsed.results[0].level).toBe('error');
    });

    // 10. get_logs - returns permission denied without ADMIN
    it('returns permission denied without ADMIN', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'get_logs',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('ADMIN');
    });

    // 11. get_logs - returns error when file read fails
    it('returns error when log file cannot be read', async () => {
      const fs = await import('fs/promises');
      (fs.default.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('File not found')
      );

      const result = await client.callTool({
        name: 'get_logs',
        arguments: { take: 25, skip: 0 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Failed to retrieve logs');
    });
  });

  describe('get_status update checks', () => {
    it('detects commits behind on develop version', async () => {
      const { getAppVersion, getCommitTag } = vi.mocked(
        await import('@server/utils/appVersion')
      );
      getAppVersion.mockReturnValue('develop-abc123');
      getCommitTag.mockReturnValue('abc123');

      mockGetSeerrCommits.mockResolvedValueOnce([
        { sha: 'newer-sha', commit: { message: 'feat: new feature' } },
        { sha: 'middle-sha', commit: { message: 'fix: something' } },
        { sha: 'abc123', commit: { message: 'feat: old feature' } },
      ]);

      const result = await client.callTool({
        name: 'get_status',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.version).toBe('develop-abc123');
      expect(parsed.updateAvailable).toBe(true);
      expect(parsed.commitsBehind).toBe(2);
    });

    it('detects release version update available', async () => {
      const { getAppVersion, getCommitTag } = vi.mocked(
        await import('@server/utils/appVersion')
      );
      getAppVersion.mockReturnValue('1.0.0');
      getCommitTag.mockReturnValue('v1.0.0');

      mockGetSeerrReleases.mockResolvedValueOnce([{ name: 'v2.0.0' }]);

      const result = await client.callTool({
        name: 'get_status',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.updateAvailable).toBe(true);
    });
  });

  describe('get_logs additional filters', () => {
    it('filters by debug level (includes all levels)', async () => {
      const result = await client.callTool({
        name: 'get_logs',
        arguments: { filter: 'debug' },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      // debug filter includes debug, info, warn, error - both log lines match
      expect(parsed.pageInfo.results).toBe(2);
    });

    it('filters by warn level (includes warn and error)', async () => {
      const result = await client.callTool({
        name: 'get_logs',
        arguments: { filter: 'warn' },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      // warn filter includes warn and error - only the error line matches
      expect(parsed.pageInfo.results).toBe(1);
      expect(parsed.results[0].level).toBe('error');
    });

    it('filters by search parameter', async () => {
      const result = await client.callTool({
        name: 'get_logs',
        arguments: { search: 'Started' },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.pageInfo.results).toBe(1);
      expect(parsed.results[0].message).toBe('Started');
    });

    it('handles log entry with extra properties not in logMessageProperties', async () => {
      const fs = await import('fs/promises');
      (fs.default.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        '{"timestamp":"2024-01-01","level":"info","label":"Server","message":"test","extraProp":"extraValue"}\n'
      );

      const result = await client.callTool({
        name: 'get_logs',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.pageInfo.results).toBe(1);
      // Extra props should be moved under data
      expect(parsed.results[0].data.extraProp).toBe('extraValue');
    });

    it('handles invalid JSON lines gracefully', async () => {
      const fs = await import('fs/promises');
      (fs.default.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        'this is not json\n' +
          '{"timestamp":"2024-01-01","level":"info","label":"Server","message":"Valid line"}\n'
      );

      const result = await client.callTool({
        name: 'get_logs',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      // Only the valid JSON line should be returned
      expect(parsed.pageInfo.results).toBe(1);
      expect(parsed.results[0].message).toBe('Valid line');
    });
  });

  // 11. get_status - returns error when getAppVersion throws
  describe('get_status error handling', () => {
    it('returns error when getAppVersion throws', async () => {
      const { getAppVersion } = await import('@server/utils/appVersion');
      vi.mocked(getAppVersion).mockImplementationOnce(() => {
        throw new Error('Version lookup failed');
      });

      const result = await client.callTool({
        name: 'get_status',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Get status failed');
    });
  });

  // 12. list_jobs - returns error when resolveUser throws
  describe('list_jobs error handling', () => {
    it('returns error when resolveUser throws', async () => {
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockRejectedValueOnce(
        new Error('DB connection failed') as never
      );

      const result = await client.callTool({
        name: 'list_jobs',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('List jobs failed');
    });
  });

  // 13. run_job - returns error when resolveUser throws
  describe('run_job error handling', () => {
    it('returns error when resolveUser throws', async () => {
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockRejectedValueOnce(
        new Error('DB connection failed') as never
      );

      const result = await client.callTool({
        name: 'run_job',
        arguments: { jobId: 'test-job' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Run job failed');
    });

    it('returns permission denied without ADMIN', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'run_job',
        arguments: { jobId: 'test-job' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('ADMIN');
    });
  });

  // 14. cancel_job - returns error when resolveUser throws
  describe('cancel_job error handling', () => {
    it('returns error when resolveUser throws', async () => {
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockRejectedValueOnce(
        new Error('DB connection failed') as never
      );

      const result = await client.callTool({
        name: 'cancel_job',
        arguments: { jobId: 'test-job' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Cancel job failed');
    });

    it('returns permission denied without ADMIN', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'cancel_job',
        arguments: { jobId: 'test-job' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('ADMIN');
    });
  });
});
