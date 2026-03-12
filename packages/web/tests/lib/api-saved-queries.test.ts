import { describe, expect, it } from 'vitest';
import { savedQueries } from '@/lib/api-saved-queries';
import { mockFetch, mockFetchJsonOnce } from './api-test-helpers';

describe('api.savedQueries', () => {
  it('create 成功返回保存的查询', async () => {
    const item = {
      id: 'sq-1',
      name: '按状态查订单',
      sql: 'SELECT * FROM orders',
      databaseId: 'db-1',
      createdAt: '2026-03-11T00:00:00.000Z',
      updatedAt: '2026-03-11T00:00:00.000Z',
    };
    mockFetchJsonOnce({ success: true, data: item });

    await expect(
      savedQueries.create({
        name: '按状态查订单',
        sql: 'SELECT * FROM orders',
        databaseId: 'db-1',
      }),
    ).resolves.toEqual(item);
  });

  it('list 支持 databaseId 过滤', async () => {
    mockFetchJsonOnce({ success: true, data: [] });

    await savedQueries.list('db-9');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/saved-queries?databaseId=db-9'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('create 失败时使用默认文案', async () => {
    mockFetchJsonOnce({ success: false });

    await expect(
      savedQueries.create({
        name: '失败用例',
        sql: 'SELECT 1',
        databaseId: 'db-1',
      }),
    ).rejects.toThrow('创建失败');
  });

  it('delete 失败时抛错', async () => {
    mockFetchJsonOnce({ success: false, error: '删除失败' });

    await expect(savedQueries.delete('sq-1')).rejects.toThrow('删除失败');
  });
});
