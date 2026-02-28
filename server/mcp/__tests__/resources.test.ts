/**
 * MCP Resources Test
 *
 * Tests resources from:
 * - server/mcp/resources/reference-data.ts
 * - server/mcp/resources/media-details.ts
 */

import { createTestClient } from '@server/mcp/__tests__/setup';
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
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Mock all tool/prompt registration modules to avoid dependency chains ──

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
vi.mock('@server/mcp/tools/system', () => ({
  registerSystemTools: vi.fn(),
}));
vi.mock('@server/mcp/prompts', () => ({
  registerPrompts: vi.fn(),
}));

// ── TMDB mock (hoisted so vi.mock factory can reference it) ──

const mockTmdb = vi.hoisted(() => ({
  getMovie: vi.fn(),
  getTvShow: vi.fn(),
  getPerson: vi.fn(),
  getPersonCombinedCredits: vi.fn(),
  getCollection: vi.fn(),
  getMovieGenres: vi.fn(),
  getTvGenres: vi.fn(),
  getLanguages: vi.fn(),
  getRegions: vi.fn(),
  getMovieCertifications: vi.fn(),
  getTvCertifications: vi.fn(),
  getMovieWatchProviders: vi.fn(),
  getTvWatchProviders: vi.fn(),
}));

vi.mock('@server/api/themoviedb', () => ({
  default: class {
    constructor() {
      Object.assign(this, mockTmdb);
    }
  },
}));

vi.mock('@server/api/metadata', () => ({
  getMetadataProvider: vi.fn().mockResolvedValue({
    getTvShow: mockTmdb.getTvShow,
  }),
}));

vi.mock('@server/entity/Media', () => ({
  default: {
    getMedia: vi.fn().mockResolvedValue(null),
    getRelatedMedia: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@server/models/Movie', () => ({
  mapMovieDetails: vi.fn((d) => d),
}));

vi.mock('@server/models/Tv', () => ({
  mapTvDetails: vi.fn((d) => d),
}));

vi.mock('@server/models/Person', () => ({
  mapPersonDetails: vi.fn((d) => d),
  mapCastCredits: vi.fn((d) => d),
  mapCrewCredits: vi.fn((d) => d),
}));

vi.mock('@server/models/Collection', () => ({
  mapCollection: vi.fn((d) => d),
}));

vi.mock('@server/api/themoviedb/constants', () => ({
  ANIME_KEYWORD_ID: 210024,
}));

// ── Helpers ──

function getResourceText(contents: { uri: string; text?: string }[]): string {
  return contents[0]?.text ?? '';
}

// ── Tests ──

describe('MCP resources', () => {
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

    // Default return values for all TMDB mock methods
    mockTmdb.getMovieGenres.mockResolvedValue([{ id: 28, name: 'Action' }]);
    mockTmdb.getTvGenres.mockResolvedValue([
      { id: 10759, name: 'Action & Adventure' },
    ]);
    mockTmdb.getLanguages.mockResolvedValue([
      { iso_639_1: 'en', name: 'English' },
    ]);
    mockTmdb.getRegions.mockResolvedValue([
      { iso_3166_1: 'US', english_name: 'United States' },
    ]);
    mockTmdb.getMovieCertifications.mockResolvedValue({
      certifications: {
        US: [{ certification: 'PG-13', meaning: '', order: 3 }],
      },
    });
    mockTmdb.getTvCertifications.mockResolvedValue({
      certifications: {
        US: [{ certification: 'TV-14', meaning: '', order: 3 }],
      },
    });
    mockTmdb.getMovieWatchProviders.mockResolvedValue({
      results: [{ provider_id: 8, provider_name: 'Netflix' }],
    });
    mockTmdb.getTvWatchProviders.mockResolvedValue({
      results: [{ provider_id: 8, provider_name: 'Netflix' }],
    });
    mockTmdb.getMovie.mockResolvedValue({
      id: 550,
      title: 'Fight Club',
      overview: 'An insomniac office worker...',
    });
    mockTmdb.getTvShow.mockResolvedValue({
      id: 1396,
      name: 'Breaking Bad',
      overview: 'A chemistry teacher...',
      keywords: { results: [] },
    });
    mockTmdb.getPerson.mockResolvedValue({ id: 287, name: 'Brad Pitt' });
    mockTmdb.getPersonCombinedCredits.mockResolvedValue({ cast: [], crew: [] });
    mockTmdb.getCollection.mockResolvedValue({
      id: 10,
      name: 'Star Wars Collection',
      parts: [],
    });
  });

  // ── Reference data resources ──

  describe('seerr://genres/movie', () => {
    it('returns movie genres as JSON', async () => {
      mockTmdb.getMovieGenres.mockResolvedValueOnce([
        { id: 1, name: 'Action' },
      ]);

      const result = await client.readResource({ uri: 'seerr://genres/movie' });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toMatchObject({ id: 1, name: 'Action' });
    });
  });

  describe('seerr://genres/tv', () => {
    it('returns TV genres as JSON', async () => {
      mockTmdb.getTvGenres.mockResolvedValueOnce([{ id: 2, name: 'Drama' }]);

      const result = await client.readResource({ uri: 'seerr://genres/tv' });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toMatchObject({ id: 2, name: 'Drama' });
    });
  });

  describe('seerr://languages', () => {
    it('returns languages as JSON', async () => {
      mockTmdb.getLanguages.mockResolvedValueOnce([
        { iso_639_1: 'en', name: 'English' },
      ]);

      const result = await client.readResource({ uri: 'seerr://languages' });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toMatchObject({ iso_639_1: 'en', name: 'English' });
    });
  });

  describe('seerr://regions', () => {
    it('returns regions as JSON', async () => {
      mockTmdb.getRegions.mockResolvedValueOnce([
        { iso_3166_1: 'US', english_name: 'United States' },
      ]);

      const result = await client.readResource({ uri: 'seerr://regions' });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toMatchObject({
        iso_3166_1: 'US',
        english_name: 'United States',
      });
    });
  });

  describe('seerr://certifications/movie', () => {
    it('returns movie certifications as JSON', async () => {
      const certData = {
        certifications: {
          US: [
            { certification: 'PG-13', meaning: 'Parental guidance', order: 3 },
          ],
        },
      };
      mockTmdb.getMovieCertifications.mockResolvedValueOnce(certData);

      const result = await client.readResource({
        uri: 'seerr://certifications/movie',
      });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(parsed).toBeDefined();
      expect(parsed.certifications).toBeDefined();
      expect(parsed.certifications.US).toBeDefined();
    });
  });

  describe('seerr://certifications/tv', () => {
    it('returns TV certifications as JSON', async () => {
      const certData = {
        certifications: {
          US: [
            {
              certification: 'TV-14',
              meaning: 'Parents strongly cautioned',
              order: 3,
            },
          ],
        },
      };
      mockTmdb.getTvCertifications.mockResolvedValueOnce(certData);

      const result = await client.readResource({
        uri: 'seerr://certifications/tv',
      });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(parsed).toBeDefined();
      expect(parsed.certifications).toBeDefined();
      expect(parsed.certifications.US).toBeDefined();
    });
  });

  // ── Media detail resources ──

  describe('seerr://movie/{tmdbId}', () => {
    it('returns movie details as JSON', async () => {
      const movieData = {
        id: 550,
        title: 'Fight Club',
        overview: 'An insomniac office worker...',
        release_date: '1999-10-15',
      };
      mockTmdb.getMovie.mockResolvedValue(movieData);

      const result = await client.readResource({ uri: 'seerr://movie/550' });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(parsed).toBeDefined();
      expect(parsed.id).toBe(550);
      expect(parsed.title).toBe('Fight Club');
    });
  });

  describe('seerr://tv/{tmdbId}', () => {
    it('returns TV show details as JSON', async () => {
      const tvData = {
        id: 1396,
        name: 'Breaking Bad',
        overview: 'A chemistry teacher turned drug lord...',
        keywords: { results: [] },
      };
      mockTmdb.getTvShow.mockResolvedValue(tvData);

      const { getMetadataProvider } = vi.mocked(
        await import('@server/api/metadata')
      );
      getMetadataProvider.mockResolvedValue({
        getTvShow: vi.fn().mockResolvedValue(tvData),
      } as never);

      const result = await client.readResource({ uri: 'seerr://tv/1396' });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(parsed).toBeDefined();
      expect(parsed.id).toBe(1396);
      expect(parsed.name).toBe('Breaking Bad');
    });
  });

  describe('seerr://person/{tmdbId}', () => {
    it('returns person details with combined credits as JSON', async () => {
      const personData = {
        id: 287,
        name: 'Brad Pitt',
        biography: 'An American actor...',
      };
      const creditsData = {
        cast: [{ id: 550, title: 'Fight Club', media_type: 'movie' }],
        crew: [],
      };
      mockTmdb.getPerson.mockResolvedValue(personData);
      mockTmdb.getPersonCombinedCredits.mockResolvedValue(creditsData);

      const result = await client.readResource({ uri: 'seerr://person/287' });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(parsed).toBeDefined();
      expect(parsed.id).toBe(287);
      expect(parsed.name).toBe('Brad Pitt');
      expect(parsed.combinedCredits).toBeDefined();
    });
  });

  describe('seerr://collection/{collectionId}', () => {
    it('returns collection details as JSON', async () => {
      const collectionData = {
        id: 10,
        name: 'Star Wars Collection',
        overview: 'The Skywalker saga.',
        parts: [],
      };
      mockTmdb.getCollection.mockResolvedValue(collectionData);

      const result = await client.readResource({
        uri: 'seerr://collection/10',
      });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(parsed).toBeDefined();
      expect(parsed.id).toBe(10);
      expect(parsed.name).toBe('Star Wars Collection');
    });
  });

  describe('seerr://watchproviders/movies/{region}', () => {
    it('returns movie watch providers for a region as JSON', async () => {
      const providersData = {
        results: [
          {
            provider_id: 8,
            provider_name: 'Netflix',
            logo_path: '/netflix.png',
          },
        ],
      };
      mockTmdb.getMovieWatchProviders.mockResolvedValueOnce(providersData);

      const result = await client.readResource({
        uri: 'seerr://watchproviders/movies/US',
      });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(parsed).toBeDefined();
      expect(parsed.results).toBeDefined();
      expect(parsed.results[0].provider_name).toBe('Netflix');
    });
  });

  describe('seerr://watchproviders/tv/{region}', () => {
    it('returns TV watch providers for a region as JSON', async () => {
      const providersData = {
        results: [
          { provider_id: 15, provider_name: 'Hulu', logo_path: '/hulu.png' },
        ],
      };
      mockTmdb.getTvWatchProviders.mockResolvedValueOnce(providersData);

      const result = await client.readResource({
        uri: 'seerr://watchproviders/tv/US',
      });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);

      expect(parsed).toBeDefined();
      expect(parsed.results).toBeDefined();
      expect(parsed.results[0].provider_name).toBe('Hulu');
    });
  });

  // ── Error handling tests ──

  describe('seerr://genres/movie error handling', () => {
    it('returns error JSON when TMDB call fails', async () => {
      mockTmdb.getMovieGenres.mockRejectedValueOnce(
        new Error('TMDB unavailable')
      );

      const result = await client.readResource({ uri: 'seerr://genres/movie' });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('TMDB unavailable');
    });
  });

  describe('seerr://genres/tv error handling', () => {
    it('returns error JSON when TMDB call fails', async () => {
      mockTmdb.getTvGenres.mockRejectedValueOnce(new Error('TMDB unavailable'));

      const result = await client.readResource({ uri: 'seerr://genres/tv' });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('TMDB unavailable');
    });
  });

  describe('seerr://languages error handling', () => {
    it('returns error JSON when TMDB call fails', async () => {
      mockTmdb.getLanguages.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.readResource({ uri: 'seerr://languages' });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('seerr://regions error handling', () => {
    it('returns error JSON when TMDB call fails', async () => {
      mockTmdb.getRegions.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.readResource({ uri: 'seerr://regions' });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('seerr://certifications/movie error handling', () => {
    it('returns error JSON when TMDB call fails', async () => {
      mockTmdb.getMovieCertifications.mockRejectedValueOnce(
        new Error('TMDB error')
      );

      const result = await client.readResource({
        uri: 'seerr://certifications/movie',
      });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('TMDB error');
    });
  });

  describe('seerr://certifications/tv error handling', () => {
    it('returns error JSON when TMDB call fails', async () => {
      mockTmdb.getTvCertifications.mockRejectedValueOnce(
        new Error('TMDB error')
      );

      const result = await client.readResource({
        uri: 'seerr://certifications/tv',
      });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('TMDB error');
    });
  });

  describe('seerr://watchproviders/movies/{region} error handling', () => {
    it('returns error JSON when TMDB call fails', async () => {
      mockTmdb.getMovieWatchProviders.mockRejectedValueOnce(
        new Error('Provider fetch failed')
      );

      const result = await client.readResource({
        uri: 'seerr://watchproviders/movies/US',
      });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('Provider fetch failed');
    });
  });

  describe('seerr://watchproviders/tv/{region} error handling', () => {
    it('returns error JSON when TMDB call fails', async () => {
      mockTmdb.getTvWatchProviders.mockRejectedValueOnce(
        new Error('Provider fetch failed')
      );

      const result = await client.readResource({
        uri: 'seerr://watchproviders/tv/US',
      });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('Provider fetch failed');
    });
  });

  describe('seerr://movie/{tmdbId} error handling', () => {
    it('returns error JSON when TMDB getMovie fails', async () => {
      mockTmdb.getMovie.mockRejectedValueOnce(new Error('Movie not found'));

      const result = await client.readResource({ uri: 'seerr://movie/999999' });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('Movie not found');
    });
  });

  describe('seerr://tv/{tmdbId} error handling', () => {
    it('returns error JSON when TMDB getTvShow fails', async () => {
      mockTmdb.getTvShow.mockRejectedValueOnce(new Error('TV show not found'));

      const result = await client.readResource({ uri: 'seerr://tv/999999' });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('TV show not found');
    });
  });

  describe('seerr://person/{tmdbId} error handling', () => {
    it('returns error JSON when TMDB getPerson fails', async () => {
      mockTmdb.getPerson.mockRejectedValueOnce(new Error('Person not found'));

      const result = await client.readResource({
        uri: 'seerr://person/999999',
      });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('Person not found');
    });
  });

  describe('seerr://collection/{collectionId} error handling', () => {
    it('returns error JSON when TMDB getCollection fails', async () => {
      mockTmdb.getCollection.mockRejectedValueOnce(
        new Error('Collection not found')
      );

      const result = await client.readResource({
        uri: 'seerr://collection/999999',
      });

      expect(result.contents).toBeDefined();
      const text = getResourceText(
        result.contents as { uri: string; text?: string }[]
      );
      const parsed = JSON.parse(text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('Collection not found');
    });
  });
});
