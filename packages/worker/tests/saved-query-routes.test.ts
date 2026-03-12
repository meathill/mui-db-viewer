import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { savedQueryRoutes } from '@/routes/saved-query-routes';
import { createTestEnv } from './test-env';

interface SavedQueryRow {
  id: string;
  name: string;
  description: string | null;
  sql: string;
  database_id: string;
  created_at: string;
  updated_at: string;
}

interface MockD1RunResult {
  success: boolean;
  meta: { changes: number };
}

interface MockD1BoundStatement {
  run: () => Promise<MockD1RunResult>;
  all: <T>() => Promise<{ results: T[] }>;
}

interface MockD1PreparedStatement {
  bind: (...values: unknown[]) => MockD1BoundStatement;
  all: <T>() => Promise<{ results: T[] }>;
}

interface MockD1Database {
  prepare: (query: string) => MockD1PreparedStatement;
}

function createSavedQueryRouteTestClient() {
  const rows = new Map<string, SavedQueryRow>();

  const db: MockD1Database = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              if (query.startsWith('INSERT INTO saved_queries')) {
                const [id, name, description, sql, databaseId, createdAt, updatedAt] = values;
                rows.set(String(id), {
                  id: String(id),
                  name: String(name),
                  description: description == null ? null : String(description),
                  sql: String(sql),
                  database_id: String(databaseId),
                  created_at: String(createdAt),
                  updated_at: String(updatedAt),
                });
                return { success: true, meta: { changes: 1 } };
              }

              if (query.startsWith('DELETE FROM saved_queries')) {
                const [id] = values;
                const deleted = rows.delete(String(id));
                return { success: true, meta: { changes: deleted ? 1 : 0 } };
              }

              return { success: true, meta: { changes: 0 } };
            },

            async all<T>() {
              if (query.startsWith('SELECT * FROM saved_queries')) {
                const [databaseId] = values;
                const result = Array.from(rows.values())
                  .filter((row) => (databaseId ? row.database_id === String(databaseId) : true))
                  .sort((left, right) => right.created_at.localeCompare(left.created_at));

                return { results: result as T[] };
              }

              return { results: [] as T[] };
            },
          };
        },

        async all<T>() {
          return { results: [] as T[] };
        },
      };
    },
  };

  const app = new Hono<{ Bindings: CloudflareBindings }>();
  app.route('/saved-queries', savedQueryRoutes);
  const env = createTestEnv(db);

  return {
    request(path: string, init?: RequestInit) {
      return app.request(path, init, env);
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('saved query routes', () => {
  it('POST/GET/DELETE /saved-queries 应完成完整 CRUD 冒烟', async () => {
    const client = createSavedQueryRouteTestClient();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T09:00:00.000Z'));
    const createdOne = await client.request('/saved-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '查用户',
        description: '基础查询',
        sql: 'SELECT * FROM users',
        databaseId: 'db-1',
      }),
    });

    vi.setSystemTime(new Date('2026-03-11T10:00:00.000Z'));
    const createdTwo = await client.request('/saved-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '查订单',
        sql: 'SELECT * FROM orders',
        databaseId: 'db-2',
      }),
    });

    const createdJsonOne = (await createdOne.json()) as { data?: { id: string; databaseId: string } };
    const createdJsonTwo = (await createdTwo.json()) as { data?: { id: string; databaseId: string } };

    expect(createdOne.status).toBe(201);
    expect(createdTwo.status).toBe(201);
    expect(createdJsonOne.data?.databaseId).toBe('db-1');
    expect(createdJsonTwo.data?.databaseId).toBe('db-2');

    const listAll = await client.request('/saved-queries');
    const listAllJson = (await listAll.json()) as {
      success: boolean;
      data?: Array<{ id: string; name: string }>;
    };
    expect(listAll.status).toBe(200);
    expect(listAllJson.success).toBe(true);
    expect(listAllJson.data?.map((item) => item.name)).toEqual(['查订单', '查用户']);

    const listDb1 = await client.request('/saved-queries?databaseId=db-1');
    const listDb1Json = (await listDb1.json()) as {
      data?: Array<{ id: string; databaseId: string }>;
    };
    expect(listDb1Json.data).toHaveLength(1);
    expect(listDb1Json.data?.[0]).toMatchObject({
      id: createdJsonOne.data?.id,
      databaseId: 'db-1',
    });

    const deleted = await client.request(`/saved-queries/${createdJsonOne.data?.id}`, {
      method: 'DELETE',
    });
    expect(deleted.status).toBe(200);

    const listAfterDelete = await client.request('/saved-queries');
    const listAfterDeleteJson = (await listAfterDelete.json()) as { data?: Array<{ id: string }> };
    expect(listAfterDeleteJson.data?.map((item) => item.id)).toEqual([createdJsonTwo.data?.id]);
  });

  it('POST /saved-queries 参数不合法时返回 400', async () => {
    const client = createSavedQueryRouteTestClient();

    const response = await client.request('/saved-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        sql: '',
        databaseId: '',
      }),
    });

    const json = (await response.json()) as { success: boolean; error?: string };
    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('DELETE /saved-queries/:id 不存在时返回 404', async () => {
    const client = createSavedQueryRouteTestClient();

    const response = await client.request('/saved-queries/missing', {
      method: 'DELETE',
    });

    const json = (await response.json()) as { success: boolean; error: string };
    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('查询不存在');
  });
});
