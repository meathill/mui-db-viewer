import { Hono } from 'hono';
import type { Env } from '../types';
import { querySessionRoutes } from '../routes/query-session-routes';
import { createTestEnv } from './test-env';
import { createMockDatabaseConnectionRow, type MockDatabaseConnectionRow } from './database-route-test-utils';

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
      list = list.filter((s) => s.title.toLowerCase().includes(keyword) || s.preview.toLowerCase().includes(keyword));
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

interface TestClientOptions {
  connectionRow?: MockDatabaseConnectionRow | null;
}

export function createQuerySessionRouteTestClient(options: TestClientOptions = {}) {
  const connectionRow = options.connectionRow ?? createMockDatabaseConnectionRow({ id: 'db-1', type: 'mysql' });
  const db = createMockDb(connectionRow);

  const env: Env = createTestEnv(db);
  const app = new Hono<{ Bindings: Env }>();
  app.route('/query-sessions', querySessionRoutes);

  return {
    request(path: string, init?: RequestInit) {
      return app.request(path, init, env);
    },
  };
}
