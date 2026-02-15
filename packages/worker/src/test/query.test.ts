/**
 * 查询路由测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createAiService } from '../services/ai';
import {
  createQueryRouteMockDb,
  createDefaultQueryRouteConnectionRow,
  type MockSchemaCacheRow,
} from './query-route-test-utils';
import { createTestEnv } from './test-env';

// Mock AI 服务 - 必须在导入路由之前
vi.mock('../services/ai', () => ({
  createAiService: vi.fn(),
}));

import { queryRoutes } from '../routes/query';

describe('Query Routes', () => {
  let app: Hono<{ Bindings: CloudflareBindings }>;
  let env: CloudflareBindings;
  let generateSqlMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    generateSqlMock = vi.fn().mockResolvedValue({
      sql: "SELECT * FROM orders WHERE status = 'pending'",
      explanation: '查询待处理订单',
    });

    vi.mocked(createAiService).mockClear();
    vi.mocked(createAiService).mockReturnValue({
      generateSql: generateSqlMock,
    } as ReturnType<typeof createAiService>);

    const now = Date.now();
    const connectionRow = createDefaultQueryRouteConnectionRow({
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });

    const schemaCacheRow: MockSchemaCacheRow = {
      database_id: 'test-db-id',
      schema_text: '表: users\n  - id: int (PRIMARY KEY, NOT NULL)\n  - name: varchar(255)',
      updated_at: now,
      expires_at: now + 7 * 24 * 60 * 60 * 1000,
    };

    const db = createQueryRouteMockDb({ connectionRow, schemaCacheRow });
    env = createTestEnv(db);

    app = new Hono<{ Bindings: CloudflareBindings }>();
    app.route('/query', queryRoutes);
  });

  describe('POST /query/generate', () => {
    it('成功生成 SQL (默认 OpenAI) 并自动注入表结构上下文', async () => {
      const res = await app.request(
        '/query/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: 'test-db-id',
            prompt: '查看待处理订单',
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(createAiService).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          apiKey: 'test-openai-key',
        }),
      );
      expect(generateSqlMock).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseType: 'MySQL',
          schema: expect.stringContaining('表: users'),
        }),
      );
    });

    it('使用 Gemini 生成 SQL', async () => {
      const res = await app.request(
        '/query/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: 'test-db-id',
            prompt: '查看待处理订单',
            provider: 'gemini',
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(createAiService).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'gemini',
          apiKey: 'test-gemini-key',
        }),
      );
    });

    it('使用 Replicate 生成 SQL', async () => {
      const res = await app.request(
        '/query/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: 'test-db-id',
            prompt: '查看待处理订单',
            provider: 'replicate',
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(createAiService).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'replicate',
          apiKey: 'test-replicate-key',
        }),
      );
    });

    it('缺少 databaseId 返回 400', async () => {
      const res = await app.request(
        '/query/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: '查询订单',
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('缺少 databaseId 或 prompt');
    });

    it('缺少 prompt 返回 400', async () => {
      const res = await app.request(
        '/query/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: 'test-db-id',
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it('数据库连接不存在时返回 404', async () => {
      const emptyDb = createQueryRouteMockDb({
        connectionRow: null,
        schemaCacheRow: null,
      });
      const emptyEnv = createTestEnv(emptyDb);

      const res = await app.request(
        '/query/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: 'non-existent-id',
            prompt: '查看待处理订单',
          }),
        },
        emptyEnv,
      );

      expect(res.status).toBe(404);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('数据库连接不存在');
    });

    it('当 SQL Guard 拒绝语句时返回 warning', async () => {
      vi.mocked(createAiService).mockReturnValueOnce({
        generateSql: vi.fn().mockResolvedValue({
          sql: 'DELETE FROM orders',
          explanation: '删除订单',
        }),
      } as ReturnType<typeof createAiService>);

      const res = await app.request(
        '/query/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: 'test-db-id',
            prompt: '删除订单',
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data?: { sql: string; warning?: string; explanation?: string };
      };
      expect(json.success).toBe(true);
      expect(json.data?.sql).toBe('DELETE FROM orders');
      expect(json.data?.warning).toContain('只允许');
      expect(json.data?.explanation).toBe('删除订单');
    });

    it('AI 服务异常时返回 500', async () => {
      vi.mocked(createAiService).mockReturnValueOnce({
        generateSql: vi.fn().mockRejectedValue(new Error('OpenAI timeout')),
      } as ReturnType<typeof createAiService>);

      const res = await app.request(
        '/query/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: 'test-db-id',
            prompt: '查看待处理订单',
          }),
        },
        env,
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('OpenAI timeout');
    });
  });

  describe('POST /query/validate', () => {
    it('验证有效的 SELECT 语句', async () => {
      const res = await app.request(
        '/query/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: 'SELECT * FROM users',
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data?: { valid: boolean; sql?: string } };
      expect(json.success).toBe(true);
      expect(json.data?.valid).toBe(true);
      expect(json.data?.sql).toBe('SELECT * FROM users LIMIT 100');
    });

    it('拒绝 DELETE 语句', async () => {
      const res = await app.request(
        '/query/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: 'DELETE FROM users',
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data?: { valid: boolean; error?: string } };
      expect(json.success).toBe(true);
      expect(json.data?.valid).toBe(false);
      expect(json.data?.error).toContain('只允许');
    });

    it('拒绝 DROP 语句', async () => {
      const res = await app.request(
        '/query/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: 'DROP TABLE users',
          }),
        },
        env,
      );

      const json = (await res.json()) as { data?: { valid: boolean } };
      expect(json.data?.valid).toBe(false);
    });

    it('缺少 SQL 返回 400', async () => {
      const res = await app.request(
        '/query/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('缺少 SQL');
    });

    it('空白 SQL 返回 400', async () => {
      const res = await app.request(
        '/query/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: '   ',
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('缺少 SQL');
    });
  });
});
