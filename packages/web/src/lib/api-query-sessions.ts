import { request } from './api-request';
import type {
  CreateQuerySessionRequest,
  QuerySession,
  QuerySessionCursor,
  QuerySessionDetailResponse,
  QuerySessionListResponse,
  QuerySessionMessageRole,
} from './api-types';

export const querySessions = {
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
};
