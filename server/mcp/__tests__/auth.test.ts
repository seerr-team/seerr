import { Permission } from '@server/lib/permissions';
import {
  authenticateMcpRequest,
  checkPermission,
  extractApiKey,
  permissionDenied,
  resolveUser,
  validateApiKey,
} from '@server/mcp/auth';
import type { IncomingMessage } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockUser } from './setup';

// Mock dependencies
vi.mock('@server/lib/settings', () => ({
  getSettings: vi.fn(() => ({
    main: { apiKey: 'test-api-key-123' },
  })),
}));

vi.mock('@server/datasource', () => ({
  getRepository: vi.fn(),
}));

vi.mock('@server/entity/User', () => ({
  User: class {},
}));

vi.mock('@server/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('auth', () => {
  describe('validateApiKey', () => {
    it('returns true for a valid API key', () => {
      expect(validateApiKey('test-api-key-123')).toBe(true);
    });

    it('returns false for an invalid API key', () => {
      expect(validateApiKey('wrong-key')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(validateApiKey('')).toBe(false);
    });
  });

  describe('extractApiKey', () => {
    function mockRequest(headers: Record<string, string | undefined>) {
      return { headers } as unknown as IncomingMessage;
    }

    it('extracts from Authorization Bearer header', () => {
      const req = mockRequest({ authorization: 'Bearer my-key-456' });
      expect(extractApiKey(req)).toBe('my-key-456');
    });

    it('extracts from X-Api-Key header', () => {
      const req = mockRequest({ 'x-api-key': 'header-key-789' });
      expect(extractApiKey(req)).toBe('header-key-789');
    });

    it('prefers Authorization header over X-Api-Key', () => {
      const req = mockRequest({
        authorization: 'Bearer bearer-key',
        'x-api-key': 'x-key',
      });
      expect(extractApiKey(req)).toBe('bearer-key');
    });

    it('returns undefined when no auth headers are present', () => {
      const req = mockRequest({});
      expect(extractApiKey(req)).toBeUndefined();
    });

    it('returns undefined for non-Bearer Authorization', () => {
      const req = mockRequest({ authorization: 'Basic abc123' });
      expect(extractApiKey(req)).toBeUndefined();
    });
  });

  describe('resolveUser', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns user from repository', async () => {
      const mockUser = createMockUser({ id: 5 });
      const { getRepository } = await import('@server/datasource');
      vi.mocked(getRepository).mockReturnValue({
        findOne: vi.fn().mockResolvedValue(mockUser),
      } as never);

      const user = await resolveUser(5);
      expect(user).toBe(mockUser);
    });

    it('defaults to user id 1 when no userId provided', async () => {
      const mockUser = createMockUser({ id: 1 });
      const findOne = vi.fn().mockResolvedValue(mockUser);
      const { getRepository } = await import('@server/datasource');
      vi.mocked(getRepository).mockReturnValue({ findOne } as never);

      await resolveUser();
      expect(findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('returns null when user not found', async () => {
      const { getRepository } = await import('@server/datasource');
      vi.mocked(getRepository).mockReturnValue({
        findOne: vi.fn().mockResolvedValue(null),
      } as never);

      const user = await resolveUser(999);
      expect(user).toBeNull();
    });
  });

  describe('checkPermission', () => {
    it('returns true when admin user checks any permission', () => {
      const admin = createMockUser({ permissions: Permission.ADMIN });
      expect(checkPermission(admin, Permission.MANAGE_REQUESTS)).toBe(true);
    });

    it('returns true when user has the required permission', () => {
      const user = createMockUser({
        permissions: Permission.MANAGE_REQUESTS,
      });
      expect(checkPermission(user, Permission.MANAGE_REQUESTS)).toBe(true);
    });

    it('returns false when user lacks the required permission', () => {
      const user = createMockUser({ permissions: Permission.REQUEST });
      expect(checkPermission(user, Permission.MANAGE_REQUESTS)).toBe(false);
    });

    it('supports array permissions with OR logic', () => {
      const user = createMockUser({
        permissions: Permission.MANAGE_SETTINGS,
      });
      expect(
        checkPermission(user, [Permission.ADMIN, Permission.MANAGE_SETTINGS], {
          type: 'or',
        })
      ).toBe(true);
    });
  });

  describe('permissionDenied', () => {
    it('returns correct error format', () => {
      const result = permissionDenied('MANAGE_REQUESTS');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Forbidden: This action requires the MANAGE_REQUESTS permission.',
          },
        ],
        isError: true,
      });
    });
  });

  describe('authenticateMcpRequest', () => {
    function mockRequest(headers: Record<string, string | undefined>) {
      return { headers } as unknown as IncomingMessage;
    }

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns null when API key is missing', async () => {
      const req = mockRequest({});
      const result = await authenticateMcpRequest(req);
      expect(result).toBeNull();
    });

    it('returns null when API key is invalid', async () => {
      const req = mockRequest({ 'x-api-key': 'wrong-key' });
      const result = await authenticateMcpRequest(req);
      expect(result).toBeNull();
    });

    it('returns user when API key is valid', async () => {
      const mockUser = createMockUser({ id: 1 });
      const { getRepository } = await import('@server/datasource');
      vi.mocked(getRepository).mockReturnValue({
        findOne: vi.fn().mockResolvedValue(mockUser),
      } as never);

      const req = mockRequest({ 'x-api-key': 'test-api-key-123' });
      const result = await authenticateMcpRequest(req);
      expect(result).toBe(mockUser);
    });

    it('passes x-api-user header as userId', async () => {
      const mockUser = createMockUser({ id: 42 });
      const findOne = vi.fn().mockResolvedValue(mockUser);
      const { getRepository } = await import('@server/datasource');
      vi.mocked(getRepository).mockReturnValue({ findOne } as never);

      const req = mockRequest({
        'x-api-key': 'test-api-key-123',
        'x-api-user': '42',
      });
      await authenticateMcpRequest(req);
      expect(findOne).toHaveBeenCalledWith({ where: { id: 42 } });
    });
  });
});
