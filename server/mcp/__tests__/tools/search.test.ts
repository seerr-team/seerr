import { createTestClient } from '@server/mcp/__tests__/setup';
import { createMcpServer } from '@server/mcp/index';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Mock all external dependencies
const mockSearchMulti = vi.fn().mockResolvedValue({
  page: 1,
  total_pages: 1,
  total_results: 2,
  results: [
    { id: 550, media_type: 'movie', title: 'Fight Club' },
    { id: 1396, media_type: 'tv', name: 'Breaking Bad' },
  ],
});
const mockSearchKeyword = vi.fn().mockResolvedValue({
  page: 1,
  total_pages: 1,
  total_results: 1,
  results: [{ id: 1, name: 'action' }],
});
const mockSearchCompany = vi.fn().mockResolvedValue({
  page: 1,
  total_pages: 1,
  total_results: 1,
  results: [{ id: 1, name: 'Warner Bros' }],
});

vi.mock('@server/api/themoviedb', () => {
  return {
    default: class MockTheMovieDb {
      searchMulti = mockSearchMulti;
      searchKeyword = mockSearchKeyword;
      searchCompany = mockSearchCompany;
    },
  };
});

vi.mock('@server/entity/Media', () => ({
  default: {
    getRelatedMedia: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@server/lib/search', () => ({
  findSearchProvider: vi.fn().mockReturnValue(null),
}));

vi.mock('@server/models/Search', () => ({
  mapSearchResults: vi.fn((results) =>
    results.map((r: { id: number }) => ({ id: r.id }))
  ),
}));

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

// Mock all other tool registrations to avoid their dependency chains
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

describe('search tools', () => {
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

  describe('search_media', () => {
    it('returns search results with pagination info', async () => {
      const result = await client.callTool({
        name: 'search_media',
        arguments: { query: 'Fight Club' },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.page).toBe(1);
      expect(parsed.totalResults).toBe(2);
      expect(parsed.results).toHaveLength(2);
    });

    it('uses search provider when pattern matches', async () => {
      const { findSearchProvider } = vi.mocked(
        await import('@server/lib/search')
      );
      const mockSearchFn = vi.fn().mockResolvedValue({
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [{ id: 999, media_type: 'movie', title: 'Provider Result' }],
      });
      findSearchProvider.mockReturnValueOnce({
        pattern: /tmdb:(\d+)/,
        search: mockSearchFn,
      } as never);

      const result = await client.callTool({
        name: 'search_media',
        arguments: { query: 'tmdb:999' },
      });

      expect(result.isError).toBeFalsy();
      expect(findSearchProvider).toHaveBeenCalled();
      expect(mockSearchFn).toHaveBeenCalled();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.results).toHaveLength(1);
    });

    it('returns error response when search fails', async () => {
      mockSearchMulti.mockRejectedValueOnce(new Error('TMDB API down'));

      const result = await client.callTool({
        name: 'search_media',
        arguments: { query: 'fail test' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Search failed');
    });
  });

  describe('search_keyword', () => {
    it('returns keyword results', async () => {
      const result = await client.callTool({
        name: 'search_keyword',
        arguments: { query: 'action' },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.results).toBeDefined();
    });

    it('returns error when keyword search fails', async () => {
      mockSearchKeyword.mockRejectedValueOnce(new Error('Keyword API error'));

      const result = await client.callTool({
        name: 'search_keyword',
        arguments: { query: 'fail' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Keyword search failed');
    });
  });

  describe('search_company', () => {
    it('returns company results', async () => {
      const result = await client.callTool({
        name: 'search_company',
        arguments: { query: 'Warner' },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.results).toBeDefined();
    });

    it('returns error when company search fails', async () => {
      mockSearchCompany.mockRejectedValueOnce(new Error('Company API error'));

      const result = await client.callTool({
        name: 'search_company',
        arguments: { query: 'fail' },
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Company search failed');
    });
  });
});
