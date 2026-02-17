import { DatabaseService } from '../services/db';
import { createHsmClient, parseHsmCallMode } from '../services/hsm';
import type { DatabaseConnection, TableQueryFilters, TableQueryOptions } from '../types';

const DATABASE_CONNECTIONS_TABLE = 'database_connections';

export type DatabaseServiceEnv = Pick<CloudflareBindings, 'DB'> &
  Partial<Pick<CloudflareBindings, 'HSM_CALL_MODE' | 'HSM_SERVICE' | 'HSM_URL' | 'HSM_SECRET'>>;

interface DatabaseConnectionRow {
  id: string;
  name: string;
  type: DatabaseConnection['type'];
  host: string;
  port: string;
  database_name: string;
  username: string;
  key_path: string;
  created_at: string;
  updated_at: string;
}

function isMissingD1TableError(error: unknown, tableName: string): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('no such table') && message.includes(tableName.toLowerCase());
}

function isMissingDatabaseConnectionsTableError(error: unknown): boolean {
  return isMissingD1TableError(error, DATABASE_CONNECTIONS_TABLE);
}

export function toDatabaseConnection(row: DatabaseConnectionRow): DatabaseConnection {
  return {
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
  };
}

export async function findConnectionById(
  env: Pick<CloudflareBindings, 'DB'>,
  id: string,
): Promise<DatabaseConnection | null> {
  let row: DatabaseConnectionRow | null;

  try {
    row = await env.DB.prepare(`SELECT * FROM database_connections WHERE id = ?`)
      .bind(id)
      .first<DatabaseConnectionRow>();
  } catch (error) {
    if (isMissingDatabaseConnectionsTableError(error)) {
      console.warn(
        'D1 元数据表 database_connections 不存在，已降级为“连接不存在”。请执行迁移：pnpm --filter worker migrate:local 或 pnpm --filter worker migrate:remote',
      );
      return null;
    }
    throw error;
  }

  if (!row) {
    return null;
  }

  return toDatabaseConnection(row);
}

export async function listConnections(env: Pick<CloudflareBindings, 'DB'>): Promise<DatabaseConnection[]> {
  let results: DatabaseConnectionRow[];
  try {
    ({ results } = await env.DB.prepare(`SELECT * FROM database_connections`).all<DatabaseConnectionRow>());
  } catch (error) {
    if (isMissingDatabaseConnectionsTableError(error)) {
      console.warn(
        'D1 元数据表 database_connections 不存在，GET /api/v1/databases 已降级为空数组。请执行迁移：pnpm --filter worker migrate:local 或 pnpm --filter worker migrate:remote',
      );
      return [];
    }
    throw error;
  }

  return results.map((row) => toDatabaseConnection(row));
}

export async function withDatabaseService<T>(
  env: DatabaseServiceEnv,
  connection: DatabaseConnection,
  execute: (service: DatabaseService) => Promise<T>,
): Promise<T> {
  let password: string | undefined;

  if (connection.type !== 'sqlite') {
    const hsm = createHsmClient({
      callMode: parseHsmCallMode(env.HSM_CALL_MODE),
      service: env.HSM_SERVICE,
      url: env.HSM_URL,
      secret: env.HSM_SECRET,
    });
    password = await hsm.decrypt(connection.keyPath);
  }

  const dbService = new DatabaseService(connection, password, env);

  try {
    return await execute(dbService);
  } finally {
    await dbService.disconnect();
  }
}

export function parseTableQueryOptions(query: Record<string, string | undefined>): TableQueryOptions {
  const pageNumber = Number.parseInt(query.page ?? '1', 10);
  const pageSizeNumber = Number.parseInt(query.pageSize ?? '20', 10);

  const page = Number.isNaN(pageNumber) || pageNumber < 1 ? 1 : pageNumber;
  const pageSize = Number.isNaN(pageSizeNumber) || pageSizeNumber < 1 ? 20 : pageSizeNumber;
  const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';

  const filters: TableQueryFilters = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('filter_') && value !== undefined) {
      filters[key.replace('filter_', '')] = value;
    }
  }
  if (query._search) {
    filters._search = query._search;
  }

  return {
    page,
    pageSize,
    sortField: query.sortField,
    sortOrder,
    filters,
  };
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
