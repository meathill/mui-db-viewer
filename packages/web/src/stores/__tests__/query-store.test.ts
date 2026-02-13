import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { useQueryStore } from '../query-store';

vi.mock('@/lib/api', () => ({
  api: {
    query: {
      generate: vi.fn(),
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
  });

  it('发送失败时应追加错误消息并结束加载', async () => {
    vi.mocked(api.query.generate).mockRejectedValue(new Error('服务不可用'));

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
});
