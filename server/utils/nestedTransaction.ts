import type { EntityManager } from 'typeorm';

// sqlite savepoints race on shared transactionDepth as it shares one query runner process-wide
// so nesting collides on savepoint counter, see https://github.com/typeorm/typeorm/issues/10209
// and later reverted by https://github.com/typeorm/typeorm/issues/11260
export const withNestedTransaction = <T>(
  manager: EntityManager,
  run: (manager: EntityManager) => Promise<T>
): Promise<T> =>
  manager.connection.options.type === 'sqlite'
    ? run(manager)
    : manager.transaction(run);
