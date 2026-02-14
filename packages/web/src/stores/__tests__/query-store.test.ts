import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { useQueryStore } from '../query-store';

vi.mock('@/lib/api', () => ({
  api: {
    query: {
      generate: vi.fn(),
      execute: vi.fn(),
    },
    querySessions: {
      create: vi.fn(),
      list: vi.fn(),
      appendMessages: vi.fn(),
      get: vi.fn(),
      rename: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('query-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueryStore.getState().reset();
  });

  it('缺少必要条件时不应发起请求', async () => {
    useQueryStore.getState().setInput('查询订单');

    await useQueryStore.getState().sendQuery();

    expect(api.query.generate).not.toHaveBeenCalled();
    expect(useQueryStore.getState().messages).toEqual([]);
  });

  it('发送成功后应追加用户与助手消息并清空输入', async () => {
    vi.mocked(api.query.generate).mockResolvedValue({
      sql: 'SELECT * FROM orders',
      explanation: '已生成查询 SQL',
    });
    vi.mocked(api.querySessions.create).mockResolvedValue({
      id: 's-1',
      databaseId: 'db-1',
      title: '查询订单',
      preview: '查询订单',
      createdAt: '2026-02-14T00:00:00.000Z',
      updatedAt: '2026-02-14T00:00:00.000Z',
    });
    vi.mocked(api.querySessions.list).mockResolvedValue({
      sessions: [],
      nextCursor: null,
      hasMore: false,
    });

    useQueryStore.getState().setSelectedDatabaseId('db-1');
    useQueryStore.getState().setInput('查询订单');

    await useQueryStore.getState().sendQuery();

    const state = useQueryStore.getState();
    expect(api.query.generate).toHaveBeenCalledWith('db-1', '查询订单');
    expect(state.loading).toBe(false);
    expect(state.input).toBe('');
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]).toMatchObject({
      role: 'user',
      content: '查询订单',
    });
    expect(state.messages[1]).toMatchObject({
      role: 'assistant',
      content: '已生成查询 SQL',
      sql: 'SELECT * FROM orders',
    });
    expect(state.currentSessionId).toBe('s-1');
  });

  it('发送失败时应追加错误消息并结束加载', async () => {
    vi.mocked(api.query.generate).mockRejectedValue(new Error('服务不可用'));
    vi.mocked(api.querySessions.create).mockResolvedValue({
      id: 's-1',
      databaseId: 'db-1',
      title: '查询订单',
      preview: '查询订单',
      createdAt: '2026-02-14T00:00:00.000Z',
      updatedAt: '2026-02-14T00:00:00.000Z',
    });
    vi.mocked(api.querySessions.list).mockResolvedValue({
      sessions: [],
      nextCursor: null,
      hasMore: false,
    });

    useQueryStore.getState().setSelectedDatabaseId('db-1');
    useQueryStore.getState().setInput('查询订单');

    await useQueryStore.getState().sendQuery();

    const state = useQueryStore.getState();
    expect(state.loading).toBe(false);
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1]).toMatchObject({
      role: 'assistant',
      content: '生成失败：服务不可用',
    });
  });

  it('当解释为空时应使用默认解释文案', async () => {
    vi.mocked(api.query.generate).mockResolvedValue({
      sql: 'SELECT 1',
      explanation: '',
    });
    vi.mocked(api.querySessions.create).mockResolvedValue({
      id: 's-1',
      databaseId: 'db-1',
      title: '测试',
      preview: '测试',
      createdAt: '2026-02-14T00:00:00.000Z',
      updatedAt: '2026-02-14T00:00:00.000Z',
    });
    vi.mocked(api.querySessions.list).mockResolvedValue({
      sessions: [],
      nextCursor: null,
      hasMore: false,
    });

    useQueryStore.getState().setSelectedDatabaseId('db-1');
    useQueryStore.getState().setInput('测试');

    await useQueryStore.getState().sendQuery();

    const state = useQueryStore.getState();
    expect(state.messages[1]).toMatchObject({
      role: 'assistant',
      content: '根据您的查询，我生成了以下 SQL 语句：',
      sql: 'SELECT 1',
    });
  });

  it('未知异常对象应使用兜底错误文案', async () => {
    vi.mocked(api.query.generate).mockRejectedValue('network down');
    vi.mocked(api.querySessions.create).mockResolvedValue({
      id: 's-1',
      databaseId: 'db-1',
      title: '测试',
      preview: '测试',
      createdAt: '2026-02-14T00:00:00.000Z',
      updatedAt: '2026-02-14T00:00:00.000Z',
    });
    vi.mocked(api.querySessions.list).mockResolvedValue({
      sessions: [],
      nextCursor: null,
      hasMore: false,
    });

    useQueryStore.getState().setSelectedDatabaseId('db-1');
    useQueryStore.getState().setInput('测试');

    await useQueryStore.getState().sendQuery();

    const state = useQueryStore.getState();
    expect(state.messages[1]).toMatchObject({
      role: 'assistant',
      content: '生成失败：未知错误',
    });
  });
});
