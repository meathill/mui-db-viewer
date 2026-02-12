import type { TableColumn, TableRow } from './api';

export function getPrimaryKeyField(columns: TableColumn[] | undefined): string | null {
  if (!columns) {
    return null;
  }

  const primaryKeyColumn = columns.find((column) => column.Key === 'PRI');
  return primaryKeyColumn?.Field ?? null;
}

export function resolveRowId(row: TableRow, primaryKey: string | null, index: number): string | number {
  if (!primaryKey) {
    return index;
  }

  const value = row[primaryKey];
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  return index;
}

export function formatCellValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

export function shouldSkipInsertColumn(column: TableColumn): boolean {
  return column.Extra === 'auto_increment' || (column.Key === 'PRI' && column.Extra === 'auto_increment');
}
