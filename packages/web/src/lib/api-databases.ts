import { request } from './api-request';
import { buildTableDataSearchParams, type TableQueryParams } from './table-query';
import type {
  CreateDatabaseRequest,
  DatabaseConnection,
  DatabaseSchemaContext,
  RowUpdate,
  TableDataResult,
} from './api-types';

export const databases = {
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

  async getSchema(id: string): Promise<DatabaseSchemaContext> {
    const result = await request<DatabaseSchemaContext>('GET', `/api/v1/databases/${id}/schema`);
    if (!result.success || !result.data) {
      throw new Error(result.error || '获取 Schema 失败');
    }
    return result.data;
  },

  async refreshSchema(id: string): Promise<DatabaseSchemaContext> {
    const result = await request<DatabaseSchemaContext>('POST', `/api/v1/databases/${id}/schema/refresh`);
    if (!result.success || !result.data) {
      throw new Error(result.error || '刷新 Schema 失败');
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
};
