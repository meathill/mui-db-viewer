import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { deleteSchemaCache } from '../services/schema-cache';
import type {
  ApiResponse,
  CreateTableRequest,
  StructureEditorContext,
  TableStructure,
  UpdateTableColumnRequest,
  UpsertTableIndexRequest,
} from '../types';
import { findConnectionById, getErrorMessage, withDatabaseService } from './database-shared';
import {
  parseCreateTableRequest,
  parseUpdateTableColumnRequest,
  parseUpsertTableIndexRequest,
} from './request-validation';

export const databaseStructureRoutes = new Hono<{ Bindings: CloudflareBindings }>();

databaseStructureRoutes.get('/:id/editor-context', async (c) => {
  const id = c.req.param('id');
  const connection = await findConnectionById(c.env, id);

  if (!connection) {
    return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
  }

  try {
    const context = await withDatabaseService(c.env, connection, async (dbService) =>
      dbService.getStructureEditorContext(),
    );
    return c.json<ApiResponse<StructureEditorContext>>({ success: true, data: context });
  } catch (error) {
    console.error('获取结构编辑上下文失败:', error);
    return c.json<ApiResponse>({ success: false, error: getErrorMessage(error, '获取结构编辑上下文失败') }, 500);
  }
});

databaseStructureRoutes.get('/:id/tables/:tableName/structure', async (c) => {
  const id = c.req.param('id');
  const tableName = c.req.param('tableName');
  const connection = await findConnectionById(c.env, id);

  if (!connection) {
    return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
  }

  try {
    const structure = await withDatabaseService(c.env, connection, async (dbService) =>
      dbService.getTableStructure(tableName),
    );
    return c.json<ApiResponse<TableStructure>>({ success: true, data: structure });
  } catch (error) {
    console.error('获取表结构失败:', error);
    return c.json<ApiResponse>({ success: false, error: getErrorMessage(error, '获取表结构失败') }, 500);
  }
});

databaseStructureRoutes.post(
  '/:id/tables',
  validator('json', (body, c) => {
    const result = parseCreateTableRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param('id');
    const payload = c.req.valid('json') as CreateTableRequest;
    const connection = await findConnectionById(c.env, id);

    if (!connection) {
      return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
    }

    try {
      await withDatabaseService(c.env, connection, async (dbService) => dbService.createTable(payload));
      await deleteSchemaCache(c.env, id);
      return c.json<ApiResponse<{ tableName: string }>>({
        success: true,
        data: { tableName: payload.tableName },
      });
    } catch (error) {
      console.error('创建数据表失败:', error);
      return c.json<ApiResponse>({ success: false, error: getErrorMessage(error, '创建数据表失败') }, 500);
    }
  },
);

databaseStructureRoutes.put(
  '/:id/tables/:tableName/columns/:columnName',
  validator('json', (body, c) => {
    const result = parseUpdateTableColumnRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param('id');
    const tableName = c.req.param('tableName');
    const columnName = c.req.param('columnName');
    const payload = c.req.valid('json') as UpdateTableColumnRequest;
    const connection = await findConnectionById(c.env, id);

    if (!connection) {
      return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
    }

    try {
      await withDatabaseService(c.env, connection, async (dbService) =>
        dbService.updateColumn(tableName, columnName, payload.column),
      );
      await deleteSchemaCache(c.env, id);
      return c.json<ApiResponse>({ success: true });
    } catch (error) {
      console.error('更新列失败:', error);
      return c.json<ApiResponse>({ success: false, error: getErrorMessage(error, '更新列失败') }, 500);
    }
  },
);

databaseStructureRoutes.post(
  '/:id/tables/:tableName/indexes',
  validator('json', (body, c) => {
    const result = parseUpsertTableIndexRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param('id');
    const tableName = c.req.param('tableName');
    const payload = c.req.valid('json') as UpsertTableIndexRequest;
    const connection = await findConnectionById(c.env, id);

    if (!connection) {
      return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
    }

    try {
      await withDatabaseService(c.env, connection, async (dbService) =>
        dbService.createIndex(tableName, payload.index),
      );
      await deleteSchemaCache(c.env, id);
      return c.json<ApiResponse>({ success: true });
    } catch (error) {
      console.error('创建索引失败:', error);
      return c.json<ApiResponse>({ success: false, error: getErrorMessage(error, '创建索引失败') }, 500);
    }
  },
);

databaseStructureRoutes.put(
  '/:id/tables/:tableName/indexes/:indexName',
  validator('json', (body, c) => {
    const result = parseUpsertTableIndexRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const id = c.req.param('id');
    const tableName = c.req.param('tableName');
    const indexName = c.req.param('indexName');
    const payload = c.req.valid('json') as UpsertTableIndexRequest;
    const connection = await findConnectionById(c.env, id);

    if (!connection) {
      return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
    }

    try {
      await withDatabaseService(c.env, connection, async (dbService) =>
        dbService.updateIndex(tableName, indexName, payload.index),
      );
      await deleteSchemaCache(c.env, id);
      return c.json<ApiResponse>({ success: true });
    } catch (error) {
      console.error('更新索引失败:', error);
      return c.json<ApiResponse>({ success: false, error: getErrorMessage(error, '更新索引失败') }, 500);
    }
  },
);
