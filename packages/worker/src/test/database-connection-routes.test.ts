import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabaseRouteTestClient, createMockDatabaseConnectionRow } from './database-route-test-utils';

vi.mock('../services/hsm', () => ({
  createHsmClient: vi.fn(() => ({
    encrypt: vi.fn().mockResolvedValue(undefined),
    decrypt: vi.fn().mockResolvedValue('decrypted-password'),
    delete: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@tidbcloud/serverless', () => ({
  connect: vi.fn(() => ({
    execute: vi.fn((sql: string) => {
      if (sql.includes('SHOW TABLES')) {
        return Promise.resolve([{ Tables_in_test_db: 'users' }]);
      }
      return Promise.resolve([]);
    }),
  })),
}));

describe('database connection routes', () => {
  let client: ReturnType<typeof createDatabaseRouteTestClient>;

  beforeEach(() => {
    client = createDatabaseRouteTestClient();
    client.setConnectionRow(null);
  });

  it('POST /databases 成功创建数据库连接', async () => {
    const res = await client.request('/databases', {
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
    expect(json.data?.password).toBeUndefined();
  });

  it('POST /databases 缺少必填字段时返回 400', async () => {
    const res = await client.request('/databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '测试数据库' }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe('缺少必填字段');
  });

  it('POST /databases 必填字段为空白字符时返回 400', async () => {
    const res = await client.request('/databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '   ',
        type: 'tidb',
        host: 'localhost',
        port: '3306',
        database: 'test_db',
        username: 'root',
        password: 'secret',
      }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe('缺少必填字段');
  });

  it('POST /databases 不传端口时使用默认值 3306', async () => {
    const res = await client.request('/databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '无端口指定',
        type: 'tidb',
        host: 'localhost',
        database: 'test_db',
        username: 'root',
        password: 'secret',
      }),
    });

    const json = (await res.json()) as { data?: { port: string } };
    expect(json.data?.port).toBe('3306');
  });

  it('POST /databases 端口为空白字符时使用默认值 3306', async () => {
    const res = await client.request('/databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '空白端口',
        type: 'tidb',
        host: 'localhost',
        port: '   ',
        database: 'test_db',
        username: 'root',
        password: 'secret',
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { success: boolean; data?: { port: string } };
    expect(json.success).toBe(true);
    expect(json.data?.port).toBe('3306');
  });

  it('GET /databases 返回数据库列表', async () => {
    const res = await client.request('/databases');

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data?: unknown[] };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /databases/:id 不存在时返回 404', async () => {
    const res = await client.request('/databases/non-existent-id');

    expect(res.status).toBe(404);
    const json = (await res.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe('数据库连接不存在');
  });

  it('DELETE /databases/:id 不存在时返回 404', async () => {
    const res = await client.request('/databases/non-existent-id', {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('GET /databases/:id/tables 成功返回表列表', async () => {
    client.setConnectionRow(createMockDatabaseConnectionRow());

    const res = await client.request('/databases/test-id/tables');

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data?: string[] };
    expect(json.success).toBe(true);
    expect(json.data).toEqual(['users']);
  });
});
