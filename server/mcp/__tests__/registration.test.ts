/**
 * MCP Server Registration Test
 *
 * Verifies that all tools, resources, and prompts are properly registered
 * and discoverable via the MCP protocol.
 *
 * NOTE: This test only checks registration metadata — it does NOT execute
 * tool handlers (which would require a running database and TMDB API).
 */

import { createMcpServer } from '@server/mcp/index';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestClient } from './setup';

vi.mock('@server/utils/appVersion', () => ({
  getAppVersion: vi.fn().mockReturnValue('1.0.0-test'),
  getCommitTag: vi.fn().mockReturnValue('test'),
}));

vi.mock('@server/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock all external dependencies that tools import
vi.mock('@server/datasource', () => ({
  getRepository: vi.fn(),
}));
vi.mock('@server/lib/settings', () => ({
  getSettings: vi.fn(() => ({ main: { apiKey: 'test' } })),
}));
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
  Blocklist: { addToBlocklist: vi.fn() },
}));
vi.mock('@server/entity/Watchlist', () => ({
  Watchlist: class {
    static addToWatchlist = vi.fn();
  },
  DuplicateWatchlistRequestError: class extends Error {},
  NotFoundError: class extends Error {},
}));
vi.mock('@server/entity/Issue', () => ({ default: class {} }));
vi.mock('@server/entity/IssueComment', () => ({ default: class {} }));
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
vi.mock('@server/lib/notifications', () => ({ Notification: vi.fn() }));
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
vi.mock('@server/job/schedule', () => ({ scheduledJobs: [] }));
vi.mock('@server/utils/restartFlag', () => ({
  default: { isSet: vi.fn().mockReturnValue(false) },
}));
vi.mock('@server/constants/user', () => ({
  UserType: { PLEX: 1, LOCAL: 2, JELLYFIN: 3, EMBY: 4 },
}));
vi.mock('gravatar-url', () => ({
  default: vi.fn().mockReturnValue('https://gravatar.com/test'),
}));

const EXPECTED_TOOLS = [
  'search_media',
  'search_keyword',
  'search_company',
  'discover_movies',
  'discover_tv',
  'discover_trending',
  'create_request',
  'list_requests',
  'get_request',
  'approve_request',
  'decline_request',
  'retry_request',
  'get_request_count',
  'list_media',
  'get_media',
  'update_media_status',
  'delete_media',
  'get_watch_data',
  'add_to_watchlist',
  'remove_from_watchlist',
  'get_watchlist',
  'add_to_blocklist',
  'remove_from_blocklist',
  'get_blocklist',
  'list_users',
  'get_user',
  'create_user',
  'update_user',
  'delete_user',
  'get_user_quota',
  'create_issue',
  'list_issues',
  'get_issue',
  'comment_on_issue',
  'resolve_issue',
  'reopen_issue',
  'get_issue_count',
  'get_settings',
  'update_settings',
  'get_services',
  'test_notification',
  'get_about',
  'get_status',
  'list_jobs',
  'run_job',
  'cancel_job',
  'get_logs',
];

const EXPECTED_RESOURCES = [
  'seerr://movie/{tmdbId}',
  'seerr://tv/{tmdbId}',
  'seerr://person/{tmdbId}',
  'seerr://collection/{collectionId}',
  'seerr://genres/movie',
  'seerr://genres/tv',
  'seerr://languages',
  'seerr://regions',
  'seerr://certifications/movie',
  'seerr://certifications/tv',
  'seerr://watchproviders/movies/{region}',
  'seerr://watchproviders/tv/{region}',
];

const EXPECTED_PROMPTS = ['request_media', 'check_status', 'report_issue'];

describe('MCP server registration', () => {
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

  describe('tools', () => {
    it('registers all expected tools', async () => {
      const toolsResult = await client.listTools();
      const toolNames = toolsResult.tools.map((t) => t.name);

      expect(toolsResult.tools.length).toBeGreaterThanOrEqual(
        EXPECTED_TOOLS.length
      );

      for (const expectedTool of EXPECTED_TOOLS) {
        expect(toolNames).toContain(expectedTool);
      }
    });

    it('all tools have descriptions', async () => {
      const toolsResult = await client.listTools();

      for (const tool of toolsResult.tools) {
        expect(
          tool.description,
          `Tool "${tool.name}" should have a description`
        ).toBeTruthy();
      }
    });
  });

  describe('resources', () => {
    it('registers all expected resources and templates', async () => {
      const resourcesResult = await client.listResources();
      const resourceTemplatesResult = await client.listResourceTemplates();

      const staticUris = resourcesResult.resources.map((r) => r.uri);
      const templateUris = resourceTemplatesResult.resourceTemplates.map(
        (r) => r.uriTemplate
      );
      const allUris = [...staticUris, ...templateUris];

      for (const expectedUri of EXPECTED_RESOURCES) {
        expect(allUris).toContain(expectedUri);
      }
    });
  });

  describe('prompts', () => {
    it('registers all expected prompts', async () => {
      const promptsResult = await client.listPrompts();
      const promptNames = promptsResult.prompts.map((p) => p.name);

      for (const expectedPrompt of EXPECTED_PROMPTS) {
        expect(promptNames).toContain(expectedPrompt);
      }
    });
  });
});
