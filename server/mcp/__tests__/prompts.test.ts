/**
 * MCP Prompts Test
 *
 * Tests the 3 prompts registered in server/mcp/prompts/index.ts:
 * - request_media
 * - check_status
 * - report_issue
 *
 * Each prompt takes arguments and returns a messages array.
 */

import { createTestClient } from '@server/mcp/__tests__/setup';
import { createMcpServer } from '@server/mcp/index';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

// Mock all tool registration modules to avoid dependency chains
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
vi.mock('@server/mcp/resources/media-details', () => ({
  registerMediaDetailResources: vi.fn(),
}));
vi.mock('@server/mcp/resources/reference-data', () => ({
  registerReferenceDataResources: vi.fn(),
}));

describe('MCP prompts', () => {
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

  describe('request_media', () => {
    it('returns messages array with query included in text', async () => {
      const result = await client.getPrompt({
        name: 'request_media',
        arguments: { query: 'Fight Club' },
      });

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);

      const allText = result.messages
        .map((m) => (m.content as { type: string; text: string }).text)
        .join('\n');

      expect(allText).toContain('Fight Club');
    });

    it('includes TV show hint when mediaType is tv', async () => {
      const result = await client.getPrompt({
        name: 'request_media',
        arguments: { query: 'Breaking Bad', mediaType: 'tv' },
      });

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);

      const allText = result.messages
        .map((m) => (m.content as { type: string; text: string }).text)
        .join('\n');

      expect(allText).toContain('Breaking Bad');
      expect(allText).toContain('TV show');
    });
  });

  describe('check_status', () => {
    it('returns messages array with no filter arguments', async () => {
      const result = await client.getPrompt({
        name: 'check_status',
        arguments: {},
      });

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);

      const userMessage = result.messages.find((m) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(
        (userMessage!.content as { type: string; text: string }).text
      ).toBeTruthy();
    });

    it('includes filter value in messages when filter is specified', async () => {
      const result = await client.getPrompt({
        name: 'check_status',
        arguments: { filter: 'pending' },
      });

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);

      const allText = result.messages
        .map((m) => (m.content as { type: string; text: string }).text)
        .join('\n');

      expect(allText).toContain('pending');
    });
  });

  describe('report_issue', () => {
    it('returns messages array with no arguments', async () => {
      const result = await client.getPrompt({
        name: 'report_issue',
        arguments: {},
      });

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);

      const userMessage = result.messages.find((m) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(
        (userMessage!.content as { type: string; text: string }).text
      ).toBeTruthy();
    });

    it('includes title and issueType in messages when both are specified', async () => {
      const result = await client.getPrompt({
        name: 'report_issue',
        arguments: { title: 'Inception', issueType: 'audio' },
      });

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);

      const allText = result.messages
        .map((m) => (m.content as { type: string; text: string }).text)
        .join('\n');

      expect(allText).toContain('Inception');
      expect(allText).toContain('audio');
    });
  });
});
