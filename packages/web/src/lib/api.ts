/**
 * API 客户端
 * 封装与 Worker 后端的交互
 */

import { useSettingsStore } from '@/stores/settings-store';
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

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface FileBrowseResult {
  currentPath: string;
  parentPath: string;
  files: FileEntry[];
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

export interface DatabaseSchemaContext {
  schema: string;
  updatedAt: number;
  expiresAt: number;
  cached: boolean;
}

export interface RowUpdate {
  pk: string | number;
  data: Record<string, unknown>;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sql: string;
  databaseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedQueryRequest {
  name: string;
  description?: string;
  sql: string;
  databaseId: string;
}

export type QuerySessionMessageRole = 'user' | 'assistant';

export interface QuerySession {
  id: string;
  databaseId: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuerySessionMessage {
  id: string;
  sessionId: string;
  sequence: number;
  role: QuerySessionMessageRole;
  content: string;
  sql?: string;
  warning?: string;
  error?: string;
  createdAt: string;
}

export interface QuerySessionCursor {
  updatedAt: string;
  id: string;
}

export interface QuerySessionListResponse {
  sessions: QuerySession[];
  nextCursor: QuerySessionCursor | null;
  hasMore: boolean;
}

export interface QuerySessionDetailResponse {
  session: QuerySession;
  messages: QuerySessionMessage[];
}

export interface CreateQuerySessionRequest {
  databaseId: string;
  title: string;
  preview?: string;
  messages?: Array<{
    id: string;
    role: QuerySessionMessageRole;
    content: string;
    sql?: string;
    warning?: string;
    error?: string;
  }>;
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
  },

  query: {
    async generate(
      databaseId: string,
      prompt: string,
    ): Promise<{ sql: string; explanation?: string; warning?: string }> {
      const {
        provider,
        openaiApiKey,
        openaiModel,
        openaiBaseUrl,
        geminiApiKey,
        geminiModel,
        replicateApiKey,
        replicateModel,
      } = useSettingsStore.getState();

      const payload: Record<string, unknown> = {
        databaseId,
        prompt,
        provider,
      };

      if (provider === 'openai') {
        if (openaiApiKey) payload.apiKey = openaiApiKey;
        if (openaiModel) payload.model = openaiModel;
        if (openaiBaseUrl) payload.baseUrl = openaiBaseUrl;
      } else if (provider === 'gemini') {
        if (geminiApiKey) payload.apiKey = geminiApiKey;
        if (geminiModel) payload.model = geminiModel;
      } else if (provider === 'replicate') {
        if (replicateApiKey) payload.apiKey = replicateApiKey;
        if (replicateModel) payload.model = replicateModel;
      }

      const result = await request<{ sql: string; explanation?: string; warning?: string }>(
        'POST',
        '/api/v1/query/generate',
        payload,
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

    async execute(databaseId: string, sql: string): Promise<TableDataResult> {
      const result = await request<TableDataResult>('POST', `/api/v1/databases/${databaseId}/query`, {
        sql,
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || '执行 SQL 失败');
      }
      return result.data;
    },
  },

  files: {
    async browse(dirPath?: string): Promise<FileBrowseResult> {
      const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
      const result = await request<FileBrowseResult>('GET', `/api/v1/files${params}`);
      if (!result.success || !result.data) {
        throw new Error(result.error || '读取目录失败');
      }
      return result.data;
    },
  },

  savedQueries: {
    async create(data: CreateSavedQueryRequest): Promise<SavedQuery> {
      const result = await request<SavedQuery>('POST', '/api/v1/saved-queries', data);
      if (!result.success || !result.data) {
        throw new Error(result.error || '创建失败');
      }
      return result.data;
    },

    async list(databaseId?: string): Promise<SavedQuery[]> {
      const params = databaseId ? `?databaseId=${databaseId}` : '';
      const result = await request<SavedQuery[]>('GET', `/api/v1/saved-queries${params}`);
      if (!result.success || !result.data) {
        throw new Error(result.error || '获取列表失败');
      }
      return result.data;
    },

    async delete(id: string): Promise<void> {
      const result = await request('DELETE', `/api/v1/saved-queries/${id}`);
      if (!result.success) {
        throw new Error(result.error || '删除失败');
      }
    },
  },

  querySessions: {
    async create(payload: CreateQuerySessionRequest): Promise<QuerySession> {
      const result = await request<{ session: QuerySession }>('POST', '/api/v1/query-sessions', payload);
      if (!result.success || !result.data) {
        throw new Error(result.error || '创建失败');
      }
      return result.data.session;
    },

    async list(options?: {
      limit?: number;
      q?: string;
      databaseId?: string;
      cursor?: QuerySessionCursor | null;
    }): Promise<QuerySessionListResponse> {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.q) params.set('q', options.q);
      if (options?.databaseId) params.set('databaseId', options.databaseId);
      if (options?.cursor?.updatedAt) params.set('cursorUpdatedAt', options.cursor.updatedAt);
      if (options?.cursor?.id) params.set('cursorId', options.cursor.id);

      const result = await request<QuerySessionListResponse>(
        'GET',
        `/api/v1/query-sessions${params.size > 0 ? `?${params.toString()}` : ''}`,
      );
      if (!result.success || !result.data) {
        throw new Error(result.error || '获取列表失败');
      }
      return result.data;
    },

    async get(id: string): Promise<QuerySessionDetailResponse> {
      const result = await request<QuerySessionDetailResponse>('GET', `/api/v1/query-sessions/${id}`);
      if (!result.success || !result.data) {
        throw new Error(result.error || '获取详情失败');
      }
      return result.data;
    },

    async appendMessages(
      id: string,
      messages: Array<{
        id: string;
        role: QuerySessionMessageRole;
        content: string;
        sql?: string;
        warning?: string;
        error?: string;
      }>,
    ): Promise<void> {
      const result = await request('POST', `/api/v1/query-sessions/${id}/messages`, { messages });
      if (!result.success) {
        throw new Error(result.error || '保存失败');
      }
    },

    async rename(id: string, title: string): Promise<QuerySession> {
      const result = await request<{ session: QuerySession }>('PATCH', `/api/v1/query-sessions/${id}`, { title });
      if (!result.success || !result.data) {
        throw new Error(result.error || '重命名失败');
      }
      return result.data.session;
    },

    async delete(id: string): Promise<void> {
      const result = await request('DELETE', `/api/v1/query-sessions/${id}`);
      if (!result.success) {
        throw new Error(result.error || '删除失败');
      }
    },
  },
};
