/**
 * 数据库连接配置路由
 * 实现密码的 HSM 加密存储
 */

import { Hono } from 'hono';
import { createHsmClient } from '../services/hsm';
import type { DatabaseConnection, CreateDatabaseRequest, ApiResponse, Env } from '../types';

const databaseRoutes = new Hono<{ Bindings: Env }>();

/**
 * 创建数据库连接
 * POST /api/v1/databases
 */
databaseRoutes.post('/', async (c) => {
  const body = await c.req.json<CreateDatabaseRequest>();
  const { name, type, host, port, database, username, password } = body;

  // 参数验证
  if (!name || !type || !host || !database || !username || !password) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: '缺少必填字段',
      },
      400,
    );
  }

  // 生成唯一 ID 和密钥路径
  const id = crypto.randomUUID();
  const keyPath = `vibedb/databases/${id}/password`;

  try {
    // 通过 HSM 加密存储密码
    const hsm = createHsmClient({
      url: c.env.HSM_URL,
      secret: c.env.HSM_SECRET,
    });
    await hsm.encrypt(keyPath, password);

    // 存储连接配置（不含明文密码）
    const connection: DatabaseConnection = {
      id,
      name,
      type: type as DatabaseConnection['type'],
      host,
      port: port || '3306',
      database,
      username,
      keyPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 存储到 D1
    await c.env.DB.prepare(
      `INSERT INTO database_connections (id, name, type, host, port, database_name, username, key_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        name,
        type,
        host,
        port || '3306',
        database,
        username,
        keyPath,
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
        error: error instanceof Error ? error.message : '创建失败',
      },
      500,
    );
  }
});

/**
 * 获取所有数据库连接
 * GET /api/v1/databases
 */
databaseRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM database_connections`).all();

  // 转换字段名 (snake_case -> camelCase)
  const connections = results.map((row: any) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    host: row.host,
    port: row.port,
    database: row.database_name,
    username: row.username,
    keyPath: row.key_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

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
  const result = await c.env.DB.prepare(`SELECT * FROM database_connections WHERE id = ?`).bind(id).first();

  if (!result) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: '数据库连接不存在',
      },
      404,
    );
  }

  const connection: DatabaseConnection = {
    id: result.id as string,
    name: result.name as string,
    type: result.type as DatabaseConnection['type'],
    host: result.host as string,
    port: result.port as string,
    database: result.database_name as string,
    username: result.username as string,
    keyPath: result.key_path as string,
    createdAt: result.created_at as string,
    updatedAt: result.updated_at as string,
  };

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
  const result = await c.env.DB.prepare(`SELECT * FROM database_connections WHERE id = ?`).bind(id).first();

  if (!result) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: '数据库连接不存在',
      },
      404,
    );
  }

  const connectionKeyPath = result.key_path as string;

  try {
    // 从 HSM 删除密钥
    const hsm = createHsmClient({
      url: c.env.HSM_URL,
      secret: c.env.HSM_SECRET,
    });
    await hsm.delete(connectionKeyPath);

    // 删除 D1 记录
    await c.env.DB.prepare(`DELETE FROM database_connections WHERE id = ?`).bind(id).run();

    return c.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('删除数据库连接失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除失败',
      },
      500,
    );
  }
});

import { DatabaseService } from '../services/db';

// ... existing code ...

/**
 * 获取数据库所有表
 * GET /api/v1/databases/:id/tables
 */
databaseRoutes.get('/:id/tables', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(`SELECT * FROM database_connections WHERE id = ?`).bind(id).first();

  if (!result) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: '数据库连接不存在',
      },
      404,
    );
  }

  // 构造 connection 对象
  const connection: DatabaseConnection = {
    id: result.id as string,
    name: result.name as string,
    type: result.type as DatabaseConnection['type'],
    host: result.host as string,
    port: result.port as string,
    database: result.database_name as string,
    username: result.username as string,
    keyPath: result.key_path as string,
    createdAt: result.created_at as string,
    updatedAt: result.updated_at as string,
  };

  try {
    // 从 HSM 获取密码
    const hsm = createHsmClient({
      url: c.env.HSM_URL,
      secret: c.env.HSM_SECRET,
    });
    const password = await hsm.decrypt(connection.keyPath);

    // 连接数据库
    const dbService = new DatabaseService(connection, password, c.env);
    const tables = await dbService.getTables();
    await dbService.disconnect();

    return c.json<ApiResponse<string[]>>({
      success: true,
      data: tables,
    });
  } catch (error) {
    console.error('获取表列表失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: `[Debug: HSM_URL=${c.env.HSM_URL}] ${error instanceof Error ? error.message : '获取表列表失败'}`,
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
  const result = await c.env.DB.prepare(`SELECT * FROM database_connections WHERE id = ?`).bind(id).first();

  if (!result) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: '数据库连接不存在',
      },
      404,
    );
  }

  // 构造 connection 对象
  const connection: DatabaseConnection = {
    id: result.id as string,
    name: result.name as string,
    type: result.type as DatabaseConnection['type'],
    host: result.host as string,
    port: result.port as string,
    database: result.database_name as string,
    username: result.username as string,
    keyPath: result.key_path as string,
    createdAt: result.created_at as string,
    updatedAt: result.updated_at as string,
  };

  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const sortField = c.req.query('sortField');
  const sortOrder = c.req.query('sortOrder') as 'asc' | 'desc' | undefined;

  // 简单的过滤参数提取: filter_columnName=value
  const filters: Record<string, any> = {};
  const query = c.req.query();
  for (const key in query) {
    if (key.startsWith('filter_')) {
      const field = key.replace('filter_', '');
      filters[field] = query[key];
    }
  }
  // 全局搜索支持
  if (query._search) {
    filters._search = query._search;
  }

  try {
    // 从 HSM 获取密码
    const hsm = createHsmClient({
      url: c.env.HSM_URL,
      secret: c.env.HSM_SECRET,
    });
    const password = await hsm.decrypt(connection.keyPath);

    // 连接数据库
    const dbService = new DatabaseService(connection, password, c.env);
    const result = await dbService.getTableData(tableName, {
      page,
      pageSize,
      sortField,
      sortOrder,
      filters,
    });

    // 获取表结构用于前端展示
    const schema = await dbService.getTableSchema(tableName);

    await dbService.disconnect();

    return c.json<
      ApiResponse<{
        rows: any[];
        total: number;
        columns: any[];
      }>
    >({
      success: true,
      data: {
        rows: result.data,
        total: result.total,
        columns: schema,
      },
    });
  } catch (error) {
    console.error('获取表数据失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: `[Debug: HSM_URL=${c.env.HSM_URL}] ${error instanceof Error ? error.message : '获取表数据失败'}`,
      },
      500,
    );
  }
});

/**
 * 删除表数据
 * POST /api/v1/databases/:id/tables/:tableName/rows/delete
 */
databaseRoutes.post('/:id/tables/:tableName/rows/delete', async (c) => {
  const id = c.req.param('id');
  const tableName = c.req.param('tableName');
  const { ids } = await c.req.json<{ ids: any[] }>();

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return c.json<ApiResponse>({ success: false, error: '请选择要删除的行' }, 400);
  }

  const result = await c.env.DB.prepare(`SELECT * FROM database_connections WHERE id = ?`).bind(id).first();

  if (!result) {
    return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
  }

  const connectionKeyPath = result.key_path as string;

  try {
    const hsm = createHsmClient({ url: c.env.HSM_URL, secret: c.env.HSM_SECRET });
    const password = await hsm.decrypt(connectionKeyPath);

    const connection: DatabaseConnection = {
      id: result.id as string,
      name: result.name as string,
      type: result.type as DatabaseConnection['type'],
      host: result.host as string,
      port: result.port as string,
      database: result.database_name as string,
      username: result.username as string,
      keyPath: result.key_path as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
    };

    const dbService = new DatabaseService(connection, password, c.env);
    await dbService.deleteRows(tableName, ids);
    await dbService.disconnect();

    return c.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error('删除行失败:', error);
    return c.json<ApiResponse>({ success: false, error: error instanceof Error ? error.message : '删除失败' }, 500);
  }
});

/**
 * 插入表数据
 * POST /api/v1/databases/:id/tables/:tableName/rows
 */
databaseRoutes.post('/:id/tables/:tableName/rows', async (c) => {
  const id = c.req.param('id');
  const tableName = c.req.param('tableName');
  const data = await c.req.json<Record<string, any>>();

  const result = await c.env.DB.prepare(`SELECT * FROM database_connections WHERE id = ?`).bind(id).first();

  if (!result) {
    return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
  }

  const connectionKeyPath = result.key_path as string;

  try {
    const hsm = createHsmClient({ url: c.env.HSM_URL, secret: c.env.HSM_SECRET });
    const password = await hsm.decrypt(connectionKeyPath);

    const connection: DatabaseConnection = {
      id: result.id as string,
      name: result.name as string,
      type: result.type as DatabaseConnection['type'],
      host: result.host as string,
      port: result.port as string,
      database: result.database_name as string,
      username: result.username as string,
      keyPath: result.key_path as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
    };

    const dbService = new DatabaseService(connection, password, c.env);
    await dbService.insertRow(tableName, data);
    await dbService.disconnect();

    return c.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error('插入行失败:', error);
    return c.json<ApiResponse>({ success: false, error: error instanceof Error ? error.message : '插入失败' }, 500);
  }
});

/**
 * 批量更新表数据
 * PUT /api/v1/databases/:id/tables/:tableName/rows
 */
databaseRoutes.put('/:id/tables/:tableName/rows', async (c) => {
  const id = c.req.param('id');
  const tableName = c.req.param('tableName');
  const { rows } = await c.req.json<{ rows: Array<{ pk: any; data: Record<string, any> }> }>();

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return c.json<ApiResponse>({ success: false, error: '缺少有效的更新数据' }, 400);
  }

  const result = await c.env.DB.prepare(`SELECT * FROM database_connections WHERE id = ?`).bind(id).first();

  if (!result) {
    return c.json<ApiResponse>({ success: false, error: '数据库连接不存在' }, 404);
  }

  const connectionKeyPath = result.key_path as string;

  try {
    const hsm = createHsmClient({ url: c.env.HSM_URL, secret: c.env.HSM_SECRET });
    const password = await hsm.decrypt(connectionKeyPath);

    const connection: DatabaseConnection = {
      id: result.id as string,
      name: result.name as string,
      type: result.type as DatabaseConnection['type'],
      host: result.host as string,
      port: result.port as string,
      database: result.database_name as string,
      username: result.username as string,
      keyPath: result.key_path as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
    };

    const dbService = new DatabaseService(connection, password, c.env);
    const updateResult = await dbService.updateRows(tableName, rows);
    await dbService.disconnect();

    return c.json<ApiResponse>({ success: true, data: updateResult });
  } catch (error) {
    console.error('更新行失败:', error);
    return c.json<ApiResponse>({ success: false, error: error instanceof Error ? error.message : '更新失败' }, 500);
  }
});

export { databaseRoutes };
