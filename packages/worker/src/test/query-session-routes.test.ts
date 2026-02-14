/**
 * 查询会话历史路由测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../types';
import { querySessionRoutes } from '../routes/query-session-routes';

interface MockD1RunResult {
  success: boolean;
  meta?: { changes?: number };
}

interface MockD1BoundStatement {
  run: () => Promise<MockD1RunResult>;
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

interface QuerySessionRow {
  id: string;
  database_id: string;
  title: string;
  preview: string;
  created_at: string;
  updated_at: string;
}

interface QuerySessionMessageRow {
  id: string;
  session_id: string;
  sequence: number;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  warning?: string;
  error?: string;
  created_at: string;
}

function createMockDb(connectionRow: MockDatabaseConnectionRow | null) {
  const sessions = new Map<string, QuerySessionRow>();
  const messages = new Map<string, QuerySessionMessageRow>();

  function listSessions(options: {
    databaseId: string | null;
    pattern: string | null;
    cursorUpdatedAt: string | null;
    cursorId: string | null;
    limitPlusOne: number;
  }) {
    const { databaseId, pattern, cursorUpdatedAt, cursorId, limitPlusOne } = options;

    let list = Array.from(sessions.values());

    if (databaseId) {
      list = list.filter((s) => s.database_id === databaseId);
    }

    if (pattern) {
      const keyword = pattern.replaceAll('%', '').toLowerCase();
      list = list.filter(
        (s) => s.title.toLowerCase().includes(keyword) || s.preview.toLowerCase().includes(keyword),
      );
    }

    if (cursorUpdatedAt && cursorId) {
      list = list.filter(
        (s) => s.updated_at < cursorUpdatedAt || (s.updated_at === cursorUpdatedAt && s.id < cursorId),
      );
    }

    list.sort((a, b) => {
      if (a.updated_at !== b.updated_at) {
        return b.updated_at.localeCompare(a.updated_at);
      }
      return b.id.localeCompare(a.id);
    });

    return list.slice(0, limitPlusOne).map((row) => ({ ...row }));
  }

  const db: MockD1Database = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              if (query.includes('INSERT INTO query_sessions')) {
                const [id, databaseId, title, preview, createdAt, updatedAt] = values;
                sessions.set(String(id), {
                  id: String(id),
                  database_id: String(databaseId),
                  title: String(title),
                  preview: String(preview),
                  created_at: String(createdAt),
                  updated_at: String(updatedAt),
                });
                return { success: true, meta: { changes: 1 } };
              }

              if (query.includes('INSERT INTO query_session_messages')) {
                const [id, sessionId, sequence, role, content, sql, warning, error, createdAt] = values;
                messages.set(String(id), {
                  id: String(id),
                  session_id: String(sessionId),
                  sequence: Number(sequence),
                  role: role as 'user' | 'assistant',
                  content: String(content),
                  sql: sql === undefined ? undefined : String(sql),
                  warning: warning === undefined ? undefined : String(warning),
                  error: error === undefined ? undefined : String(error),
                  created_at: String(createdAt),
                });
                return { success: true, meta: { changes: 1 } };
              }

              if (query.startsWith('UPDATE query_sessions SET preview')) {
                const [preview, updatedAt, id] = values;
                const row = sessions.get(String(id));
                if (!row) return { success: true, meta: { changes: 0 } };
                sessions.set(String(id), {
                  ...row,
                  preview: String(preview),
                  updated_at: String(updatedAt),
                });
                return { success: true, meta: { changes: 1 } };
              }

              if (query.startsWith('UPDATE query_sessions SET title')) {
                const [title, updatedAt, id] = values;
                const row = sessions.get(String(id));
                if (!row) return { success: true, meta: { changes: 0 } };
                sessions.set(String(id), {
                  ...row,
                  title: String(title),
                  updated_at: String(updatedAt),
                });
                return { success: true, meta: { changes: 1 } };
              }

              if (query.startsWith('DELETE FROM query_sessions')) {
                const [id] = values;
                const existed = sessions.delete(String(id));
                if (existed) {
                  for (const [messageId, message] of messages.entries()) {
                    if (message.session_id === String(id)) {
                      messages.delete(messageId);
                    }
                  }
                }
                return { success: true, meta: { changes: existed ? 1 : 0 } };
              }

              return { success: true, meta: { changes: 0 } };
            },
            async all() {
              if (query.includes('FROM query_sessions') && query.includes('ORDER BY updated_at DESC')) {
                let index = 0;
                const databaseId = query.includes('database_id = ?') ? String(values[index++]) : null;
                const pattern = query.includes('title LIKE ?') ? String(values[index++]) : null;
                if (pattern) index += 1; // preview LIKE
                const hasCursor = query.includes('updated_at < ?');
                const cursorUpdatedAt = hasCursor ? String(values[index++]) : null;
                if (hasCursor) index += 1; // updated_at = ?
                const cursorId = hasCursor ? String(values[index++]) : null;
                const limitPlusOne = Number(values[index++]);

                const results = listSessions({ databaseId, pattern, cursorUpdatedAt, cursorId, limitPlusOne });
                return { results };
              }

              if (query.includes('FROM query_session_messages') && query.includes('ORDER BY sequence ASC')) {
                const [sessionId] = values;
                const result = Array.from(messages.values())
                  .filter((m) => m.session_id === String(sessionId))
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((row) => ({ ...row }));
                return { results: result };
              }

              return { results: [] };
            },
            async first() {
              if (query.includes('FROM database_connections')) {
                const [id] = values;
                if (connectionRow && String(id) === connectionRow.id) {
                  return { ...connectionRow };
                }
                return null;
              }

              if (query.includes('FROM query_sessions') && query.includes('WHERE id = ?')) {
                const [id] = values;
                const row = sessions.get(String(id));
                return row ? { ...row } : null;
              }

              if (query.includes('FROM query_sessions') && query.includes('SELECT id, preview')) {
                const [id] = values;
                const row = sessions.get(String(id));
                return row ? { id: row.id, preview: row.preview } : null;
              }

              if (query.includes('MAX(sequence)') && query.includes('FROM query_session_messages')) {
                const [sessionId] = values;
                const max = Array.from(messages.values())
                  .filter((m) => m.session_id === String(sessionId))
                  .reduce((acc, item) => Math.max(acc, item.sequence), 0);
                return { max_sequence: max === 0 ? null : max };
              }

              return null;
            },
          };
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };

  return db;
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

describe('Query Session Routes', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;

  beforeEach(() => {
    const now = new Date('2026-02-14T00:00:00.000Z').toISOString();
    const connectionRow: MockDatabaseConnectionRow = {
      id: 'db-1',
      name: 'test-db',
      type: 'mysql',
      host: '127.0.0.1',
      port: '3306',
      database_name: 'app',
      username: 'root',
      key_path: 'vibedb/databases/db-1/password',
      created_at: now,
      updated_at: now,
    };

    const db = createMockDb(connectionRow);
    env = createEnv(db);
    app = new Hono<{ Bindings: Env }>();
    app.route('/query-sessions', querySessionRoutes);
  });

  it('POST /query-sessions 创建会话并可通过详情接口取回消息', async () => {
    const res = await app.request(
      '/query-sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseId: 'db-1',
          title: '查询订单',
          messages: [
            { id: 'u-1', role: 'user', content: '查询订单' },
            { id: 'a-1', role: 'assistant', content: '已生成 SQL', sql: 'SELECT * FROM orders' },
          ],
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      success: boolean;
      data?: { session: { id: string; title: string; databaseId: string; preview: string } };
    };
    expect(json.success).toBe(true);
    expect(json.data?.session.title).toBe('查询订单');
    expect(json.data?.session.databaseId).toBe('db-1');
    expect(json.data?.session.preview).toContain('查询订单');

    const id = json.data?.session.id;
    expect(typeof id).toBe('string');

    const detail = await app.request(`/query-sessions/${id}`, undefined, env);
    expect(detail.status).toBe(200);
    const detailJson = (await detail.json()) as {
      success: boolean;
      data?: { messages: Array<{ id: string; role: string; content: string; sequence: number; sql?: string }> };
    };

    expect(detailJson.success).toBe(true);
    expect(detailJson.data?.messages.length).toBe(2);
    expect(detailJson.data?.messages[0]).toMatchObject({ id: 'u-1', role: 'user', content: '查询订单', sequence: 1 });
    expect(detailJson.data?.messages[1]).toMatchObject({
      id: 'a-1',
      role: 'assistant',
      content: '已生成 SQL',
      sequence: 2,
      sql: 'SELECT * FROM orders',
    });
  });

  it('POST /query-sessions/:id/messages 应追加消息并递增 sequence', async () => {
    const created = await app.request(
      '/query-sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseId: 'db-1',
          title: '第一次查询',
          messages: [{ id: 'u-1', role: 'user', content: '查询订单' }],
        }),
      },
      env,
    );
    const createdJson = (await created.json()) as { data?: { session: { id: string } } };
    const sessionId = createdJson.data?.session.id;
    expect(typeof sessionId).toBe('string');

    const append = await app.request(
      `/query-sessions/${sessionId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { id: 'a-1', role: 'assistant', content: '已生成 SQL', sql: 'SELECT * FROM orders' },
            { id: 'u-2', role: 'user', content: '只看最近 7 天' },
          ],
        }),
      },
      env,
    );
    expect(append.status).toBe(200);

    const detail = await app.request(`/query-sessions/${sessionId}`, undefined, env);
    const detailJson = (await detail.json()) as {
      data?: { messages: Array<{ id: string; sequence: number }> };
    };
    expect(detailJson.data?.messages.map((m) => [m.id, m.sequence])).toEqual([
      ['u-1', 1],
      ['a-1', 2],
      ['u-2', 3],
    ]);
  });

  it('GET /query-sessions 支持 limit + cursor 翻页，并支持 q 搜索', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-02-14T01:00:00.000Z'));
      await app.request(
        '/query-sessions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ databaseId: 'db-1', title: '查用户', messages: [{ id: 'u-1', role: 'user', content: 'users' }] }),
        },
        env,
      );

      vi.setSystemTime(new Date('2026-02-14T02:00:00.000Z'));
      await app.request(
        '/query-sessions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ databaseId: 'db-1', title: '查订单', messages: [{ id: 'u-2', role: 'user', content: 'orders' }] }),
        },
        env,
      );

      vi.setSystemTime(new Date('2026-02-14T03:00:00.000Z'));
      await app.request(
        '/query-sessions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ databaseId: 'db-1', title: '查退款', messages: [{ id: 'u-3', role: 'user', content: 'refunds' }] }),
        },
        env,
      );
    } finally {
      vi.useRealTimers();
    }

    const firstPage = await app.request('/query-sessions?limit=2', undefined, env);
    const firstJson = (await firstPage.json()) as {
      data?: {
        sessions: Array<{ title: string; updatedAt: string; id: string }>;
        nextCursor: { updatedAt: string; id: string } | null;
        hasMore: boolean;
      };
    };
    expect(firstJson.data?.sessions.map((s) => s.title)).toEqual(['查退款', '查订单']);
    expect(firstJson.data?.hasMore).toBe(true);
    expect(firstJson.data?.nextCursor).not.toBeNull();

    const cursor = firstJson.data?.nextCursor;
    const secondPage = await app.request(
      `/query-sessions?limit=2&cursorUpdatedAt=${encodeURIComponent(cursor!.updatedAt)}&cursorId=${cursor!.id}`,
      undefined,
      env,
    );
    const secondJson = (await secondPage.json()) as {
      data?: { sessions: Array<{ title: string }>; hasMore: boolean };
    };
    expect(secondJson.data?.sessions.map((s) => s.title)).toEqual(['查用户']);
    expect(secondJson.data?.hasMore).toBe(false);

    const searchRes = await app.request('/query-sessions?q=%E8%AE%A2%E5%8D%95', undefined, env);
    const searchJson = (await searchRes.json()) as { data?: { sessions: Array<{ title: string }> } };
    expect(searchJson.data?.sessions.map((s) => s.title)).toEqual(['查订单']);
  });

  it('PATCH /query-sessions/:id 可重命名，DELETE 可删除', async () => {
    const created = await app.request(
      '/query-sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseId: 'db-1', title: '旧标题', messages: [{ id: 'u-1', role: 'user', content: 'hi' }] }),
      },
      env,
    );
    const createdJson = (await created.json()) as { data?: { session: { id: string } } };
    const id = createdJson.data?.session.id;
    expect(typeof id).toBe('string');

    const renamed = await app.request(
      `/query-sessions/${id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新标题' }),
      },
      env,
    );
    expect(renamed.status).toBe(200);
    const renamedJson = (await renamed.json()) as { data?: { session: { title: string } } };
    expect(renamedJson.data?.session.title).toBe('新标题');

    const deleted = await app.request(`/query-sessions/${id}`, { method: 'DELETE' }, env);
    expect(deleted.status).toBe(200);

    const detail = await app.request(`/query-sessions/${id}`, undefined, env);
    expect(detail.status).toBe(404);
  });
});

