/**
 * 查询路由测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock AI 服务 - 必须在导入路由之前
vi.mock('../services/ai', () => ({
  createAiService: vi.fn(() => ({
    generateSql: vi.fn().mockResolvedValue({
      sql: "SELECT * FROM orders WHERE status = 'pending'",
      explanation: '查询待处理订单',
    }),
  })),
}));

import { queryRoutes } from '../routes/query';

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
}

describe('Query Routes', () => {
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();

    // 注入环境变量
    app.use('*', async (c, next) => {
      // @ts-expect-error mock env
      c.env = {
        OPENAI_API_KEY: 'test-api-key',
        OPENAI_MODEL: 'gpt-4o-mini',
      };
      await next();
    });

    app.route('/query', queryRoutes);
  });

  describe('POST /query/generate', () => {
    it('成功生成 SQL', async () => {
      const res = await app.request('/query/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseId: 'test-db-id',
          prompt: '查看待处理订单',
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data?: { sql: string } };
      expect(json.success).toBe(true);
      expect(json.data?.sql).toContain('SELECT');
      expect(json.data?.sql).toContain('LIMIT 100'); // SQL Guard 添加的 LIMIT
    });

    it('缺少 databaseId 返回 400', async () => {
      const res = await app.request('/query/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '查询订单',
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('缺少 databaseId 或 prompt');
    });

    it('缺少 prompt 返回 400', async () => {
      const res = await app.request('/query/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseId: 'test-db-id',
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  describe('POST /query/validate', () => {
    it('验证有效的 SELECT 语句', async () => {
      const res = await app.request('/query/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: 'SELECT * FROM users',
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data?: { valid: boolean; sql?: string } };
      expect(json.success).toBe(true);
      expect(json.data?.valid).toBe(true);
      expect(json.data?.sql).toBe('SELECT * FROM users LIMIT 100');
    });

    it('拒绝 DELETE 语句', async () => {
      const res = await app.request('/query/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: 'DELETE FROM users',
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data?: { valid: boolean; error?: string } };
      expect(json.success).toBe(true);
      expect(json.data?.valid).toBe(false);
      expect(json.data?.error).toContain('只允许');
    });

    it('拒绝 DROP 语句', async () => {
      const res = await app.request('/query/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: 'DROP TABLE users',
        }),
      });

      const json = (await res.json()) as { data?: { valid: boolean } };
      expect(json.data?.valid).toBe(false);
    });

    it('缺少 SQL 返回 400', async () => {
      const res = await app.request('/query/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('缺少 SQL');
    });

    it('保留已有的 LIMIT', async () => {
      const res = await app.request('/query/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: 'SELECT * FROM users LIMIT 50',
        }),
      });

      const json = (await res.json()) as { data?: { valid: boolean; sql?: string } };
      expect(json.data?.valid).toBe(true);
      expect(json.data?.sql).toBe('SELECT * FROM users LIMIT 50');
    });

    it('允许 SHOW 语句', async () => {
      const res = await app.request('/query/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: 'SHOW TABLES',
        }),
      });

      const json = (await res.json()) as { data?: { valid: boolean } };
      expect(json.data?.valid).toBe(true);
    });

    it('允许 DESCRIBE 语句', async () => {
      const res = await app.request('/query/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: 'DESCRIBE users',
        }),
      });

      const json = (await res.json()) as { data?: { valid: boolean } };
      expect(json.data?.valid).toBe(true);
    });
  });
});
