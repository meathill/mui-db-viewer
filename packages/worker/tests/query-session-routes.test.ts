/**
 * 查询会话历史路由测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuerySessionRouteTestClient } from './query-session-route-test-utils';

describe('Query Session Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /query-sessions 创建会话并可通过详情接口取回消息', async () => {
    const client = createQuerySessionRouteTestClient();
    const res = await client.request('/query-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        databaseId: 'db-1',
        title: '查询订单',
        messages: [
          { id: 'u-1', role: 'user', content: '查询订单' },
          { id: 'a-1', role: 'assistant', content: '已生成 SQL', sql: 'SELECT * FROM orders' },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      success: boolean;
      data?: { session: { id: string; title: string; databaseId: string; preview: string } };
    };
    expect(json.success).toBe(true);
    expect(json.data?.session.title).toBe('查询订单');
    expect(json.data?.session.databaseId).toBe('db-1');
    expect(json.data?.session.preview).toContain('查询订单');

    const id = json.data?.session.id;
    expect(typeof id).toBe('string');

    const detail = await client.request(`/query-sessions/${id}`);
    expect(detail.status).toBe(200);
    const detailJson = (await detail.json()) as {
      success: boolean;
      data?: { messages: Array<{ id: string; role: string; content: string; sequence: number; sql?: string }> };
    };

    expect(detailJson.success).toBe(true);
    expect(detailJson.data?.messages.length).toBe(2);
    expect(detailJson.data?.messages[0]).toMatchObject({ id: 'u-1', role: 'user', content: '查询订单', sequence: 1 });
    expect(detailJson.data?.messages[1]).toMatchObject({
      id: 'a-1',
      role: 'assistant',
      content: '已生成 SQL',
      sequence: 2,
      sql: 'SELECT * FROM orders',
    });
  });

  it('POST /query-sessions/:id/messages 应追加消息并递增 sequence', async () => {
    const client = createQuerySessionRouteTestClient();
    const created = await client.request('/query-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        databaseId: 'db-1',
        title: '第一次查询',
        messages: [{ id: 'u-1', role: 'user', content: '查询订单' }],
      }),
    });

    const createdJson = (await created.json()) as { data?: { session: { id: string } } };
    const sessionId = createdJson.data?.session.id;
    expect(typeof sessionId).toBe('string');

    const append = await client.request(`/query-sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { id: 'a-1', role: 'assistant', content: '已生成 SQL', sql: 'SELECT * FROM orders' },
          { id: 'u-2', role: 'user', content: '只看最近 7 天' },
        ],
      }),
    });

    expect(append.status).toBe(200);

    const detail = await client.request(`/query-sessions/${sessionId}`);
    const detailJson = (await detail.json()) as {
      data?: { messages: Array<{ id: string; sequence: number }> };
    };
    expect(detailJson.data?.messages.map((m) => [m.id, m.sequence])).toEqual([
      ['u-1', 1],
      ['a-1', 2],
      ['u-2', 3],
    ]);
  });

  it('GET /query-sessions 支持 limit + cursor 翻页，并支持 q 搜索', async () => {
    const client = createQuerySessionRouteTestClient();

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-02-14T01:00:00.000Z'));
      await client.request('/query-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseId: 'db-1',
          title: '查用户',
          messages: [{ id: 'u-1', role: 'user', content: 'users' }],
        }),
      });

      vi.setSystemTime(new Date('2026-02-14T02:00:00.000Z'));
      await client.request('/query-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseId: 'db-1',
          title: '查订单',
          messages: [{ id: 'u-2', role: 'user', content: 'orders' }],
        }),
      });

      vi.setSystemTime(new Date('2026-02-14T03:00:00.000Z'));
      await client.request('/query-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseId: 'db-1',
          title: '查退款',
          messages: [{ id: 'u-3', role: 'user', content: 'refunds' }],
        }),
      });
    } finally {
      vi.useRealTimers();
    }

    const firstPage = await client.request('/query-sessions?limit=2');
    const firstJson = (await firstPage.json()) as {
      data?: {
        sessions: Array<{ title: string; updatedAt: string; id: string }>;
        nextCursor: { updatedAt: string; id: string } | null;
        hasMore: boolean;
      };
    };
    expect(firstJson.data?.sessions.map((s) => s.title)).toEqual(['查退款', '查订单']);
    expect(firstJson.data?.hasMore).toBe(true);
    expect(firstJson.data?.nextCursor).not.toBeNull();

    const cursor = firstJson.data?.nextCursor;
    const secondPage = await client.request(
      `/query-sessions?limit=2&cursorUpdatedAt=${encodeURIComponent(cursor!.updatedAt)}&cursorId=${cursor!.id}`,
    );
    const secondJson = (await secondPage.json()) as {
      data?: { sessions: Array<{ title: string }>; hasMore: boolean };
    };
    expect(secondJson.data?.sessions.map((s) => s.title)).toEqual(['查用户']);
    expect(secondJson.data?.hasMore).toBe(false);

    const searchRes = await client.request('/query-sessions?q=%E8%AE%A2%E5%8D%95');
    const searchJson = (await searchRes.json()) as { data?: { sessions: Array<{ title: string }> } };
    expect(searchJson.data?.sessions.map((s) => s.title)).toEqual(['查订单']);
  });

  it('PATCH /query-sessions/:id 可重命名，DELETE 可删除', async () => {
    const client = createQuerySessionRouteTestClient();

    const created = await client.request('/query-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        databaseId: 'db-1',
        title: '旧标题',
        messages: [{ id: 'u-1', role: 'user', content: 'hi' }],
      }),
    });
    const createdJson = (await created.json()) as { data?: { session: { id: string } } };
    const id = createdJson.data?.session.id;
    expect(typeof id).toBe('string');

    const renamed = await client.request(`/query-sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新标题' }),
    });
    expect(renamed.status).toBe(200);
    const renamedJson = (await renamed.json()) as { data?: { session: { title: string } } };
    expect(renamedJson.data?.session.title).toBe('新标题');

    const deleted = await client.request(`/query-sessions/${id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);

    const detail = await client.request(`/query-sessions/${id}`);
    expect(detail.status).toBe(404);
  });
});
