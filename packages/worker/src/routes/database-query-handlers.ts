import type { Context } from 'hono';
import { getDatabaseSchemaContext } from '../services/schema-context';
import { validateAndSanitizeSql } from '../services/sql-guard';
import type { ApiResponse, DatabaseConnection, Env, TableColumn, TableRow } from '../types';
import { findConnectionById, getErrorMessage, parseTableQueryOptions, withDatabaseService } from './database-shared';

type WorkerContext = Context<{ Bindings: Env }>;

export interface TableDataResponse {
  rows: TableRow[];
  total: number;
  columns: TableColumn[];
}

export async function loadTableData(
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

export async function handleExecuteSql(c: WorkerContext) {
  const id = c.req.param('id');
  const { sql } = c.req.valid('json') as { sql: string };
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
    const guardResult = validateAndSanitizeSql(sql);
    if (!guardResult.valid || !guardResult.sql) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: guardResult.error || 'SQL 不安全',
        },
        400,
      );
    }

    const result = await withDatabaseService(c.env, connection, async (dbService) => {
      // 当前驱动层仅返回 rows；columns 先在路由层做简单推断，后续可再补充元信息能力。
      return dbService.query(guardResult.sql);
    });

    const rows = result as TableRow[];
    const columns: TableColumn[] =
      rows.length > 0
        ? Object.keys(rows[0]).map((key) => ({
            Field: key,
            Type: typeof rows[0][key],
          }))
        : [];

    return c.json<ApiResponse<TableDataResponse>>({
      success: true,
      data: {
        rows,
        total: rows.length,
        columns,
      },
    });
  } catch (error) {
    console.error('执行 SQL 失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: getErrorMessage(error, '执行 SQL 失败'),
      },
      500,
    );
  }
}

export async function handleGetDatabaseSchema(c: WorkerContext) {
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
    const context = await getDatabaseSchemaContext(c.env, connection);
    return c.json<ApiResponse<typeof context>>({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error('获取 Schema 失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: getErrorMessage(error, '获取 Schema 失败'),
      },
      500,
    );
  }
}

export async function handleRefreshDatabaseSchema(c: WorkerContext) {
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
    const context = await getDatabaseSchemaContext(c.env, connection, { forceRefresh: true });
    return c.json<ApiResponse<typeof context>>({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error('刷新 Schema 失败:', error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: getErrorMessage(error, '刷新 Schema 失败'),
      },
      500,
    );
  }
}

export async function handleGetTables(c: WorkerContext) {
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
}

export async function handleGetTableData(c: WorkerContext) {
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
}
