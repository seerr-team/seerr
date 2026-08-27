import type { TraktConnection } from '@server/entity/TraktConnection';
import type { TraktConnectionResponse } from '@server/interfaces/api/traktInterfaces';

export const toConnectionResponse = (
  connection: TraktConnection
): TraktConnectionResponse => ({
  userId: connection.userId,
  traktUserId: connection.traktUserId,
  traktUsername: connection.username ?? null,
  traktSlug: connection.slug ?? null,
  displayName: connection.displayName ?? null,
  status: connection.status,
  connectedByUserId: connection.connectedByUserId ?? null,
  lastValidatedAt: connection.lastValidatedAt?.toISOString() ?? null,
  createdAt: connection.createdAt.toISOString(),
  updatedAt: connection.updatedAt.toISOString(),
});
