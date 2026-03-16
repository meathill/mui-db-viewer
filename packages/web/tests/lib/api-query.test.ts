/**
 * API 客户端：query 模块测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
const { settingsState } = vi.hoisted(() => ({
  settingsState: {
    provider: 'openai' as const,
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    openaiBaseUrl: 'https://api.openai.com/v1',
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
    replicateApiKey: '',
    replicateModel: 'meta/meta-llama-3-8b-instruct',
  },
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: {
    getState: () => settingsState,
    setState: (partial: Partial<typeof settingsState>) => Object.assign(settingsState, partial),
  },
}));

import { api } from '@/lib/api';
import { useSettingsStore } from '@/stores/settings-store';
import { mockFetch, mockFetchJsonOnce } from './api-test-helpers';

describe('api.query', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      provider: 'openai',
      openaiApiKey: '',
      openaiModel: 'gpt-4o-mini',
      openaiBaseUrl: 'https://api.openai.com/v1',
      geminiApiKey: '',
      geminiModel: 'gemini-1.5-flash',
      replicateApiKey: '',
      replicateModel: 'meta/meta-llama-3-8b-instruct',
    });
  });

  describe('generate', () => {
    it('成功生成 SQL', async () => {
      const mockData = { sql: 'SELECT * FROM users', explanation: '查询用户' };
      mockFetchJsonOnce({ success: true, data: mockData });

      const result = await api.query.generate('db-id', '查看所有用户');

      expect(result).toEqual(mockData);
    });

    it('生成失败时抛出错误', async () => {
      mockFetchJsonOnce({ success: false, error: 'API 限流' });

      await expect(api.query.generate('id', 'prompt')).rejects.toThrow('API 限流');
    });

    it('后端未返回错误文案时使用默认错误提示', async () => {
      mockFetchJsonOnce({ success: false });

      await expect(api.query.generate('id', 'prompt')).rejects.toThrow('生成 SQL 失败');
    });

    it('后端缺少 data 时使用默认错误提示', async () => {
      mockFetchJsonOnce({ success: true });

      await expect(api.query.generate('id', 'prompt')).rejects.toThrow('生成 SQL 失败');
    });

    it('OpenAI provider 应携带 apiKey、model 与 baseUrl', async () => {
      mockFetchJsonOnce({ success: true, data: { sql: 'SELECT 1' } });
      useSettingsStore.setState({
        provider: 'openai',
        openaiApiKey: 'sk-test',
        openaiModel: 'gpt-4.1-mini',
        openaiBaseUrl: 'https://example.com/v1',
      });

      await api.query.generate('db-1', '测试');

      const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
      expect(body).toMatchObject({
        databaseId: 'db-1',
        prompt: '测试',
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4.1-mini',
        baseUrl: 'https://example.com/v1',
      });
    });

    it('Gemini provider 只携带对应字段', async () => {
      mockFetchJsonOnce({ success: true, data: { sql: 'SELECT 1' } });
      useSettingsStore.setState({
        provider: 'gemini',
        geminiApiKey: 'gem-test',
        geminiModel: 'gemini-2.0-flash',
      });

      await api.query.generate('db-1', '测试');

      const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
      expect(body).toMatchObject({
        provider: 'gemini',
        apiKey: 'gem-test',
        model: 'gemini-2.0-flash',
      });
      expect(body.baseUrl).toBeUndefined();
    });

    it('Replicate provider 只携带对应字段', async () => {
      mockFetchJsonOnce({ success: true, data: { sql: 'SELECT 1' } });
      useSettingsStore.setState({
        provider: 'replicate',
        replicateApiKey: 'rep-test',
        replicateModel: 'meta/model:version',
      });

      await api.query.generate('db-1', '测试');

      const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
      expect(body).toMatchObject({
        provider: 'replicate',
        apiKey: 'rep-test',
        model: 'meta/model:version',
      });
      expect(body.baseUrl).toBeUndefined();
    });
  });

  describe('validate', () => {
    it('成功验证 SQL', async () => {
      const mockData = { valid: true, sql: 'SELECT * FROM users LIMIT 100' };
      mockFetchJsonOnce({ success: true, data: mockData });

      const result = await api.query.validate('SELECT * FROM users');

      expect(result).toEqual(mockData);
    });

    it('验证失败时返回错误信息', async () => {
      const mockData = { valid: false, error: '禁止使用 DELETE' };
      mockFetchJsonOnce({ success: true, data: mockData });

      const result = await api.query.validate('DELETE FROM users');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('禁止使用 DELETE');
    });

    it('校验接口失败但无 error 字段时使用默认文案', async () => {
      mockFetchJsonOnce({ success: false });

      await expect(api.query.validate('SELECT 1')).rejects.toThrow('校验 SQL 失败');
    });

    it('校验接口缺少 data 时使用默认文案', async () => {
      mockFetchJsonOnce({ success: true });

      await expect(api.query.validate('SELECT 1')).rejects.toThrow('校验 SQL 失败');
    });
  });

  describe('execute', () => {
    it('成功执行 SQL', async () => {
      const mockData = {
        rows: [{ id: 1, name: 'Alice' }],
        total: 1,
        columns: [{ Field: 'id', Type: 'INTEGER' }],
      };
      mockFetchJsonOnce({ success: true, data: mockData });

      const result = await api.query.execute('db-1', 'SELECT * FROM users');

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/databases/db-1/query'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('执行 SQL 时可携带参数', async () => {
      mockFetchJsonOnce({ success: true, data: { rows: [], total: 0, columns: [] } });

      await api.query.execute('db-1', 'SELECT * FROM users WHERE id = ?', [42]);

      const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
      expect(body).toEqual({
        sql: 'SELECT * FROM users WHERE id = ?',
        params: [42],
      });
    });

    it('执行失败时使用默认错误文案', async () => {
      mockFetchJsonOnce({ success: false });

      await expect(api.query.execute('db-1', 'SELECT 1')).rejects.toThrow('执行 SQL 失败');
    });
  });
});
