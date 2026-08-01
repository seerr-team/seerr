import dataSource from '@server/datasource';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('data source entity discovery', () => {
  it('excludes colocated test modules from entity imports', () => {
    assert.deepEqual(dataSource.options.entities, [
      'server/entity/**/!(*.test).ts',
    ]);
  });
});
