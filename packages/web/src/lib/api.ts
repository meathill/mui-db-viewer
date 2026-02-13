/**
 * API 客户端
 * 封装与 Worker 后端的交互
 */

import { buildTableDataSearchParams, type TableQueryParams } from './table-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: string;
  database: string;
  username: string;
  keyPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDatabaseRequest {
  name: string;
  type: string;
  host?: string;
  port?: string;
  database: string;
  username?: string;
  password?: string;
}

export interface TableColumn {
  Field: string;
  Type: string;
  Null?: string;
  Key?: string;
  Default?: unknown;
  Extra?: string;
}

export type TableRow = Record<string, unknown>;

export interface TableDataResult<Row extends TableRow = TableRow> {
  rows: Row[];
  total: number;
  columns: TableColumn[];
}

export interface RowUpdate {
  pk: string | number;
  data: Record<string, unknown>;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response.json() as Promise<ApiResponse<T>>;
}

export const api = {
  databases: {
    async list(): Promise<DatabaseConnection[]> {
      const result = await request<DatabaseConnection[]>('GET', '/api/v1/databases');
      if (!result.success) {
        throw new Error(result.error || '获取数据库列表失败');
      }
      return result.data || [];
    },

    async create(data: CreateDatabaseRequest): Promise<DatabaseConnection> {
      const result = await request<DatabaseConnection>('POST', '/api/v1/databases', data);
      if (!result.success || !result.data) {
        throw new Error(result.error || '创建数据库连接失败');
      }
      return result.data;
    },

    async get(id: string): Promise<DatabaseConnection> {
      const result = await request<DatabaseConnection>('GET', `/api/v1/databases/${id}`);
      if (!result.success || !result.data) {
        throw new Error(result.error || '获取数据库连接失败');
      }
      return result.data;
    },

    async delete(id: string): Promise<void> {
      const result = await request('DELETE', `/api/v1/databases/${id}`);
      if (!result.success) {
        throw new Error(result.error || '删除数据库连接失败');
      }
    },

    async getTables(id: string): Promise<string[]> {
      const result = await request<string[]>('GET', `/api/v1/databases/${id}/tables`);
      if (!result.success || !result.data) {
        throw new Error(result.error || '获取表列表失败');
      }
      return result.data;
    },

    async getTableData(id: string, tableName: string, params: TableQueryParams = {}): Promise<TableDataResult> {
      const searchParams = buildTableDataSearchParams(params);
      const result = await request<TableDataResult>(
        'GET',
        `/api/v1/databases/${id}/tables/${tableName}/data?${searchParams.toString()}`,
      );
      if (!result.success || !result.data) {
        throw new Error(result.error || '获取表数据失败');
      }
      return result.data;
    },

    async deleteRows(id: string, tableName: string, ids: Array<string | number>): Promise<void> {
      const result = await request('POST', `/api/v1/databases/${id}/tables/${tableName}/rows/delete`, { ids });
      if (!result.success) {
        throw new Error(result.error || '删除失败');
      }
    },

    async insertRow(id: string, tableName: string, data: Record<string, unknown>): Promise<void> {
      const result = await request('POST', `/api/v1/databases/${id}/tables/${tableName}/rows`, data);
      if (!result.success) {
        throw new Error(result.error || '插入失败');
      }
    },

    async updateRows(id: string, tableName: string, rows: RowUpdate[]): Promise<void> {
      const result = await request('PUT', `/api/v1/databases/${id}/tables/${tableName}/rows`, { rows });
      if (!result.success) {
        throw new Error(result.error || '更新失败');
      }
    },
  },

  query: {
    async generate(
      databaseId: string,
      prompt: string,
    ): Promise<{ sql: string; explanation?: string; warning?: string }> {
      const result = await request<{ sql: string; explanation?: string; warning?: string }>(
        'POST',
        '/api/v1/query/generate',
        { databaseId, prompt },
      );
      if (!result.success || !result.data) {
        throw new Error(result.error || '生成 SQL 失败');
      }
      return result.data;
    },

    async validate(sql: string): Promise<{ valid: boolean; sql?: string; error?: string }> {
      const result = await request<{ valid: boolean; sql?: string; error?: string }>('POST', '/api/v1/query/validate', {
        sql,
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || '校验 SQL 失败');
      }
      return result.data;
    },
  },
};
