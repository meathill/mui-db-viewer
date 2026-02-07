/**
 * API 客户端
 * 封装与 Worker 后端的交互
 */

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
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
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
