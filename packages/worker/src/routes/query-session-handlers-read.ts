import type { ApiResponse } from '../types';
import { getErrorMessage } from './database-shared';
import {
  clampLimit,
  deriveCursorFromSessions,
  normalizeSearch,
  toQuerySession,
  toQuerySessionMessage,
  type QuerySessionDetailResponse,
  type QuerySessionListResponse,
  type QuerySessionMessageRow,
  type QuerySessionRow,
} from './query-session-shared';
import type { WorkerContext } from './query-session-handler-types';

export async function handleListQuerySessions(c: WorkerContext) {
  const limit = clampLimit(c.req.query('limit'));
  const q = normalizeSearch(c.req.query('q'));
  const databaseId = normalizeSearch(c.req.query('databaseId'));

  const cursorUpdatedAt = normalizeSearch(c.req.query('cursorUpdatedAt'));
  const cursorId = normalizeSearch(c.req.query('cursorId'));
  const hasCursor = Boolean(cursorUpdatedAt && cursorId);

  try {
    let query = 'SELECT id, database_id, title, preview, created_at, updated_at FROM query_sessions';
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (databaseId) {
      whereClauses.push('database_id = ?');
      params.push(databaseId);
    }

    if (q) {
      whereClauses.push('(title LIKE ? COLLATE NOCASE OR preview LIKE ? COLLATE NOCASE)');
      const pattern = `%${q}%`;
      params.push(pattern, pattern);
    }

    if (hasCursor) {
      whereClauses.push('(updated_at < ? OR (updated_at = ? AND id < ?))');
      params.push(cursorUpdatedAt, cursorUpdatedAt, cursorId);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ' ORDER BY updated_at DESC, id DESC LIMIT ?';
    params.push(limit + 1);

    const result = await c.env.DB.prepare(query)
      .bind(...params)
      .all<QuerySessionRow>();

    const mapped = result.results.map((row) => toQuerySession(row as unknown as QuerySessionRow));

    const hasMore = mapped.length > limit;
    const sessions = mapped.slice(0, limit);
    const nextCursor = hasMore ? deriveCursorFromSessions(sessions) : null;

    return c.json<ApiResponse<QuerySessionListResponse>>({
      success: true,
      data: {
        sessions,
        nextCursor,
        hasMore,
      },
    });
  } catch (error) {
    console.error('获取查询会话列表失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: getErrorMessage(error, '获取列表失败'),
      },
      500,
    );
  }
}

export async function handleGetQuerySessionDetail(c: WorkerContext) {
  const id = c.req.param('id');

  try {
    const sessionRow = await c.env.DB.prepare(
      'SELECT id, database_id, title, preview, created_at, updated_at FROM query_sessions WHERE id = ?',
    )
      .bind(id)
      .first<QuerySessionRow>();

    if (!sessionRow) {
      return c.json<ApiResponse>({ success: false, error: '查询会话不存在' }, 404);
    }

    const messageResult = await c.env.DB.prepare(
      `SELECT id, session_id, sequence, role, content, sql, warning, error, created_at
       FROM query_session_messages
       WHERE session_id = ?
       ORDER BY sequence ASC`,
    )
      .bind(id)
      .all<QuerySessionMessageRow>();

    const messages = messageResult.results.map((row) =>
      toQuerySessionMessage(row as unknown as QuerySessionMessageRow),
    );

    return c.json<ApiResponse<QuerySessionDetailResponse>>({
      success: true,
      data: {
        session: toQuerySession(sessionRow as unknown as QuerySessionRow),
        messages,
      },
    });
  } catch (error) {
    console.error('获取查询会话详情失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: getErrorMessage(error, '获取详情失败'),
      },
      500,
    );
  }
}
