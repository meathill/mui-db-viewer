import { request } from './api-request';
import type { CreateSavedQueryRequest, SavedQuery } from './api-types';

export const savedQueries = {
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
};
