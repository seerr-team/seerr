import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPrompts } from '@server/mcp/prompts';
import { registerMediaDetailResources } from '@server/mcp/resources/media-details';
import { registerReferenceDataResources } from '@server/mcp/resources/reference-data';
import { registerBlocklistTools } from '@server/mcp/tools/blocklist';
import { registerDiscoverTools } from '@server/mcp/tools/discover';
import { registerIssueTools } from '@server/mcp/tools/issues';
import { registerMediaTools } from '@server/mcp/tools/media';
import { registerRequestTools } from '@server/mcp/tools/requests';
import { registerSearchTools } from '@server/mcp/tools/search';
import { registerSettingsTools } from '@server/mcp/tools/settings';
import { registerSystemTools } from '@server/mcp/tools/system';
import { registerUserTools } from '@server/mcp/tools/users';
import { registerWatchlistTools } from '@server/mcp/tools/watchlist';
import { getAppVersion } from '@server/utils/appVersion';

/**
 * Creates and configures the Seerr MCP server with all tools, resources, and prompts.
 * This factory is used by both the Streamable HTTP transport (embedded in Express)
 * and the STDIO transport (standalone process).
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'seerr',
    version: getAppVersion(),
  });

  // Phase 2: Search & Discovery
  registerSearchTools(server);
  registerDiscoverTools(server);
  registerMediaDetailResources(server);

  // Phase 3: Request Management
  registerRequestTools(server);

  // Phase 4: Media, Watchlist, Blocklist & Reference Data
  registerMediaTools(server);
  registerWatchlistTools(server);
  registerBlocklistTools(server);
  registerReferenceDataResources(server);

  // Phase 5: User & Issue Management
  registerUserTools(server);
  registerIssueTools(server);

  // Phase 6: Admin, Settings & System
  registerSettingsTools(server);
  registerSystemTools(server);

  // Phase 7: Prompts
  registerPrompts(server);

  return server;
}
