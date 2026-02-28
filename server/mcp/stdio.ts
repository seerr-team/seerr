import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

/**
 * STDIO MCP Server for Seerr.
 *
 * This is a standalone entry point that runs as a child process
 * (spawned by Claude Desktop, Claude Code, GitHub Copilot, Codex, etc.).
 *
 * It acts as a thin proxy — tool invocations are forwarded to the
 * Seerr REST API using the configured URL and API key.
 *
 * Environment variables:
 *   SEERR_URL      - Base URL of the Seerr instance (default: http://localhost:5055)
 *   SEERR_API_KEY  - API key for authentication (required)
 */

const SEERR_URL = process.env.SEERR_URL || 'http://localhost:5055';
const SEERR_API_KEY = process.env.SEERR_API_KEY;

if (!SEERR_API_KEY) {
  process.stderr.write(
    'Error: SEERR_API_KEY environment variable is required.\n'
  );
  process.exit(1);
}

/**
 * Creates an axios client configured to call the Seerr REST API.
 */
export function createApiClient(): AxiosInstance {
  return axios.create({
    baseURL: `${SEERR_URL}/api/v1`,
    headers: {
      'X-Api-Key': SEERR_API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

async function main() {
  const server = new McpServer({
    name: 'seerr',
    version: '1.0.0',
  });

  // TODO: Register STDIO-specific tools that proxy to the Seerr REST API via createApiClient()

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is reserved for the JSON-RPC protocol)
  process.stderr.write(`Seerr MCP STDIO server connected (${SEERR_URL})\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
