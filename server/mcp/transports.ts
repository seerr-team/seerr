import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import logger from '@server/logger';
import { createMcpServer } from '@server/mcp';
import { extractApiKey, resolveUser, validateApiKey } from '@server/mcp/auth';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

const MAX_SESSIONS = 100;
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Creates an Express router that serves the MCP Streamable HTTP transport at /mcp.
 * Handles POST (JSON-RPC requests), GET (SSE stream), and DELETE (session cleanup).
 */
export function createMcpRouter(): Router {
  const router = Router();

  // Auth middleware for all MCP routes
  router.use(async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = extractApiKey(req);
    if (!apiKey || !validateApiKey(apiKey)) {
      res
        .status(401)
        .json({ error: 'Unauthorized: Invalid or missing API key' });
      return;
    }
    // Try to resolve the user for downstream use (may be null for uninitialized instances)
    const userIdHeader = req.headers['x-api-user'];
    const userId = userIdHeader ? Number(userIdHeader) : undefined;
    const user = await resolveUser(userId);
    if (user) {
      req.user = user;
    }
    next();
  });

  // POST /mcp — Handle JSON-RPC requests
  router.post('/', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // Reuse existing transport for established sessions
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Create new transport for initialization requests
    if (!sessionId && isInitializeRequest(req.body)) {
      if (transports.size >= MAX_SESSIONS) {
        res
          .status(503)
          .json({ error: 'Too many active sessions. Please try again later.' });
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports.set(sid, transport);
          logger.debug(`MCP: Session initialized: ${sid}`, { label: 'MCP' });
        },
      });

      transport.onclose = () => {
        const sid = [...transports.entries()].find(
          ([, t]) => t === transport
        )?.[0];
        if (sid) {
          transports.delete(sid);
          logger.debug(`MCP: Session closed: ${sid}`, { label: 'MCP' });
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res
      .status(400)
      .json({
        error:
          'Invalid request: missing session ID or not an initialize request',
      });
  });

  // GET /mcp — SSE stream for server-initiated messages
  router.get('/', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session ID' });
      return;
    }

    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
  });

  // DELETE /mcp — Session cleanup
  router.delete('/', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.close();
      transports.delete(sessionId);
      logger.debug(`MCP: Session terminated: ${sessionId}`, { label: 'MCP' });
    }

    res.status(200).end();
  });

  return router;
}
