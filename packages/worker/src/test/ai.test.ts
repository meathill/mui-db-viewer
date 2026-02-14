/**
 * AI 服务测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAiService } from '../services/ai';

describe('AI Service', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  const config = {
    apiKey: 'test-api-key',
    model: 'gpt-4o-mini',
  };

  describe('generateSql', () => {
    it('发送正确的请求格式', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sql: 'SELECT * FROM users',
                    explanation: '查询所有用户',
                  }),
                },
              },
            ],
          }),
      });

      const service = createAiService(config);
      await service.generateSql({
        prompt: '查询所有用户',
        schema: '表: users',
        databaseType: 'MySQL',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('返回生成的 SQL 和解释', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sql: "SELECT * FROM orders WHERE status = 'pending'",
                    explanation: '查询待处理订单',
                  }),
                },
              },
            ],
          }),
      });

      const service = createAiService(config);
      const result = await service.generateSql({
        prompt: '查看待处理订单',
        schema: '表: orders',
        databaseType: 'MySQL',
      });

      expect(result.sql).toBe("SELECT * FROM orders WHERE status = 'pending'");
      expect(result.explanation).toBe('查询待处理订单');
    });

    it('处理非 JSON 响应', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: 'SELECT * FROM users',
                },
              },
            ],
          }),
      });

      const service = createAiService(config);
      const result = await service.generateSql({
        prompt: '查询用户',
        schema: '表: users',
        databaseType: 'MySQL',
      });

      expect(result.sql).toBe('SELECT * FROM users');
    });

    it('API 失败时抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Rate limit exceeded'),
      });

      const service = createAiService(config);
      await expect(
        service.generateSql({
          prompt: '查询',
          schema: '',
          databaseType: 'MySQL',
        }),
      ).rejects.toThrow('OpenAI 调用失败');
    });

    it('使用自定义 baseUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '{"sql":"SELECT 1"}' } }],
          }),
      });

      const service = createAiService({
        ...config,
        baseUrl: 'https://custom-api.example.com/v1',
      });

      await service.generateSql({
        prompt: '测试',
        schema: '',
        databaseType: 'MySQL',
      });

      expect(mockFetch).toHaveBeenCalledWith('https://custom-api.example.com/v1/chat/completions', expect.anything());
    });

    it('baseUrl 为空字符串时回退到默认地址', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '{"sql":"SELECT 1"}' } }],
          }),
      });

      const service = createAiService({
        ...config,
        baseUrl: '',
      });

      await service.generateSql({
        prompt: '测试',
        schema: '',
        databaseType: 'MySQL',
      });

      expect(mockFetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.anything());
    });
  });
});
