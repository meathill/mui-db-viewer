/**
 * 查询会话历史路由
 *
 * 目标：
 * - 自动保存 AI 查询对话（用户 prompt + AI 生成结果）
 * - 支持查询会话的列表（分页/搜索）、详情、重命名、删除
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { ApiResponse } from '../types';
import {
  handleAppendQuerySessionMessages,
  handleCreateQuerySession,
  handleDeleteQuerySession,
  handleGetQuerySessionDetail,
  handleListQuerySessions,
  handleRenameQuerySession,
} from './query-session-handlers';
import {
  parseAppendQuerySessionMessagesRequest,
  parseCreateQuerySessionRequest,
  parseUpdateQuerySessionRequest,
} from './request-validation';

const querySessionRoutes = new Hono<{ Bindings: CloudflareBindings }>();

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
  handleCreateQuerySession,
);

/**
 * 获取查询会话列表（分页 + 搜索）
 * GET /api/v1/query-sessions?limit=20&q=xxx&databaseId=xxx&cursorUpdatedAt=...&cursorId=...
 */
querySessionRoutes.get('/', handleListQuerySessions);

/**
 * 获取查询会话详情（含消息列表）
 * GET /api/v1/query-sessions/:id
 */
querySessionRoutes.get('/:id', handleGetQuerySessionDetail);

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
  handleAppendQuerySessionMessages,
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
  handleRenameQuerySession,
);

/**
 * 删除查询会话
 * DELETE /api/v1/query-sessions/:id
 */
querySessionRoutes.delete('/:id', handleDeleteQuerySession);

export { querySessionRoutes };
