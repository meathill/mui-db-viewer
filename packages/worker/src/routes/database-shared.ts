import { DatabaseService } from '../services/db';
import { createHsmClient, parseHsmCallMode } from '../services/hsm';
import type { DatabaseConnection, TableQueryFilters, TableQueryOptions } from '../types';

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
  const row = await env.DB.prepare(`SELECT * FROM database_connections WHERE id = ?`).bind(id).first();
  if (!row) {
    return null;
  }

  return toDatabaseConnection(row as DatabaseConnectionRow);
}

export async function listConnections(env: Pick<CloudflareBindings, 'DB'>): Promise<DatabaseConnection[]> {
  const { results } = await env.DB.prepare(`SELECT * FROM database_connections`).all();
  return results.map((row) => toDatabaseConnection(row as DatabaseConnectionRow));
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
