import type { ApiResponse, QuerySession, QuerySessionMessage } from '../types';
import { findConnectionById, getErrorMessage } from './database-shared';
import { derivePreviewFromMessages, toQuerySession, type QuerySessionRow } from './query-session-shared';
import type {
  AppendQuerySessionMessagesBody,
  CreateQuerySessionBody,
  UpdateQuerySessionBody,
  WorkerContext,
} from './query-session-handler-types';

export async function handleCreateQuerySession(c: WorkerContext) {
  const body = c.req.valid('json') as CreateQuerySessionBody;
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
}

export async function handleAppendQuerySessionMessages(c: WorkerContext) {
  const id = c.req.param('id');
  const body = c.req.valid('json') as AppendQuerySessionMessagesBody;

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
        .bind(message.id, id, sequence, message.role, message.content, message.sql, message.warning, message.error, now)
        .run();
    }

    const preview = derivePreviewFromMessages(messages) || (sessionRow.preview ?? '');

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
}

export async function handleRenameQuerySession(c: WorkerContext) {
  const id = c.req.param('id');
  const body = c.req.valid('json') as UpdateQuerySessionBody;

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
}

export async function handleDeleteQuerySession(c: WorkerContext) {
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
}
