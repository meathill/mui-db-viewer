import type { TableColumn } from '../../types';

export function findPrimaryKeyField(schema: TableColumn[]): string | null {
  const primaryColumn = schema.find((column) => column.Key === 'PRI');
  return primaryColumn?.Field ?? null;
}

export function getColumnFieldNames(schema: TableColumn[]): string[] {
  return schema.map((column) => column.Field);
}
