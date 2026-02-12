/**
 * 数据库路由测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock HSM 模块 - 必须在导入路由之前
vi.mock('../services/hsm', () => ({
  createHsmClient: vi.fn(() => ({
    encrypt: vi.fn().mockResolvedValue(undefined),
    decrypt: vi.fn().mockResolvedValue('decrypted-password'),
    delete: vi.fn().mockResolvedValue(undefined),
  })),
}));

// 导入被测模块
import { databaseRoutes } from '../routes/database';

describe('Database Routes', () => {
  let app: Hono<{ Bindings: { HSM_URL: string; HSM_SECRET: string; OPENAI_API_KEY: string; DB: any } }>;

  let mockDbFirstResult: any = null;

  beforeEach(() => {
    mockDbFirstResult = null;
    // 创建带有 mock 环境变量的 app
    app = new Hono<{ Bindings: { HSM_URL: string; HSM_SECRET: string; OPENAI_API_KEY: string; DB: any } }>();

    // 添加中间件注入环境变量
    app.use('*', async (c, next) => {
      // @ts-ignore mock env
      c.env = {
        HSM_URL: 'https://hsm.example.com',
        HSM_SECRET: 'test-secret',
        OPENAI_API_KEY: 'test-key',
        DB: {
          prepare: vi.fn((query: string) => ({
            bind: vi.fn(() => ({
              run: vi.fn().mockResolvedValue({ success: true }),
              all: vi.fn().mockResolvedValue({ results: [] }),
              first: vi.fn().mockResolvedValue(mockDbFirstResult),
            })),
            all: vi.fn().mockResolvedValue({ results: [] }),
          })),
        },
      };
      await next();
    });

    app.route('/databases', databaseRoutes);
  });

  // ... existing tests ...

  describe('GET /databases/:id/tables', () => {
    it('成功获取表列表', async () => {
      mockDbFirstResult = {
        id: 'test-id',
        name: 'test-db',
        type: 'tidb',
        host: 'localhost',
        port: '3306',
        database_name: 'test_db',
        username: 'root',
        key_path: 'vibedb/databases/test-id/password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const res = await app.request('/databases/test-id/tables');

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: string[] };
      expect(json.success).toBe(true);
      expect(json.data).toEqual(['users']);
    });
  });

  describe('GET /databases/:id/tables/:tableName/data', () => {
    it('成功获取表数据', async () => {
      // Setup mock return for getTableData and getTableSchema calls
      // The service calls:
      // 1. SELECT count(*) as total FROM tableName
      // 2. SELECT * FROM tableName ...
      // 3. DESCRIBE tableName
      // We need to update the mock to handle multiple calls or return data generally
      // Current mock in test file:
      // vi.mock('@tidbcloud/serverless', () => ({
      //   connect: vi.fn(() => ({
      //     execute: vi.fn().mockResolvedValue([{ 'Tables_in_test_db': 'users' }]),
      //   })),
      // }));
      // We need a more sophisticated mock for this test
    });
  });

  describe('POST /databases', () => {
    it('成功创建数据库连接', async () => {
      const res = await app.request('/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '测试数据库',
          type: 'tidb',
          host: 'localhost',
          port: '3306',
          database: 'test_db',
          username: 'root',
          password: 'secret',
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        success: boolean;
        data?: { name: string; type: string; id: string; keyPath: string; password?: string };
      };
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        name: '测试数据库',
        type: 'tidb',
        host: 'localhost',
      });
      expect(json.data?.id).toBeDefined();
      expect(json.data?.keyPath).toContain('vibedb/databases');
      // 确保密码未被存储
      expect(json.data?.password).toBeUndefined();
    });

    it('缺少必填字段时返回 400', async () => {
      const res = await app.request('/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '测试数据库',
          // 缺少其他必填字段
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('缺少必填字段');
    });

    it('使用默认端口 3306', async () => {
      const res = await app.request('/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '无端口指定',
          type: 'tidb',
          host: 'localhost',
          // 不指定 port
          database: 'test_db',
          username: 'root',
          password: 'secret',
        }),
      });

      const json = (await res.json()) as { data?: { port: string } };
      expect(json.data?.port).toBe('3306');
    });
  });

  describe('GET /databases', () => {
    it('返回数据库列表', async () => {
      const res = await app.request('/databases');

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data?: unknown[] };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('GET /databases/:id', () => {
    it('不存在的 ID 返回 404', async () => {
      const res = await app.request('/databases/non-existent-id');

      expect(res.status).toBe(404);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('数据库连接不存在');
    });
  });

  describe('DELETE /databases/:id', () => {
    it('删除不存在的 ID 返回 404', async () => {
      const res = await app.request('/databases/non-existent-id', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });
  describe('GET /databases/:id/tables/:tableName/data', () => {
    it('成功获取表数据', async () => {
      mockDbFirstResult = {
        id: 'test-id',
        name: 'test-db',
        type: 'tidb',
        host: 'localhost',
        port: '3306',
        database_name: 'test_db',
        username: 'root',
        key_path: 'vibedb/databases/test-id/password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const res = await app.request('/databases/test-id/tables/users/data?page=1&pageSize=10');

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { rows: any[]; total: number; columns: any[] };
      };
      expect(json.success).toBe(true);
      expect(json.data.total).toBe(10);
      expect(json.data.rows).toHaveLength(2);
      expect(json.data.columns).toHaveLength(2);
      expect(json.data.rows[0].name).toBe('Alice');
    });
  });
  it('支持全局搜索', async () => {
    mockDbFirstResult = {
      id: 'test-id',
      name: 'test-db',
      type: 'tidb',
      host: 'localhost',
      port: '3306',
      database_name: 'test_db',
      username: 'root',
      key_path: 'vibedb/databases/test-id/password',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const res = await app.request('/databases/test-id/tables/users/data?page=1&pageSize=10&_search=Al');

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { rows: any[]; total: number; columns: any[] };
    };
    expect(json.success).toBe(true);
    expect(json.data.total).toBe(1);
    expect(json.data.rows).toHaveLength(1);
    expect(json.data.rows[0].name).toBe('Alice');
  });

  describe('POST /databases/:id/tables/:tableName/rows/delete', () => {
    it('成功删除行', async () => {
      mockDbFirstResult = {
        id: 'test-id',
        name: 'test-db',
        type: 'tidb',
        host: 'localhost',
        port: '3306',
        database_name: 'test_db',
        username: 'root',
        key_path: 'vibedb/databases/test-id/password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const res = await app.request('/databases/test-id/tables/users/rows/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [1, 2] }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
    });
  });

  describe('POST /databases/:id/tables/:tableName/rows', () => {
    it('成功插入行', async () => {
      mockDbFirstResult = {
        id: 'test-id',
        name: 'test-db',
        type: 'tidb',
        host: 'localhost',
        port: '3306',
        database_name: 'test_db',
        username: 'root',
        key_path: 'vibedb/databases/test-id/password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const res = await app.request('/databases/test-id/tables/users/rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Charlie' }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
    });
  });

  describe('PUT /databases/:id/tables/:tableName/rows', () => {
    it('成功更新行', async () => {
      mockDbFirstResult = {
        id: 'test-id',
        name: 'test-db',
        type: 'tidb',
        host: 'localhost',
        port: '3306',
        database_name: 'test_db',
        username: 'root',
        key_path: 'vibedb/databases/test-id/password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const res = await app.request('/databases/test-id/tables/users/rows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ pk: 1, data: { name: 'Alice Updated' } }] }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
    });
  });
});

// Mock @tidbcloud/serverless
vi.mock('@tidbcloud/serverless', () => ({
  connect: vi.fn(() => ({
    execute: vi.fn((sql: string) => {
      if (sql.includes('SHOW TABLES')) {
        return Promise.resolve([{ Tables_in_test_db: 'users' }]);
      }
      if (sql.toUpperCase().includes('COUNT(*)')) {
        if (sql.includes('LIKE')) {
          return Promise.resolve([{ total: 1 }]);
        }
        return Promise.resolve([{ total: 10 }]);
      }
      if (sql.includes('DESCRIBE')) {
        return Promise.resolve([
          { Field: 'id', Type: 'int', Null: 'NO', Key: 'PRI', Default: null, Extra: 'auto_increment' },
          { Field: 'name', Type: 'varchar(255)', Null: 'NO', Key: '', Default: null, Extra: '' },
        ]);
      }
      if (sql.includes('SELECT * FROM')) {
        if (sql.includes('LIKE')) {
          return Promise.resolve([{ id: 1, name: 'Alice' }]);
        }
        return Promise.resolve([
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ]);
      }
      if (sql.includes('DELETE FROM') || sql.includes('INSERT INTO') || sql.includes('UPDATE')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    }),
  })),
}));
