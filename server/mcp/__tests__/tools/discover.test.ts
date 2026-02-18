import { createTestClient } from '@server/mcp/__tests__/setup';
import { createMcpServer } from '@server/mcp/index';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Mock TheMovieDb as a class with discover/trending methods
const mockGetDiscoverMovies = vi.fn().mockResolvedValue({
  page: 1,
  total_pages: 1,
  total_results: 1,
  results: [{ id: 1, title: 'Test Movie' }],
});
const mockGetDiscoverTv = vi.fn().mockResolvedValue({
  page: 1,
  total_pages: 1,
  total_results: 1,
  results: [{ id: 2, name: 'Test Show' }],
});
const mockGetAllTrending = vi.fn().mockResolvedValue({
  page: 1,
  total_pages: 1,
  total_results: 2,
  results: [
    { id: 1, title: 'Movie', media_type: 'movie' },
    { id: 2, name: 'Show', media_type: 'tv' },
  ],
});

vi.mock('@server/api/themoviedb', () => ({
  default: class MockTheMovieDb {
    getDiscoverMovies = mockGetDiscoverMovies;
    getDiscoverTv = mockGetDiscoverTv;
    getAllTrending = mockGetAllTrending;
  },
}));

vi.mock('@server/entity/Media', () => ({
  default: { getRelatedMedia: vi.fn().mockResolvedValue([]) },
}));

// Map functions - must mock these as they are imported by discover.ts
vi.mock('@server/models/Search', () => ({
  mapMovieResult: vi.fn((r) => ({ id: r.id, title: r.title })),
  mapTvResult: vi.fn((r) => ({ id: r.id, name: r.name })),
  mapPersonResult: vi.fn((r) => ({ id: r.id })),
  mapCollectionResult: vi.fn((r) => ({ id: r.id })),
  mapSearchResults: vi.fn((r) => r),
}));

// Type helpers used in discover_trending
vi.mock('@server/utils/typeHelpers', () => ({
  isMovie: vi.fn((r) => r.media_type === 'movie'),
  isPerson: vi.fn((r) => r.media_type === 'person'),
  isCollection: vi.fn((r) => r.media_type === 'collection'),
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

// Mock ALL other tool registrations to avoid their dependency chains
vi.mock('@server/mcp/tools/search', () => ({
  registerSearchTools: vi.fn(),
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

describe('discover tools', () => {
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

  describe('discover_movies', () => {
    it('returns movie results with pagination info', async () => {
      const result = await client.callTool({
        name: 'discover_movies',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.page).toBe(1);
      expect(parsed.totalPages).toBe(1);
      expect(parsed.totalResults).toBe(1);
      expect(parsed.results).toHaveLength(1);
      expect(parsed.results[0].id).toBe(1);
      expect(parsed.results[0].title).toBe('Test Movie');
    });

    it('returns error on failure', async () => {
      mockGetDiscoverMovies.mockRejectedValueOnce(new Error('TMDB API down'));

      const result = await client.callTool({
        name: 'discover_movies',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Discover movies failed');
    });
  });

  describe('discover_tv', () => {
    it('returns TV results with pagination info', async () => {
      const result = await client.callTool({
        name: 'discover_tv',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.page).toBe(1);
      expect(parsed.totalPages).toBe(1);
      expect(parsed.totalResults).toBe(1);
      expect(parsed.results).toHaveLength(1);
      expect(parsed.results[0].id).toBe(2);
      expect(parsed.results[0].name).toBe('Test Show');
    });

    it('returns error on failure', async () => {
      mockGetDiscoverTv.mockRejectedValueOnce(new Error('TMDB API down'));

      const result = await client.callTool({
        name: 'discover_tv',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Discover TV failed');
    });
  });

  describe('discover_trending', () => {
    it('returns mixed results with pagination info', async () => {
      const result = await client.callTool({
        name: 'discover_trending',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.page).toBe(1);
      expect(parsed.totalPages).toBe(1);
      expect(parsed.totalResults).toBe(2);
      expect(parsed.results).toHaveLength(2);
      expect(parsed.results[0].id).toBe(1);
      expect(parsed.results[0].title).toBe('Movie');
      expect(parsed.results[1].id).toBe(2);
      expect(parsed.results[1].name).toBe('Show');
    });

    it('handles person results in trending', async () => {
      mockGetAllTrending.mockResolvedValueOnce({
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [{ id: 287, name: 'Brad Pitt', media_type: 'person' }],
      });

      const result = await client.callTool({
        name: 'discover_trending',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.results[0].id).toBe(287);
    });

    it('handles collection results in trending', async () => {
      mockGetAllTrending.mockResolvedValueOnce({
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [{ id: 10, name: 'Star Wars', media_type: 'collection' }],
      });

      const result = await client.callTool({
        name: 'discover_trending',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      const parsed = JSON.parse(content[0].text);
      expect(parsed.results[0].id).toBe(10);
    });

    it('returns error on failure', async () => {
      mockGetAllTrending.mockRejectedValueOnce(new Error('TMDB API down'));

      const result = await client.callTool({
        name: 'discover_trending',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(content[0].text).toContain('Trending failed');
    });
  });
});
