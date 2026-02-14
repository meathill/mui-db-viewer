import type { RowUpdate, TableColumn, TableQueryOptions, TableQueryResult } from '../../types';

export interface IDatabaseDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string): Promise<Array<Record<string, unknown>>>;
  getTables(): Promise<string[]>;
  getTableSchema(tableName: string): Promise<TableColumn[]>;
  getTableData(tableName: string, options?: TableQueryOptions): Promise<TableQueryResult>;
  deleteRows(tableName: string, ids: Array<string | number>): Promise<{ success: boolean; count: number }>;
  insertRow(tableName: string, data: Record<string, unknown>): Promise<{ success: boolean }>;
  updateRows(tableName: string, rows: RowUpdate[]): Promise<{ success: boolean; count: number }>;
}
