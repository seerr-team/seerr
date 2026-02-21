import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@server/mcp/auth', () => ({
  extractApiKey: vi.fn(),
  validateApiKey: vi.fn(),
  resolveUser: vi.fn(),
}));

vi.mock('@server/mcp', () => ({
  createMcpServer: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  isInitializeRequest: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
    handleRequest: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    onclose: null,
  })),
}));

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import logger from '@server/logger';
import { createMcpServer } from '@server/mcp';
import { extractApiKey, resolveUser, validateApiKey } from '@server/mcp/auth';
import { createMcpRouter } from '@server/mcp/transports';
import type { NextFunction, Request, Response, Router } from 'express';

function createMockReq(
  overrides: Partial<{
    headers: Record<string, string>;
    body: unknown;
    user: unknown;
  }> = {}
) {
  return {
    headers: {},
    body: {},
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

/**
 * Extracts handlers from the router stack so they can be tested in isolation.
 */
function getRouteHandlers(router: Router) {
  const stack = (
    router as unknown as {
      stack: {
        route?: {
          methods: Record<string, boolean>;
          stack: { handle: (...args: unknown[]) => unknown }[];
        };
        name?: string;
        handle: (...args: unknown[]) => unknown;
      }[];
    }
  ).stack;

  // The auth middleware is the first layer without a route
  const authLayer = stack.find((l) => !l.route);
  const authMiddleware = authLayer?.handle;

  // Route handlers are the first handler in each route's stack
  const postHandler = stack.find((l) => l.route?.methods?.post)?.route?.stack[0]
    ?.handle;
  const getHandler = stack.find((l) => l.route?.methods?.get)?.route?.stack[0]
    ?.handle;
  const deleteHandler = stack.find((l) => l.route?.methods?.delete)?.route
    ?.stack[0]?.handle;

  return { authMiddleware, postHandler, getHandler, deleteHandler };
}

describe('MCP transports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMcpRouter', () => {
    it('returns an Express Router', () => {
      const router = createMcpRouter();
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('registers auth middleware, POST, GET, and DELETE handlers', () => {
      const router = createMcpRouter();
      const { authMiddleware, postHandler, getHandler, deleteHandler } =
        getRouteHandlers(router);

      expect(authMiddleware).toBeDefined();
      expect(postHandler).toBeDefined();
      expect(getHandler).toBeDefined();
      expect(deleteHandler).toBeDefined();
    });
  });

  describe('auth middleware', () => {
    it('returns 401 when extractApiKey returns undefined (missing key)', async () => {
      vi.mocked(extractApiKey).mockReturnValue(undefined);
      vi.mocked(validateApiKey).mockReturnValue(false);

      const router = createMcpRouter();
      const { authMiddleware } = getRouteHandlers(router);

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await (
        authMiddleware as (
          req: Request,
          res: Response,
          next: NextFunction
        ) => Promise<void>
      )(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized: Invalid or missing API key',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when validateApiKey returns false (invalid key)', async () => {
      vi.mocked(extractApiKey).mockReturnValue('bad-key');
      vi.mocked(validateApiKey).mockReturnValue(false);

      const router = createMcpRouter();
      const { authMiddleware } = getRouteHandlers(router);

      const req = createMockReq({
        headers: { authorization: 'Bearer bad-key' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await (
        authMiddleware as (
          req: Request,
          res: Response,
          next: NextFunction
        ) => Promise<void>
      )(req, res, next);

      expect(extractApiKey).toHaveBeenCalledWith(req);
      expect(validateApiKey).toHaveBeenCalledWith('bad-key');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized: Invalid or missing API key',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() and sets req.user when API key is valid and user resolves', async () => {
      const mockUser = { id: 42, email: 'user@test.com' };
      vi.mocked(extractApiKey).mockReturnValue('valid-key');
      vi.mocked(validateApiKey).mockReturnValue(true);
      vi.mocked(resolveUser).mockResolvedValue(mockUser as never);

      const router = createMcpRouter();
      const { authMiddleware } = getRouteHandlers(router);

      const req = createMockReq({
        headers: { authorization: 'Bearer valid-key' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await (
        authMiddleware as (
          req: Request,
          res: Response,
          next: NextFunction
        ) => Promise<void>
      )(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect((req as unknown as { user: unknown }).user).toBe(mockUser);
    });

    it('calls next() without setting req.user when resolveUser returns null', async () => {
      vi.mocked(extractApiKey).mockReturnValue('valid-key');
      vi.mocked(validateApiKey).mockReturnValue(true);
      vi.mocked(resolveUser).mockResolvedValue(null as never);

      const router = createMcpRouter();
      const { authMiddleware } = getRouteHandlers(router);

      const req = createMockReq({
        headers: { authorization: 'Bearer valid-key' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await (
        authMiddleware as (
          req: Request,
          res: Response,
          next: NextFunction
        ) => Promise<void>
      )(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect((req as unknown as { user: unknown }).user).toBeUndefined();
    });

    it('passes x-api-user header as numeric userId to resolveUser', async () => {
      vi.mocked(extractApiKey).mockReturnValue('valid-key');
      vi.mocked(validateApiKey).mockReturnValue(true);
      vi.mocked(resolveUser).mockResolvedValue(null as never);

      const router = createMcpRouter();
      const { authMiddleware } = getRouteHandlers(router);

      const req = createMockReq({
        headers: { authorization: 'Bearer valid-key', 'x-api-user': '7' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await (
        authMiddleware as (
          req: Request,
          res: Response,
          next: NextFunction
        ) => Promise<void>
      )(req, res, next);

      expect(resolveUser).toHaveBeenCalledWith(7);
    });

    it('passes undefined userId to resolveUser when x-api-user header is absent', async () => {
      vi.mocked(extractApiKey).mockReturnValue('valid-key');
      vi.mocked(validateApiKey).mockReturnValue(true);
      vi.mocked(resolveUser).mockResolvedValue(null as never);

      const router = createMcpRouter();
      const { authMiddleware } = getRouteHandlers(router);

      const req = createMockReq({
        headers: { authorization: 'Bearer valid-key' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await (
        authMiddleware as (
          req: Request,
          res: Response,
          next: NextFunction
        ) => Promise<void>
      )(req, res, next);

      expect(resolveUser).toHaveBeenCalledWith(undefined);
    });
  });

  describe('POST handler', () => {
    it('returns 400 when no session ID and not an initialize request', async () => {
      vi.mocked(isInitializeRequest).mockReturnValue(false);

      const router = createMcpRouter();
      const { postHandler } = getRouteHandlers(router);

      const req = createMockReq({
        body: { jsonrpc: '2.0', method: 'tools/list' },
      });
      const res = createMockRes();

      await (postHandler as (req: Request, res: Response) => Promise<void>)(
        req,
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error:
          'Invalid request: missing session ID or not an initialize request',
      });
    });

    it('returns 400 when session ID is present but session does not exist', async () => {
      vi.mocked(isInitializeRequest).mockReturnValue(false);

      const router = createMcpRouter();
      const { postHandler } = getRouteHandlers(router);

      const req = createMockReq({
        headers: { 'mcp-session-id': 'nonexistent-session-id' },
        body: { jsonrpc: '2.0', method: 'tools/list' },
      });
      const res = createMockRes();

      await (postHandler as (req: Request, res: Response) => Promise<void>)(
        req,
        res
      );

      // When a session ID is provided but not found in the transports map,
      // it falls through to the initialize check, which also fails, so returns 400.
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates a new session and handles an initialize request', async () => {
      vi.mocked(isInitializeRequest).mockReturnValue(true);

      const mockTransport = {
        handleRequest: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        onclose: null as (() => void) | null,
      };
      vi.mocked(StreamableHTTPServerTransport).mockImplementationOnce(function (
        this: unknown
      ) {
        return Object.assign(this as object, mockTransport) as never;
      });

      const mockServer = { connect: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(createMcpServer).mockReturnValueOnce(mockServer as never);

      const router = createMcpRouter();
      const { postHandler } = getRouteHandlers(router);

      const body = { jsonrpc: '2.0', method: 'initialize', params: {} };
      const req = createMockReq({ body });
      const res = createMockRes();

      await (postHandler as (req: Request, res: Response) => Promise<void>)(
        req,
        res
      );

      expect(StreamableHTTPServerTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionIdGenerator: expect.any(Function),
          onsessioninitialized: expect.any(Function),
        })
      );
      expect(mockServer.connect).toHaveBeenCalled();
      expect(mockTransport.handleRequest).toHaveBeenCalledWith(req, res, body);
    });

    it('invokes onsessioninitialized callback which logs and registers the session', async () => {
      vi.mocked(isInitializeRequest).mockReturnValue(true);

      let capturedOnsessioninitialized: ((sid: string) => void) | undefined;
      const mockTransport = {
        handleRequest: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        onclose: null as (() => void) | null,
      };
      vi.mocked(StreamableHTTPServerTransport).mockImplementationOnce(function (
        this: unknown,
        opts: Record<string, unknown>
      ) {
        capturedOnsessioninitialized = (
          opts as { onsessioninitialized: (sid: string) => void }
        ).onsessioninitialized;
        return Object.assign(this as object, mockTransport) as never;
      } as never);

      vi.mocked(createMcpServer).mockReturnValueOnce({
        connect: vi.fn().mockResolvedValue(undefined),
      } as never);

      const router = createMcpRouter();
      const { postHandler } = getRouteHandlers(router);

      const req = createMockReq({
        body: { jsonrpc: '2.0', method: 'initialize' },
      });
      const res = createMockRes();

      await (postHandler as (req: Request, res: Response) => Promise<void>)(
        req,
        res
      );

      expect(capturedOnsessioninitialized).toBeDefined();

      // Trigger the callback to verify logger.debug is called
      capturedOnsessioninitialized!('test-session-abc');

      expect(logger.debug).toHaveBeenCalledWith(
        'MCP: Session initialized: test-session-abc',
        { label: 'MCP' }
      );
    });

    it('handles existing session by reusing the stored transport', async () => {
      vi.mocked(isInitializeRequest).mockReturnValue(true);

      // First, create a session via initialize
      let capturedOnsessioninitialized: ((sid: string) => void) | undefined;
      const mockTransport = {
        handleRequest: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        onclose: null as (() => void) | null,
      };
      vi.mocked(StreamableHTTPServerTransport).mockImplementationOnce(function (
        this: unknown,
        opts: Record<string, unknown>
      ) {
        capturedOnsessioninitialized = (
          opts as { onsessioninitialized: (sid: string) => void }
        ).onsessioninitialized;
        return Object.assign(this as object, mockTransport) as never;
      } as never);
      vi.mocked(createMcpServer).mockReturnValueOnce({
        connect: vi.fn().mockResolvedValue(undefined),
      } as never);

      const router = createMcpRouter();
      const { postHandler } = getRouteHandlers(router);

      const initReq = createMockReq({
        body: { jsonrpc: '2.0', method: 'initialize' },
      });
      const initRes = createMockRes();
      await (postHandler as (req: Request, res: Response) => Promise<void>)(
        initReq,
        initRes
      );

      // Simulate the session being registered
      capturedOnsessioninitialized!('my-session-id');

      // Now send a follow-up request using the session ID
      vi.mocked(isInitializeRequest).mockReturnValue(false);
      mockTransport.handleRequest.mockClear();

      const followReq = createMockReq({
        headers: { 'mcp-session-id': 'my-session-id' },
        body: { jsonrpc: '2.0', method: 'tools/list' },
      });
      const followRes = createMockRes();

      await (postHandler as (req: Request, res: Response) => Promise<void>)(
        followReq,
        followRes
      );

      expect(mockTransport.handleRequest).toHaveBeenCalledWith(
        followReq,
        followRes,
        followReq.body
      );
    });
  });

  describe('GET handler', () => {
    it('returns 400 when no session ID header is provided', async () => {
      const router = createMcpRouter();
      const { getHandler } = getRouteHandlers(router);

      const req = createMockReq();
      const res = createMockRes();

      await (getHandler as (req: Request, res: Response) => Promise<void>)(
        req,
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or missing session ID',
      });
    });

    it('returns 400 when session ID header is present but session does not exist', async () => {
      const router = createMcpRouter();
      const { getHandler } = getRouteHandlers(router);

      const req = createMockReq({
        headers: { 'mcp-session-id': 'unknown-session' },
      });
      const res = createMockRes();

      await (getHandler as (req: Request, res: Response) => Promise<void>)(
        req,
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or missing session ID',
      });
    });

    it('delegates to transport.handleRequest when session exists', async () => {
      vi.mocked(isInitializeRequest).mockReturnValue(true);

      let capturedOnsessioninitialized: ((sid: string) => void) | undefined;
      const mockTransport = {
        handleRequest: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        onclose: null as (() => void) | null,
      };
      vi.mocked(StreamableHTTPServerTransport).mockImplementationOnce(function (
        this: unknown,
        opts: Record<string, unknown>
      ) {
        capturedOnsessioninitialized = (
          opts as { onsessioninitialized: (sid: string) => void }
        ).onsessioninitialized;
        return Object.assign(this as object, mockTransport) as never;
      } as never);
      vi.mocked(createMcpServer).mockReturnValueOnce({
        connect: vi.fn().mockResolvedValue(undefined),
      } as never);

      const router = createMcpRouter();
      const { postHandler, getHandler } = getRouteHandlers(router);

      // Create the session first
      const initReq = createMockReq({
        body: { jsonrpc: '2.0', method: 'initialize' },
      });
      await (postHandler as (req: Request, res: Response) => Promise<void>)(
        initReq,
        createMockRes()
      );
      capturedOnsessioninitialized!('get-test-session');

      // Now do a GET with the session ID
      mockTransport.handleRequest.mockClear();
      const getReq = createMockReq({
        headers: { 'mcp-session-id': 'get-test-session' },
      });
      const getRes = createMockRes();

      await (getHandler as (req: Request, res: Response) => Promise<void>)(
        getReq,
        getRes
      );

      expect(mockTransport.handleRequest).toHaveBeenCalledWith(getReq, getRes);
      expect(getRes.status).not.toHaveBeenCalled();
    });
  });

  describe('DELETE handler', () => {
    it('returns 200 even when no session ID is provided', async () => {
      const router = createMcpRouter();
      const { deleteHandler } = getRouteHandlers(router);

      const req = createMockReq();
      const res = createMockRes();

      await (deleteHandler as (req: Request, res: Response) => Promise<void>)(
        req,
        res
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
    });

    it('returns 200 when session ID is provided but session does not exist', async () => {
      const router = createMcpRouter();
      const { deleteHandler } = getRouteHandlers(router);

      const req = createMockReq({
        headers: { 'mcp-session-id': 'ghost-session' },
      });
      const res = createMockRes();

      await (deleteHandler as (req: Request, res: Response) => Promise<void>)(
        req,
        res
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
    });

    it('closes and removes an existing session, then returns 200', async () => {
      vi.mocked(isInitializeRequest).mockReturnValue(true);

      let capturedOnsessioninitialized: ((sid: string) => void) | undefined;
      const mockTransport = {
        handleRequest: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        onclose: null as (() => void) | null,
      };
      vi.mocked(StreamableHTTPServerTransport).mockImplementationOnce(function (
        this: unknown,
        opts: Record<string, unknown>
      ) {
        capturedOnsessioninitialized = (
          opts as { onsessioninitialized: (sid: string) => void }
        ).onsessioninitialized;
        return Object.assign(this as object, mockTransport) as never;
      } as never);
      vi.mocked(createMcpServer).mockReturnValueOnce({
        connect: vi.fn().mockResolvedValue(undefined),
      } as never);

      const router = createMcpRouter();
      const { postHandler, deleteHandler } = getRouteHandlers(router);

      // Establish session
      const initReq = createMockReq({
        body: { jsonrpc: '2.0', method: 'initialize' },
      });
      await (postHandler as (req: Request, res: Response) => Promise<void>)(
        initReq,
        createMockRes()
      );
      capturedOnsessioninitialized!('delete-test-session');

      // Delete the session
      const delReq = createMockReq({
        headers: { 'mcp-session-id': 'delete-test-session' },
      });
      const delRes = createMockRes();

      await (deleteHandler as (req: Request, res: Response) => Promise<void>)(
        delReq,
        delRes
      );

      expect(mockTransport.close).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'MCP: Session terminated: delete-test-session',
        { label: 'MCP' }
      );
      expect(delRes.status).toHaveBeenCalledWith(200);
      expect(delRes.end).toHaveBeenCalled();
    });

    it('session is removed from map after DELETE, subsequent GET returns 400', async () => {
      vi.mocked(isInitializeRequest).mockReturnValue(true);

      let capturedOnsessioninitialized: ((sid: string) => void) | undefined;
      const mockTransport = {
        handleRequest: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        onclose: null as (() => void) | null,
      };
      vi.mocked(StreamableHTTPServerTransport).mockImplementationOnce(function (
        this: unknown,
        opts: Record<string, unknown>
      ) {
        capturedOnsessioninitialized = (
          opts as { onsessioninitialized: (sid: string) => void }
        ).onsessioninitialized;
        return Object.assign(this as object, mockTransport) as never;
      } as never);
      vi.mocked(createMcpServer).mockReturnValueOnce({
        connect: vi.fn().mockResolvedValue(undefined),
      } as never);

      const router = createMcpRouter();
      const { postHandler, deleteHandler, getHandler } =
        getRouteHandlers(router);

      // Create session
      const initReq = createMockReq({ body: {} });
      await (postHandler as (req: Request, res: Response) => Promise<void>)(
        initReq,
        createMockRes()
      );
      capturedOnsessioninitialized!('cleanup-session');

      // Delete it
      const delReq = createMockReq({
        headers: { 'mcp-session-id': 'cleanup-session' },
      });
      await (deleteHandler as (req: Request, res: Response) => Promise<void>)(
        delReq,
        createMockRes()
      );

      // Now try to GET — should return 400 because session no longer exists
      const getReq = createMockReq({
        headers: { 'mcp-session-id': 'cleanup-session' },
      });
      const getRes = createMockRes();

      vi.mocked(isInitializeRequest).mockReturnValue(false);
      await (getHandler as (req: Request, res: Response) => Promise<void>)(
        getReq,
        getRes
      );

      expect(getRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('transport onclose callback', () => {
    it('removes session from the map when transport closes and logs debug', async () => {
      vi.mocked(isInitializeRequest).mockReturnValue(true);

      let capturedOnsessioninitialized: ((sid: string) => void) | undefined;
      const mockTransport = {
        handleRequest: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        onclose: null as (() => void) | null,
      };
      vi.mocked(StreamableHTTPServerTransport).mockImplementationOnce(function (
        this: unknown,
        opts: Record<string, unknown>
      ) {
        capturedOnsessioninitialized = (
          opts as { onsessioninitialized: (sid: string) => void }
        ).onsessioninitialized;
        return Object.assign(this as object, mockTransport) as never;
      } as never);
      vi.mocked(createMcpServer).mockReturnValueOnce({
        connect: vi.fn().mockResolvedValue(undefined),
      } as never);

      const router = createMcpRouter();
      const { postHandler, getHandler } = getRouteHandlers(router);

      // Establish the session
      await (postHandler as (req: Request, res: Response) => Promise<void>)(
        createMockReq({ body: { jsonrpc: '2.0', method: 'initialize' } }),
        createMockRes()
      );
      capturedOnsessioninitialized!('onclose-session');

      // Trigger the onclose callback - it's set on the constructed instance, not mockTransport
      const constructedTransport = vi.mocked(StreamableHTTPServerTransport).mock
        .instances[
        vi.mocked(StreamableHTTPServerTransport).mock.instances.length - 1
      ] as unknown as { onclose: (() => void) | null };
      expect(constructedTransport.onclose).toBeTypeOf('function');
      constructedTransport.onclose!();

      expect(logger.debug).toHaveBeenCalledWith(
        'MCP: Session closed: onclose-session',
        { label: 'MCP' }
      );

      // Confirm the session is gone — GET should now return 400
      vi.mocked(isInitializeRequest).mockReturnValue(false);
      const getReq = createMockReq({
        headers: { 'mcp-session-id': 'onclose-session' },
      });
      const getRes = createMockRes();
      await (getHandler as (req: Request, res: Response) => Promise<void>)(
        getReq,
        getRes
      );

      expect(getRes.status).toHaveBeenCalledWith(400);
    });
  });
});
