import type { TraktProfile, TraktTokenSet } from '@server/api/trakt';
import dataSource, { getRepository } from '@server/datasource';
import {
  TraktConnection,
  TraktConnectionStatus,
} from '@server/entity/TraktConnection';
import type { EntityManager } from 'typeorm';

type ConnectionSelector = { userId: number } | { connectionId: number };

class TraktConnectionRepository {
  public runInTransaction<T>(
    operation: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    return dataSource.transaction(operation);
  }

  public async invalidateAll(manager: EntityManager): Promise<number> {
    const result = await manager
      .getRepository(TraktConnection)
      .createQueryBuilder()
      .update(TraktConnection)
      .set({
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
        tokenVersion: () => '"tokenVersion" + 1',
      })
      .execute();
    return result.affected ?? 0;
  }

  public findWithTokens(
    selector: ConnectionSelector
  ): Promise<TraktConnection | null> {
    const query = getRepository(TraktConnection)
      .createQueryBuilder('connection')
      .addSelect(['connection.accessToken', 'connection.refreshToken']);

    return 'userId' in selector
      ? query
          .where('connection.userId = :userId', { userId: selector.userId })
          .getOne()
      : query
          .where('connection.id = :connectionId', {
            connectionId: selector.connectionId,
          })
          .getOne();
  }

  /**
   * Scoped to the version that was read, so an unlink that raced a reconnect cannot
   * delete the reconnected row. Returns whether the row was removed.
   */
  public async deleteAtVersion(
    connectionId: number,
    tokenVersion: number
  ): Promise<boolean> {
    const result = await getRepository(TraktConnection).delete({
      id: connectionId,
      tokenVersion,
    });

    return (result.affected ?? 0) > 0;
  }

  public delete(connectionId: number): Promise<unknown> {
    return getRepository(TraktConnection).delete({ id: connectionId });
  }

  public findByUserId(
    manager: EntityManager,
    userId: number
  ): Promise<TraktConnection | null> {
    return manager.getRepository(TraktConnection).findOne({
      where: { userId },
    });
  }

  public findByTraktUserId(
    manager: EntityManager,
    traktUserId: string
  ): Promise<TraktConnection | null> {
    return manager.getRepository(TraktConnection).findOne({
      where: { traktUserId },
    });
  }

  public create(
    manager: EntityManager,
    input: { userId: number; traktUserId: string; tokenVersion: number }
  ): TraktConnection {
    return manager.getRepository(TraktConnection).create(input);
  }

  public saveCompletion(
    manager: EntityManager,
    connection: TraktConnection,
    input: {
      actorUserId: number;
      profile: TraktProfile;
      tokens: TraktTokenSet;
      now: Date;
    }
  ): Promise<TraktConnection> {
    connection.traktUserId = input.profile.traktUserId;
    connection.username = input.profile.username;
    connection.slug = input.profile.slug;
    connection.displayName = input.profile.displayName;
    connection.status = TraktConnectionStatus.ACTIVE;
    connection.accessToken = input.tokens.accessToken;
    connection.refreshToken = input.tokens.refreshToken;
    connection.expiresAt = input.tokens.expiresAt;
    connection.connectedByUserId = input.actorUserId;
    connection.lastValidatedAt = input.now;
    connection.tokenVersion += 1;
    return manager.getRepository(TraktConnection).save(connection);
  }

  public invalidateTokens(
    connection: TraktConnection
  ): Promise<{ affected?: number | null }> {
    return getRepository(TraktConnection).update(
      {
        id: connection.id,
        tokenVersion: connection.tokenVersion,
      },
      {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        tokenVersion: connection.tokenVersion + 1,
        status: TraktConnectionStatus.RECONNECT_REQUIRED,
      }
    );
  }

  public replaceTokens(
    connection: TraktConnection,
    replacement: TraktTokenSet
  ): Promise<{ affected?: number | null }> {
    return getRepository(TraktConnection).update(
      {
        id: connection.id,
        tokenVersion: connection.tokenVersion,
      },
      {
        accessToken: replacement.accessToken,
        refreshToken: replacement.refreshToken,
        expiresAt: replacement.expiresAt,
        tokenVersion: connection.tokenVersion + 1,
        status: TraktConnectionStatus.ACTIVE,
      }
    );
  }

  public async markValidated(input: {
    connectionId: number;
    tokenVersion: number;
  }): Promise<void> {
    await getRepository(TraktConnection).update(
      {
        id: input.connectionId,
        tokenVersion: input.tokenVersion,
        status: TraktConnectionStatus.ACTIVE,
      },
      { lastValidatedAt: new Date() }
    );
  }
}

export const traktConnectionRepository = new TraktConnectionRepository();
