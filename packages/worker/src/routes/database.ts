/**
 * 数据库连接配置路由
 * 实现密码的 HSM 加密存储与数据浏览能力
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { createHsmClient } from '../services/hsm';
import type { ApiResponse, DatabaseConnection, Env, TableColumn, TableRow } from '../types';
import {
  findConnectionById,
  getErrorMessage,
  listConnections,
  parseTableQueryOptions,
  withDatabaseService,
} from './database-shared';
import {
  parseCreateDatabaseRequest,
  parseDeleteRowsRequest,
  parseInsertRowRequest,
  parseUpdateRowsRequest,
} from './request-validation';

const databaseRoutes = new Hono<{ Bindings: Env }>();

interface TableDataResponse {
  rows: TableRow[];
  total: number;
  columns: TableColumn[];
}

async function loadTableData(
  env: Env,
  connection: DatabaseConnection,
  tableName: string,
  query: Record<string, string | undefined>,
): Promise<TableDataResponse> {
  const options = parseTableQueryOptions(query);

  return withDatabaseService(env, connection, async (dbService) => {
    const result = await dbService.getTableData(tableName, options);
    const schema = await dbService.getTableSchema(tableName);

    return {
      rows: result.data,
      total: result.total,
      columns: schema,
    };
  });
}

/**
 * 创建数据库连接
 * POST /api/v1/databases
 */
databaseRoutes.post(
  '/',
  validator('json', (body, c) => {
    const result = parseCreateDatabaseRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const body = c.req.valid('json');

    const id = crypto.randomUUID();
    const keyPath = `vibedb/databases/${id}/password`;
    const now = new Date().toISOString();

    const connection: DatabaseConnection = {
      id,
      name: body.name,
      type: body.type,
      host: body.host,
      port: body.port,
      database: body.database,
      username: body.username,
      keyPath,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const hsm = createHsmClient({
        url: c.env.HSM_URL,
        secret: c.env.HSM_SECRET,
      });
      await hsm.encrypt(keyPath, body.password);

      await c.env.DB.prepare(
        `INSERT INTO database_connections (id, name, type, host, port, database_name, username, key_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          connection.id,
          connection.name,
          connection.type,
          connection.host,
          connection.port,
          connection.database,
          connection.username,
          connection.keyPath,
          connection.createdAt,
          connection.updatedAt,
        )
        .run();

      return c.json<ApiResponse<DatabaseConnection>>(
        {
          success: true,
          data: connection,
        },
        201,
      );
    } catch (error) {
      console.error('创建数据库连接失败:', error);
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
 * 获取所有数据库连接
 * GET /api/v1/databases
 */
databaseRoutes.get('/', async (c) => {
  const connections = await listConnections(c.env);
  return c.json<ApiResponse<DatabaseConnection[]>>({
    success: true,
    data: connections,
  });
});

/**
 * 获取单个数据库连接
 * GET /api/v1/databases/:id
 */
databaseRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const connection = await findConnectionById(c.env, id);

  if (!connection) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: '数据库连接不存在',
      },
      404,
    );
  }

  return c.json<ApiResponse<DatabaseConnection>>({
    success: true,
    data: connection,
  });
});

/**
 * 删除数据库连接
 * DELETE /api/v1/databases/:id
 */
databaseRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const connection = await findConnectionById(c.env, id);

  if (!connection) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: '数据库连接不存在',
      },
      404,
    );
  }

  try {
    const hsm = createHsmClient({
      url: c.env.HSM_URL,
      secret: c.env.HSM_SECRET,
    });
    await hsm.delete(connection.keyPath);
    await c.env.DB.prepare(`DELETE FROM database_connections WHERE id = ?`).bind(id).run();

    return c.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error('删除数据库连接失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: getErrorMessage(error, '删除失败'),
      },
      500,
    );
  }
});

/**
 * 获取数据库所有表
 * GET /api/v1/databases/:id/tables
 */
databaseRoutes.get('/:id/tables', async (c) => {
  const id = c.req.param('id');
  const connection = await findConnectionById(c.env, id);

  if (!connection) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: '数据库连接不存在',
      },
      404,
    );
  }

  try {
    const tables = await withDatabaseService(c.env, connection, async (dbService) => dbService.getTables());
    return c.json<ApiResponse<string[]>>({
      success: true,
      data: tables,
    });
  } catch (error) {
    console.error('获取表列表失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: getErrorMessage(error, '获取表列表失败'),
      },
      500,
    );
  }
});

/**
 * 获取表数据
 * GET /api/v1/databases/:id/tables/:tableName/data
 */
databaseRoutes.get('/:id/tables/:tableName/data', async (c) => {
  const id = c.req.param('id');
  const tableName = c.req.param('tableName');
  const connection = await findConnectionById(c.env, id);

  if (!connection) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: '数据库连接不存在',
      },
      404,
    );
  }

  try {
    const data = await loadTableData(c.env, connection, tableName, c.req.query());
    return c.json<ApiResponse<TableDataResponse>>({
      success: true,
      data,
    });
  } catch (error) {
    console.error('获取表数据失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: getErrorMessage(error, '获取表数据失败'),
      },
      500,
    );
  }
});

/**
 * 删除表数据
 * POST /api/v1/databases/:id/tables/:tableName/rows/delete
 */
databaseRoutes.post(
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

/**
 * 插入表数据
 * POST /api/v1/databases/:id/tables/:tableName/rows
 */
databaseRoutes.post(
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

/**
 * 批量更新表数据
 * PUT /api/v1/databases/:id/tables/:tableName/rows
 */
databaseRoutes.put(
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

export { databaseRoutes, loadTableData };
