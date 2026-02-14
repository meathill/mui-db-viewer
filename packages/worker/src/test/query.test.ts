/**
 * 查询路由测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createAiService } from '../services/ai';
import type { Env } from '../types';

// Mock AI 服务 - 必须在导入路由之前
vi.mock('../services/ai', () => ({
  createAiService: vi.fn(),
}));

import { queryRoutes } from '../routes/query';

interface MockD1BoundStatement {
  run: () => Promise<{ success: boolean }>;
  all: () => Promise<{ results: Array<Record<string, unknown>> }>;
  first: () => Promise<Record<string, unknown> | null>;
}

interface MockD1PreparedStatement {
  bind: (...values: unknown[]) => MockD1BoundStatement;
  all: () => Promise<{ results: Array<Record<string, unknown>> }>;
}

interface MockD1Database {
  prepare: (query: string) => MockD1PreparedStatement;
}

interface MockDatabaseConnectionRow {
  id: string;
  name: string;
  type: string;
  host: string;
  port: string;
  database_name: string;
  username: string;
  key_path: string;
  created_at: string;
  updated_at: string;
}

interface MockSchemaCacheRow {
  database_id: string;
  schema_text: string;
  updated_at: number;
  expires_at: number;
}

function createMockDb(options: {
  connectionRow: MockDatabaseConnectionRow | null;
  schemaCacheRow: MockSchemaCacheRow | null;
}): MockD1Database {
  let schemaCacheRow = options.schemaCacheRow;

  return {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              if (query.includes('INSERT INTO database_schema_cache')) {
                const [databaseId, schemaText, updatedAt, expiresAt] = values;
                schemaCacheRow = {
                  database_id: String(databaseId),
                  schema_text: String(schemaText),
                  updated_at: Number(updatedAt),
                  expires_at: Number(expiresAt),
                };
              }
              return { success: true };
            },
            async all() {
              return { results: [] as Array<Record<string, unknown>> };
            },
            async first() {
              const [id] = values;
              if (query.includes('FROM database_connections')) {
                if (options.connectionRow && String(id) === options.connectionRow.id) {
                  return { ...options.connectionRow };
                }
                return null;
              }

              if (query.includes('FROM database_schema_cache')) {
                if (schemaCacheRow && String(id) === schemaCacheRow.database_id) {
                  return { ...schemaCacheRow };
                }
                return null;
              }

              return null;
            },
          };
        },
        async all() {
          return { results: [] as Array<Record<string, unknown>> };
        },
      };
    },
  };
}

function createEnv(db: MockD1Database): Env {
  return {
    HSM_URL: 'https://hsm.example.com',
    HSM_SECRET: 'test-secret',
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-1.5-flash',
    REPLICATE_API_KEY: 'test-replicate-key',
    REPLICATE_MODEL: 'meta/meta-llama-3-8b-instruct',
    DB: db as unknown as Env['DB'],
  };
}

describe('Query Routes', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;
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
    const connectionRow: MockDatabaseConnectionRow = {
      id: 'test-db-id',
      name: 'test-db',
      type: 'mysql',
      host: '127.0.0.1',
      port: '3306',
      database_name: 'app',
      username: 'root',
      key_path: 'vibedb/databases/test-db-id/password',
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    };

    const schemaCacheRow: MockSchemaCacheRow = {
      database_id: 'test-db-id',
      schema_text: '表: users\n  - id: int (PRIMARY KEY, NOT NULL)\n  - name: varchar(255)',
      updated_at: now,
      expires_at: now + 7 * 24 * 60 * 60 * 1000,
    };

    const db = createMockDb({ connectionRow, schemaCacheRow });
    env = createEnv(db);

    app = new Hono<{ Bindings: Env }>();
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
      const emptyDb = createMockDb({
        connectionRow: null,
        schemaCacheRow: null,
      });
      const emptyEnv = createEnv(emptyDb);

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

