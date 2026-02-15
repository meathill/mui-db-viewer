import type { Context } from 'hono';
import { createHsmClient, parseHsmCallMode } from '../services/hsm';
import { deleteSchemaCache } from '../services/schema-cache';
import type { ApiResponse, CreateDatabaseRequest, DatabaseConnection } from '../types';
import { findConnectionById, getErrorMessage, listConnections } from './database-shared';

type WorkerContext = Context<{ Bindings: CloudflareBindings }>;

export async function handleCreateDatabaseConnection(c: WorkerContext, body: CreateDatabaseRequest) {
  const id = crypto.randomUUID();
  const isSqlite = body.type === 'sqlite';
  const keyPath = isSqlite ? '' : `vibedb/databases/${id}/password`;
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
    if (!isSqlite) {
      const hsm = createHsmClient({
        callMode: parseHsmCallMode(c.env.HSM_CALL_MODE),
        service: c.env.HSM_SERVICE,
        url: c.env.HSM_URL,
        secret: c.env.HSM_SECRET,
      });
      await hsm.encrypt(keyPath, body.password);
    }

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
}

export async function handleListDatabaseConnections(c: WorkerContext) {
  const connections = await listConnections(c.env);
  return c.json<ApiResponse<DatabaseConnection[]>>({
    success: true,
    data: connections,
  });
}

export async function handleGetDatabaseConnection(c: WorkerContext) {
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
}

export async function handleDeleteDatabaseConnection(c: WorkerContext) {
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
    if (connection.type !== 'sqlite' && connection.keyPath) {
      const hsm = createHsmClient({
        callMode: parseHsmCallMode(c.env.HSM_CALL_MODE),
        service: c.env.HSM_SERVICE,
        url: c.env.HSM_URL,
        secret: c.env.HSM_SECRET,
      });
      await hsm.delete(connection.keyPath);
    }

    // 即使 DB 层开启了外键 cascade，也显式清理一次缓存，避免出现脏数据。
    await deleteSchemaCache(c.env, id);
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
}
