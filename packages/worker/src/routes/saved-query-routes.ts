/**
 * 保存查询路由
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { ApiResponse, SavedQuery } from '../types';
import { getErrorMessage } from './database-shared';
import { parseCreateSavedQueryRequest, parseUpdateSavedQueryRequest } from './request-validation';

const savedQueryRoutes = new Hono<{ Bindings: CloudflareBindings }>();

interface SavedQueryRow {
  id: string;
  name: string;
  description: string | null;
  sql: string;
  database_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * 创建保存查询
 * POST /api/v1/saved-queries
 */
savedQueryRoutes.post(
  '/',
  validator('json', (body, c) => {
    const result = parseCreateSavedQueryRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const body = c.req.valid('json');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const savedQuery: SavedQuery = {
      id,
      name: body.name,
      description: body.description,
      sql: body.sql,
      databaseId: body.databaseId,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await c.env.DB.prepare(
        `INSERT INTO saved_queries (id, name, description, sql, database_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          savedQuery.id,
          savedQuery.name,
          savedQuery.description,
          savedQuery.sql,
          savedQuery.databaseId,
          savedQuery.createdAt,
          savedQuery.updatedAt,
        )
        .run();

      return c.json<ApiResponse<SavedQuery>>(
        {
          success: true,
          data: savedQuery,
        },
        201,
      );
    } catch (error) {
      console.error('创建保存查询失败:', error);
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
 * 获取保存查询列表
 * GET /api/v1/saved-queries?databaseId=xxx
 */
savedQueryRoutes.get('/', async (c) => {
  const databaseId = c.req.query('databaseId');

  try {
    let query = 'SELECT * FROM saved_queries';
    const params: string[] = [];

    if (databaseId) {
      query += ' WHERE database_id = ?';
      params.push(databaseId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await c.env.DB.prepare(query)
      .bind(...params)
      .all<SavedQueryRow>();

    const queries: SavedQuery[] = result.results.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      sql: row.sql,
      databaseId: row.database_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return c.json<ApiResponse<SavedQuery[]>>({
      success: true,
      data: queries,
    });
  } catch (error) {
    console.error('获取保存查询列表失败:', error);
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
 * 删除保存查询
 * DELETE /api/v1/saved-queries/:id
 */
savedQueryRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const result = await c.env.DB.prepare('DELETE FROM saved_queries WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
      return c.json<ApiResponse>({ success: false, error: '查询不存在' }, 404);
    }

    return c.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error('删除保存查询失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: getErrorMessage(error, '删除失败'),
      },
      500,
    );
  }
});

export { savedQueryRoutes };
