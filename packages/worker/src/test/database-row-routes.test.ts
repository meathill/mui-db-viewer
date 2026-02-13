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

describe('database row routes', () => {
  let client: ReturnType<typeof createDatabaseRouteTestClient>;

  beforeEach(() => {
    client = createDatabaseRouteTestClient();
    client.setConnectionRow(createMockDatabaseConnectionRow());
  });

  it('GET /databases/:id/tables/:tableName/data 成功获取表数据', async () => {
    const res = await client.request('/databases/test-id/tables/users/data?page=1&pageSize=10');

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data?: {
        rows: Array<{ id: number; name: string }>;
        total: number;
        columns: Array<{ Field: string }>;
      };
    };

    expect(json.success).toBe(true);
    expect(json.data?.total).toBe(10);
    expect(json.data?.rows).toHaveLength(2);
    expect(json.data?.rows[0]?.name).toBe('Alice');
    expect(json.data?.columns).toHaveLength(2);
  });

  it('GET /databases/:id/tables/:tableName/data 支持全局搜索', async () => {
    const res = await client.request('/databases/test-id/tables/users/data?page=1&pageSize=10&_search=Al');

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data?: {
        rows: Array<{ id: number; name: string }>;
        total: number;
      };
    };

    expect(json.success).toBe(true);
    expect(json.data?.total).toBe(1);
    expect(json.data?.rows).toHaveLength(1);
    expect(json.data?.rows[0]?.name).toBe('Alice');
  });

  it('POST /databases/:id/tables/:tableName/rows/delete 成功删除行', async () => {
    const res = await client.request('/databases/test-id/tables/users/rows/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [1, 2] }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('POST /databases/:id/tables/:tableName/rows/delete 缺少 ids 时返回 400', async () => {
    const res = await client.request('/databases/test-id/tables/users/rows/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe('请选择要删除的行');
  });

  it('POST /databases/:id/tables/:tableName/rows 成功插入行', async () => {
    const res = await client.request('/databases/test-id/tables/users/rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Charlie' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('PUT /databases/:id/tables/:tableName/rows 成功更新行', async () => {
    const res = await client.request('/databases/test-id/tables/users/rows', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{ pk: 1, data: { name: 'Alice Updated' } }],
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('PUT /databases/:id/tables/:tableName/rows 连接不存在时返回 404', async () => {
    client.setConnectionRow(null);

    const res = await client.request('/databases/missing/tables/users/rows', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{ pk: 1, data: { name: 'Alice Updated' } }],
      }),
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe('数据库连接不存在');
  });
});
