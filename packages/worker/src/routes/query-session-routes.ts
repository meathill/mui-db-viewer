/**
 * 查询会话历史路由
 *
 * 目标：
 * - 自动保存 AI 查询对话（用户 prompt + AI 生成结果）
 * - 支持查询会话的列表（分页/搜索）、详情、重命名、删除
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { ApiResponse, Env, QuerySession, QuerySessionMessage } from '../types';
import { findConnectionById, getErrorMessage } from './database-shared';
import {
  parseAppendQuerySessionMessagesRequest,
  parseCreateQuerySessionRequest,
  parseUpdateQuerySessionRequest,
} from './request-validation';

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

interface QuerySessionCursor {
  updatedAt: string;
  id: string;
}

interface QuerySessionListResponse {
  sessions: QuerySession[];
  nextCursor: QuerySessionCursor | null;
  hasMore: boolean;
}

interface QuerySessionDetailResponse {
  session: QuerySession;
  messages: QuerySessionMessage[];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const querySessionRoutes = new Hono<{ Bindings: Env }>();

function toQuerySession(row: QuerySessionRow): QuerySession {
  return {
    id: row.id,
    databaseId: row.database_id,
    title: row.title,
    preview: row.preview,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toQuerySessionMessage(row: QuerySessionMessageRow): QuerySessionMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    sequence: Number(row.sequence),
    role: row.role,
    content: row.content,
    sql: row.sql,
    warning: row.warning,
    error: row.error,
    createdAt: row.created_at,
  };
}

function clampLimit(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? String(DEFAULT_LIMIT), 10);
  if (Number.isNaN(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function normalizeSearch(value: string | undefined): string | null {
  const text = (value ?? '').trim();
  return text.length > 0 ? text : null;
}

function derivePreviewFromMessages(messages: Array<{ role: 'user' | 'assistant'; content: string }>): string {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  const source = lastUser?.content.trim() ?? messages[0]?.content?.trim() ?? '';
  return source.slice(0, 160);
}

function deriveCursorFromSessions(sessions: QuerySession[]): QuerySessionCursor | null {
  if (sessions.length === 0) return null;
  const last = sessions[sessions.length - 1];
  return { updatedAt: last.updatedAt, id: last.id };
}

/**
 * 创建查询会话
 * POST /api/v1/query-sessions
 */
querySessionRoutes.post(
  '/',
  validator('json', (body, c) => {
    const result = parseCreateQuerySessionRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const body = c.req.valid('json');
    const connection = await findConnectionById(c.env, body.databaseId);
    if (!connection) {
      return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const messages = body.messages ?? [];
    const preview = (body.preview ?? '').trim() || derivePreviewFromMessages(messages);

    const session: QuerySession = {
      id,
      databaseId: body.databaseId,
      title: body.title,
      preview,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await c.env.DB.prepare(
        `INSERT INTO query_sessions (id, database_id, title, preview, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(session.id, session.databaseId, session.title, session.preview, session.createdAt, session.updatedAt)
        .run();

      if (messages.length > 0) {
        for (let i = 0; i < messages.length; i += 1) {
          const message = messages[i];
          const messageRow: QuerySessionMessage = {
            id: message.id,
            sessionId: session.id,
            sequence: i + 1,
            role: message.role,
            content: message.content,
            sql: message.sql,
            warning: message.warning,
            error: message.error,
            createdAt: now,
          };

          await c.env.DB.prepare(
            `INSERT INTO query_session_messages (id, session_id, sequence, role, content, sql, warning, error, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
            .bind(
              messageRow.id,
              messageRow.sessionId,
              messageRow.sequence,
              messageRow.role,
              messageRow.content,
              messageRow.sql,
              messageRow.warning,
              messageRow.error,
              messageRow.createdAt,
            )
            .run();
        }
      }

      return c.json<ApiResponse<{ session: QuerySession }>>(
        {
          success: true,
          data: { session },
        },
        201,
      );
    } catch (error) {
      console.error('创建查询会话失败:', error);
      return c.json<ApiResponse>(
        {
          success: false,
          error: getErrorMessage(error, '创建失败'),
        },
        500,
      );
    }
  },
);

/**
 * 获取查询会话列表（分页 + 搜索）
 * GET /api/v1/query-sessions?limit=20&q=xxx&databaseId=xxx&cursorUpdatedAt=...&cursorId=...
 */
querySessionRoutes.get('/', async (c) => {
  const limit = clampLimit(c.req.query('limit'));
  const q = normalizeSearch(c.req.query('q'));
  const databaseId = normalizeSearch(c.req.query('databaseId'));

  const cursorUpdatedAt = normalizeSearch(c.req.query('cursorUpdatedAt'));
  const cursorId = normalizeSearch(c.req.query('cursorId'));
  const hasCursor = Boolean(cursorUpdatedAt && cursorId);

  try {
    let query =
      'SELECT id, database_id, title, preview, created_at, updated_at FROM query_sessions';
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
});

/**
 * 获取查询会话详情（含消息列表）
 * GET /api/v1/query-sessions/:id
 */
querySessionRoutes.get('/:id', async (c) => {
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

    const messages = messageResult.results.map((row) => toQuerySessionMessage(row as unknown as QuerySessionMessageRow));

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
});

/**
 * 追加会话消息（用于自动保存）
 * POST /api/v1/query-sessions/:id/messages
 */
querySessionRoutes.post(
  '/:id/messages',
  validator('json', (body, c) => {
    const result = parseAppendQuerySessionMessagesRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');

    try {
      const sessionRow = await c.env.DB.prepare('SELECT id, preview FROM query_sessions WHERE id = ?').bind(id).first<{
        id: string;
        preview: string;
      }>();
      if (!sessionRow) {
        return c.json<ApiResponse>({ success: false, error: '查询会话不存在' }, 404);
      }

      const maxSequenceRow = await c.env.DB.prepare(
        'SELECT MAX(sequence) AS max_sequence FROM query_session_messages WHERE session_id = ?',
      )
        .bind(id)
        .first<{ max_sequence: number | null }>();
      const maxSequence = Number(maxSequenceRow?.max_sequence ?? 0);

      const now = new Date().toISOString();
      const messages = body.messages;

      for (let i = 0; i < messages.length; i += 1) {
        const message = messages[i];
        const sequence = maxSequence + i + 1;

        await c.env.DB.prepare(
          `INSERT INTO query_session_messages (id, session_id, sequence, role, content, sql, warning, error, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            message.id,
            id,
            sequence,
            message.role,
            message.content,
            message.sql,
            message.warning,
            message.error,
            now,
          )
          .run();
      }

      const preview =
        derivePreviewFromMessages(messages) || (sessionRow.preview ?? '');

      await c.env.DB.prepare('UPDATE query_sessions SET preview = ?, updated_at = ? WHERE id = ?')
        .bind(preview, now, id)
        .run();

      return c.json<ApiResponse>({ success: true });
    } catch (error) {
      console.error('追加查询会话消息失败:', error);
      return c.json<ApiResponse>(
        {
          success: false,
          error: getErrorMessage(error, '保存失败'),
        },
        500,
      );
    }
  },
);

/**
 * 重命名查询会话
 * PATCH /api/v1/query-sessions/:id
 */
querySessionRoutes.patch(
  '/:id',
  validator('json', (body, c) => {
    const result = parseUpdateQuerySessionRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');

    if (!body.title) {
      return c.json<ApiResponse>({ success: false, error: '缺少 title' }, 400);
    }

    const now = new Date().toISOString();

    try {
      const result = await c.env.DB.prepare('UPDATE query_sessions SET title = ?, updated_at = ? WHERE id = ?')
        .bind(body.title, now, id)
        .run();

      const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
      if (changes === 0) {
        return c.json<ApiResponse>({ success: false, error: '查询会话不存在' }, 404);
      }

      const updated = await c.env.DB.prepare(
        'SELECT id, database_id, title, preview, created_at, updated_at FROM query_sessions WHERE id = ?',
      )
        .bind(id)
        .first<QuerySessionRow>();

      if (!updated) {
        return c.json<ApiResponse>({ success: false, error: '查询会话不存在' }, 404);
      }

      return c.json<ApiResponse<{ session: QuerySession }>>({
        success: true,
        data: { session: toQuerySession(updated as unknown as QuerySessionRow) },
      });
    } catch (error) {
      console.error('重命名查询会话失败:', error);
      return c.json<ApiResponse>(
        {
          success: false,
          error: getErrorMessage(error, '重命名失败'),
        },
        500,
      );
    }
  },
);

/**
 * 删除查询会话
 * DELETE /api/v1/query-sessions/:id
 */
querySessionRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const result = await c.env.DB.prepare('DELETE FROM query_sessions WHERE id = ?').bind(id).run();
    const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;

    if (changes === 0) {
      return c.json<ApiResponse>({ success: false, error: '查询会话不存在' }, 404);
    }

    return c.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error('删除查询会话失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: getErrorMessage(error, '删除失败'),
      },
      500,
    );
  }
});

export { querySessionRoutes };

