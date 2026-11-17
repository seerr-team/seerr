import { isPgsql } from '@server/utils/dbType';
import type { ColumnOptions, ColumnType } from 'typeorm';
import { Column } from 'typeorm';
const pgTypeMapping: { [key: string]: ColumnType } = {
  datetime: 'timestamp with time zone',
};

export function resolveDbType(pgType: ColumnType): ColumnType {
  if (isPgsql && pgType.toString() in pgTypeMapping) {
    return pgTypeMapping[pgType.toString()];
  }
  return pgType;
}

export function DbAwareColumn(columnOptions: ColumnOptions) {
  if (columnOptions.type) {
    columnOptions.type = resolveDbType(columnOptions.type);
  }
  return Column(columnOptions);
}
