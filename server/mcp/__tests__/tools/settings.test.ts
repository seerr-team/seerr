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
vi.mock('@server/entity/Media', () => ({
  default: class MockMedia {},
}));

vi.mock('@server/entity/MediaRequest', () => ({
  MediaRequest: class MockMediaRequest {},
}));

// Mock notification agents
vi.mock('@server/lib/notifications', () => ({
  Notification: { TEST_NOTIFICATION: 'TEST_NOTIFICATION' },
}));
vi.mock('@server/lib/notifications/agents/discord', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/email', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/slack', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/telegram', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/pushover', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/pushbullet', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/ntfy', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/gotify', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/webhook', () => ({
  default: vi.fn(),
}));
vi.mock('@server/lib/notifications/agents/webpush', () => ({
  default: vi.fn(),
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
  main: {
    apiKey: 'test-api-key',
    applicationTitle: 'Seerr',
    applicationUrl: 'http://localhost:5055',
    defaultPermissions: 32,
  } as Record<string, unknown>,
  radarr: [
    {
      id: 1,
      name: 'Radarr',
      hostname: 'localhost',
      port: 7878,
      useSsl: false,
      baseUrl: '',
      is4k: false,
      isDefault: true,
      activeDirectory: '/movies',
      activeProfileId: 1,
      activeProfileName: 'Any',
      syncEnabled: false,
    },
  ],
  sonarr: [] as unknown[],
  tautulli: {},
  notifications: { agents: { email: { enabled: false } } },
  save: vi.fn(),
};

vi.mock('@server/lib/settings', () => ({
  getSettings: vi.fn(() => mockSettings),
}));

const mockMediaRepo = createMockRepository();
const mockRequestRepo = createMockRepository();

vi.mock('@server/datasource', () => ({
  getRepository: vi.fn(
    (entity: { name?: string } | (new (...args: unknown[]) => unknown)) => {
      const name =
        typeof entity === 'function' ? (entity.name ?? entity.toString()) : '';
      if (name.includes('Request') || name === 'MockMediaRequest')
        return mockRequestRepo;
      return mockMediaRepo;
    }
  ),
}));

describe('settings tools', () => {
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
    mockSettings.save.mockReset();
    mockSettings.main.apiKey = 'test-api-key';
    mockSettings.main.applicationTitle = 'Seerr';

    const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
    resolveUser.mockResolvedValue(mockUser as never);
  });

  // 1. get_settings - returns settings without apiKey
  describe('get_settings', () => {
    it('returns settings without apiKey', async () => {
      const result = await client.callTool({
        name: 'get_settings',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.apiKey).toBeUndefined();
      expect(parsed.applicationTitle).toBe('Seerr');
    });

    // 2. get_settings - returns permission denied without MANAGE_SETTINGS
    it('returns permission denied without MANAGE_SETTINGS', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'get_settings',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_SETTINGS');
    });
  });

  // 3. update_settings - merges and saves settings
  describe('update_settings', () => {
    it('merges and saves settings', async () => {
      mockSettings.save.mockResolvedValueOnce(undefined);

      const result = await client.callTool({
        name: 'update_settings',
        arguments: { applicationTitle: 'New Title' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockSettings.save).toHaveBeenCalled();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.applicationTitle).toBe('New Title');
    });

    // 4. update_settings - returns permission denied
    it('returns permission denied', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'update_settings',
        arguments: { applicationTitle: 'New Title' },
      });

      expect(result.isError).toBe(true);
    });
  });

  // 5. get_services - returns radarr/sonarr config
  describe('get_services', () => {
    it('returns radarr/sonarr config', async () => {
      const result = await client.callTool({
        name: 'get_services',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.radarr).toHaveLength(1);
      expect(parsed.radarr[0].name).toBe('Radarr');
      expect(parsed.sonarr).toHaveLength(0);
    });
  });

  // 6. test_notification - returns permission denied without MANAGE_SETTINGS
  describe('test_notification', () => {
    it('returns permission denied without MANAGE_SETTINGS', async () => {
      const noPermsUser = createMockUser({ permissions: Permission.NONE });
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockResolvedValueOnce(noPermsUser as never);

      const result = await client.callTool({
        name: 'test_notification',
        arguments: { agentType: 'email' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('MANAGE_SETTINGS');
    });
  });

  // get_settings error handler
  describe('get_settings error handling', () => {
    it('returns error when getSettings throws', async () => {
      const { getSettings } = vi.mocked(await import('@server/lib/settings'));
      getSettings.mockImplementationOnce(() => {
        throw new Error('Settings error');
      });

      const result = await client.callTool({
        name: 'get_settings',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Get settings failed');
    });
  });

  // update_settings error handler
  describe('update_settings error handling', () => {
    it('returns error when save throws', async () => {
      mockSettings.save.mockRejectedValueOnce(new Error('Save failed'));

      const result = await client.callTool({
        name: 'update_settings',
        arguments: { applicationTitle: 'Broken' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Update settings failed');
    });
  });

  // get_services error handler
  describe('get_services error handling', () => {
    it('returns error when resolveUser throws', async () => {
      const { resolveUser } = vi.mocked(await import('@server/mcp/auth'));
      resolveUser.mockRejectedValueOnce(new Error('Auth failed') as never);

      const result = await client.callTool({
        name: 'get_services',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Get services failed');
    });
  });

  // test_notification success/failure
  describe('test_notification sending', () => {
    it('reports success when agent.send returns true', async () => {
      // Mock the agent constructor to return an object with send
      const DiscordAgent = vi.mocked(
        (await import('@server/lib/notifications/agents/discord')).default
      );
      DiscordAgent.mockImplementation(function () {
        return { send: vi.fn().mockResolvedValue(true) } as never;
      });

      const result = await client.callTool({
        name: 'test_notification',
        arguments: { agentType: 'discord' },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('sent successfully');
    });

    it('reports failure when agent.send returns false', async () => {
      const EmailAgent = vi.mocked(
        (await import('@server/lib/notifications/agents/email')).default
      );
      EmailAgent.mockImplementation(function () {
        return { send: vi.fn().mockResolvedValue(false) } as never;
      });

      const result = await client.callTool({
        name: 'test_notification',
        arguments: { agentType: 'email' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Test notification failed for email');
    });

    it('returns error when agent.send throws', async () => {
      const SlackAgent = vi.mocked(
        (await import('@server/lib/notifications/agents/slack')).default
      );
      SlackAgent.mockImplementation(function () {
        return {
          send: vi.fn().mockRejectedValue(new Error('Network error')),
        } as never;
      });

      const result = await client.callTool({
        name: 'test_notification',
        arguments: { agentType: 'slack' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Test notification failed');
    });
  });

  // 7. get_about - returns version, counts, timezone
  describe('get_about', () => {
    it('returns version, counts, timezone', async () => {
      mockMediaRepo.count.mockResolvedValueOnce(42);
      mockRequestRepo.count.mockResolvedValueOnce(15);

      const result = await client.callTool({
        name: 'get_about',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.version).toBe('1.0.0-test');
      expect(parsed.totalMediaItems).toBe(42);
      expect(parsed.totalRequests).toBe(15);
    });

    // 8. get_about - handles errors
    it('handles errors', async () => {
      mockMediaRepo.count.mockRejectedValueOnce(new Error('DB error'));

      const result = await client.callTool({
        name: 'get_about',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Get about failed');
    });
  });
});
