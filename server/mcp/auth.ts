import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import type {
  Permission,
  PermissionCheckOptions,
} from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { IncomingMessage } from 'http';

/**
 * Validates an API key against the Seerr settings.
 * Returns true if the key matches the configured API key.
 */
export function validateApiKey(apiKey: string): boolean {
  const settings = getSettings();
  return apiKey === settings.main.apiKey;
}

/**
 * Extracts the API key from an HTTP request.
 * Supports both "Authorization: Bearer <key>" and "X-Api-Key: <key>" headers.
 */
export function extractApiKey(req: IncomingMessage): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string') {
    return xApiKey;
  }

  return undefined;
}

/**
 * Resolves a User entity for MCP operations.
 * If userId is provided, returns that user (acting on behalf).
 * Otherwise returns the admin user (id: 1).
 */
export async function resolveUser(userId?: number): Promise<User | null> {
  const userRepository = getRepository(User);
  const targetId = userId ?? 1;

  const user = await userRepository.findOne({ where: { id: targetId } });

  if (!user) {
    logger.warn(`MCP: Could not resolve user with ID ${targetId}`, {
      label: 'MCP',
    });
  }

  return user;
}

/**
 * Authenticates an incoming HTTP request for MCP.
 * Returns the resolved user if auth succeeds, null otherwise.
 */
export async function authenticateMcpRequest(
  req: IncomingMessage
): Promise<User | null> {
  const apiKey = extractApiKey(req);

  if (!apiKey || !validateApiKey(apiKey)) {
    logger.debug('MCP: Invalid or missing API key', { label: 'MCP' });
    return null;
  }

  const userIdHeader = req.headers['x-api-user'];
  const userId = userIdHeader ? Number(userIdHeader) : undefined;

  return resolveUser(userId);
}

/**
 * MCP tool result for permission denied errors.
 */
export function permissionDenied(permissionName: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `Forbidden: This action requires the ${permissionName} permission.`,
      },
    ],
    isError: true,
  };
}

/**
 * Checks if a user has the required permission(s).
 * Returns true if the user has access, false otherwise.
 * Admin users always pass permission checks.
 */
export function checkPermission(
  user: User,
  permissions: Permission | Permission[],
  options?: PermissionCheckOptions
): boolean {
  return user.hasPermission(permissions, options);
}
