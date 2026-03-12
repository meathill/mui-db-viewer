import { describe, expect, it } from 'vitest';
import { querySessions } from '@/lib/api-query-sessions';
import { mockFetch, mockFetchJsonOnce } from './api-test-helpers';

describe('api.querySessions', () => {
  it('create 成功返回 session', async () => {
    const session = {
      id: 's-1',
      databaseId: 'db-1',
      title: '查询用户',
      preview: '查询用户',
      createdAt: '2026-03-11T00:00:00.000Z',
      updatedAt: '2026-03-11T00:00:00.000Z',
    };
    mockFetchJsonOnce({ success: true, data: { session } });

    await expect(
      querySessions.create({
        databaseId: 'db-1',
        title: '查询用户',
      }),
    ).resolves.toEqual(session);
  });

  it('list 应序列化分页、搜索与 cursor 参数', async () => {
    mockFetchJsonOnce({
      success: true,
      data: {
        sessions: [],
        nextCursor: null,
        hasMore: false,
      },
    });

    await querySessions.list({
      limit: 20,
      q: 'orders',
      databaseId: 'db-2',
      cursor: {
        updatedAt: '2026-03-11T00:00:00.000Z',
        id: 's-20',
      },
    });

    const url = String(mockFetch.mock.calls[0]?.[0]);
    expect(url).toContain('/api/v1/query-sessions?');
    expect(url).toContain('limit=20');
    expect(url).toContain('q=orders');
    expect(url).toContain('databaseId=db-2');
    expect(url).toContain('cursorUpdatedAt=2026-03-11T00%3A00%3A00.000Z');
    expect(url).toContain('cursorId=s-20');
  });

  it('get 失败时抛出默认文案', async () => {
    mockFetchJsonOnce({ success: false });

    await expect(querySessions.get('missing')).rejects.toThrow('获取详情失败');
  });

  it('appendMessages 失败时抛错', async () => {
    mockFetchJsonOnce({ success: false, error: '保存失败' });

    await expect(
      querySessions.appendMessages('s-1', [
        {
          id: 'm-1',
          role: 'assistant',
          content: '已生成 SQL',
          sql: 'SELECT 1',
        },
      ]),
    ).rejects.toThrow('保存失败');
  });

  it('rename 成功返回更新后的 session', async () => {
    const session = {
      id: 's-1',
      databaseId: 'db-1',
      title: '新标题',
      preview: 'preview',
      createdAt: '2026-03-11T00:00:00.000Z',
      updatedAt: '2026-03-11T00:01:00.000Z',
    };
    mockFetchJsonOnce({ success: true, data: { session } });

    await expect(querySessions.rename('s-1', '新标题')).resolves.toEqual(session);
  });

  it('delete 成功结束且使用 DELETE 方法', async () => {
    mockFetchJsonOnce({ success: true });

    await expect(querySessions.delete('s-1')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/query-sessions/s-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
