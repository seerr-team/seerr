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

const mockRepository = createMockRepository();

vi.mock('@server/datasource', () => ({
  getRepository: vi.fn(() => mockRepository),
}));

// Use the real auth module so permission checks actually run
vi.mock('@server/lib/settings', () => ({
  getSettings: vi.fn(() => ({
    main: { apiKey: 'test-key' },
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

// Mock complex dependencies used by tools
vi.mock('@server/api/themoviedb', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@server/api/github', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@server/api/tautulli', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@server/entity/Media', () => ({
  default: { getRelatedMedia: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@server/entity/MediaRequest', () => ({
  MediaRequest: class {
    static request = vi.fn();
  },
  MediaRequestStatus: {
    PENDING: 1,
    APPROVED: 2,
    DECLINED: 3,
    FAILED: 4,
    COMPLETED: 5,
  },
  DuplicateMediaRequestError: class extends Error {},
  RequestPermissionError: class extends Error {},
  QuotaRestrictedError: class extends Error {},
  NoSeasonsAvailableError: class extends Error {},
  BlocklistedMediaError: class extends Error {},
}));
vi.mock('@server/entity/Blocklist', () => ({
  Blocklist: { addToBlocklist: vi.fn(), deleteAsync: vi.fn() },
}));
vi.mock('@server/entity/Watchlist', () => ({
  Watchlist: class {
    static addToWatchlist = vi.fn();
  },
  DuplicateWatchlistRequestError: class extends Error {},
  NotFoundError: class extends Error {},
}));
vi.mock('@server/entity/Issue', () => ({
  default: class {},
}));
vi.mock('@server/entity/IssueComment', () => ({
  default: class {},
}));
vi.mock('@server/entity/User', () => ({
  User: class {
    hasPermission() {
      return false;
    }
  },
}));
vi.mock('@server/lib/search', () => ({
  findSearchProvider: vi.fn().mockReturnValue(null),
}));
vi.mock('@server/models/Search', () => ({
  mapSearchResults: vi.fn((r) => r),
}));
vi.mock('@server/lib/notifications', () => ({
  Notification: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/discord', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/email', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/gotify', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/ntfy', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/pushbullet', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/pushover', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/slack', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/telegram', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/webhook', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/webpush', () => ({
  default: vi.fn(),
}));
vi.mock('@server/job/schedule', () => ({
  scheduledJobs: [],
}));
vi.mock('@server/utils/restartFlag', () => ({
  default: { isSet: vi.fn().mockReturnValue(false) },
}));
vi.mock('@server/constants/user', () => ({
  UserType: { PLEX: 1, LOCAL: 2, JELLYFIN: 3, EMBY: 4 },
}));
vi.mock('gravatar-url', () => ({
  default: vi.fn().mockReturnValue('https://gravatar.com/test'),
}));

/**
 * Mapping of tools that require permissions to the permission they check.
 * We test that each returns "Forbidden" when the user lacks the permission.
 */
const PROTECTED_TOOLS: {
  name: string;
  permission: string;
  args: Record<string, unknown>;
}[] = [
  // Request management
  {
    name: 'approve_request',
    permission: 'MANAGE_REQUESTS',
    args: { requestId: 1 },
  },
  {
    name: 'decline_request',
    permission: 'MANAGE_REQUESTS',
    args: { requestId: 1 },
  },
  {
    name: 'retry_request',
    permission: 'MANAGE_REQUESTS',
    args: { requestId: 1 },
  },
  // User management
  {
    name: 'list_users',
    permission: 'MANAGE_USERS',
    args: {},
  },
  {
    name: 'create_user',
    permission: 'MANAGE_USERS',
    args: { username: 'testuser', password: 'password123' },
  },
  {
    name: 'delete_user',
    permission: 'MANAGE_USERS',
    args: { userId: 2 },
  },
  // Blocklist
  {
    name: 'add_to_blocklist',
    permission: 'MANAGE_BLOCKLIST',
    args: { tmdbId: 550, mediaType: 'movie' },
  },
  {
    name: 'remove_from_blocklist',
    permission: 'MANAGE_BLOCKLIST',
    args: { tmdbId: 550 },
  },
  // Settings
  {
    name: 'get_settings',
    permission: 'MANAGE_SETTINGS',
    args: {},
  },
  // System (admin-only)
  {
    name: 'list_jobs',
    permission: 'ADMIN',
    args: {},
  },
];

describe('permission enforcement', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('denies access when user lacks permission', () => {
    for (const tool of PROTECTED_TOOLS) {
      it(`${tool.name} requires ${tool.permission}`, async () => {
        // Provide a user with NO permissions
        const noPermUser = createMockUser({ permissions: Permission.NONE });
        const { getRepository } = vi.mocked(await import('@server/datasource'));
        getRepository.mockReturnValue({
          findOne: vi.fn().mockResolvedValue(noPermUser),
        } as never);

        const result = await client.callTool({
          name: tool.name,
          arguments: tool.args,
        });

        expect(result.isError).toBe(true);
        const content = result.content as { type: string; text: string }[];
        expect(content[0].text).toContain('Forbidden');
      });
    }
  });

  describe('allows access when user has permission', () => {
    for (const tool of PROTECTED_TOOLS) {
      it(`${tool.name} succeeds with ${tool.permission}`, async () => {
        // Provide an admin user (has all permissions)
        const adminUser = createMockUser({ permissions: Permission.ADMIN });
        const { getRepository } = vi.mocked(await import('@server/datasource'));

        // For the user resolution
        const findOne = vi.fn().mockResolvedValue(adminUser);
        // For tool-specific queries
        const repo = createMockRepository();
        repo.findOne = findOne;
        repo.findOneOrFail.mockResolvedValue({
          id: 1,
          status: 1,
          modifiedBy: undefined,
        });

        getRepository.mockReturnValue(repo as never);

        const result = await client.callTool({
          name: tool.name,
          arguments: tool.args,
        });

        // Should NOT be a permission error
        const content = result.content as { type: string; text: string }[];
        const isForbidden = content[0]?.text?.includes('Forbidden');
        expect(isForbidden).toBeFalsy();
      });
    }
  });
});
