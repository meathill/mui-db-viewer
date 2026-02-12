import type { DatabaseConnection } from '../../types';

export interface IDatabaseDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getTables(): Promise<string[]>;
  getTableSchema(tableName: string): Promise<any[]>;
  getTableData(
    tableName: string,
    options: {
      page?: number;
      pageSize?: number;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
      filters?: Record<string, any>;
    },
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  deleteRows(tableName: string, ids: any[]): Promise<{ success: boolean; count: number }>;
  insertRow(tableName: string, data: Record<string, any>): Promise<{ success: boolean }>;
  updateRows(
    tableName: string,
    rows: Array<{ pk: any; data: Record<string, any> }>,
  ): Promise<{ success: boolean; count: number }>;
}
