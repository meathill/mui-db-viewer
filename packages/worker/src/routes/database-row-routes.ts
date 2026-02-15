import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { ApiResponse } from '../types';
import { findConnectionById, getErrorMessage, withDatabaseService } from './database-shared';
import { parseDeleteRowsRequest, parseInsertRowRequest, parseUpdateRowsRequest } from './request-validation';

export const databaseRowRoutes = new Hono<{ Bindings: CloudflareBindings }>();

databaseRowRoutes.post(
  '/:id/tables/:tableName/rows/delete',
  validator('json', (body, c) => {
    const result = parseDeleteRowsRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param('id');
    const tableName = c.req.param('tableName');
    const body = c.req.valid('json');

    const connection = await findConnectionById(c.env, id);
    if (!connection) {
      return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
    }

    try {
      await withDatabaseService(c.env, connection, async (dbService) => dbService.deleteRows(tableName, body.ids));
      return c.json<ApiResponse>({ success: true });
    } catch (error) {
      console.error('删除行失败:', error);
      return c.json<ApiResponse>({ success: false, error: getErrorMessage(error, '删除失败') }, 500);
    }
  },
);

databaseRowRoutes.post(
  '/:id/tables/:tableName/rows',
  validator('json', (body, c) => {
    const result = parseInsertRowRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param('id');
    const tableName = c.req.param('tableName');
    const data = c.req.valid('json');

    const connection = await findConnectionById(c.env, id);
    if (!connection) {
      return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
    }

    try {
      await withDatabaseService(c.env, connection, async (dbService) => dbService.insertRow(tableName, data));
      return c.json<ApiResponse>({ success: true });
    } catch (error) {
      console.error('插入行失败:', error);
      return c.json<ApiResponse>({ success: false, error: getErrorMessage(error, '插入失败') }, 500);
    }
  },
);

databaseRowRoutes.put(
  '/:id/tables/:tableName/rows',
  validator('json', (body, c) => {
    const result = parseUpdateRowsRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param('id');
    const tableName = c.req.param('tableName');
    const body = c.req.valid('json');

    const connection = await findConnectionById(c.env, id);
    if (!connection) {
      return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
    }

    try {
      const result = await withDatabaseService(c.env, connection, async (dbService) =>
        dbService.updateRows(tableName, body.rows),
      );
      return c.json<ApiResponse>({ success: true, data: result });
    } catch (error) {
      console.error('更新行失败:', error);
      return c.json<ApiResponse>({ success: false, error: getErrorMessage(error, '更新失败') }, 500);
    }
  },
);
