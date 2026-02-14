import type { DatabaseConnection, DatabaseType, Env, TableColumn } from '../types';
import { withDatabaseService } from '../routes/database-shared';
import { isSchemaCacheValid, readSchemaCache, upsertSchemaCache, type SchemaCacheEntry } from './schema-cache';

export const SCHEMA_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SchemaContextResult {
  schema: string;
  updatedAt: number;
  expiresAt: number;
  cached: boolean;
}

export function formatDatabaseTypeLabel(databaseType: DatabaseType): string {
  switch (databaseType) {
    case 'tidb':
      return 'TiDB (MySQL compatible)';
    case 'mysql':
      return 'MySQL';
    case 'postgres':
      return 'PostgreSQL';
    case 'd1':
      return 'Cloudflare D1 (SQLite)';
    case 'sqlite':
      return 'SQLite';
    case 'supabase':
      return 'Supabase (PostgreSQL)';
    default: {
      const exhaustiveCheck: never = databaseType;
      return exhaustiveCheck;
    }
  }
}

function formatColumnSchema(column: TableColumn): string {
  const segments: string[] = [];

  if (column.Key === 'PRI') {
    segments.push('PRIMARY KEY');
  }
  if (column.Null === 'NO') {
    segments.push('NOT NULL');
  }
  if (column.Default !== undefined && column.Default !== null && String(column.Default).trim() !== '') {
    segments.push(`DEFAULT ${String(column.Default)}`);
  }

  const suffix = segments.length > 0 ? ` (${segments.join(', ')})` : '';
  return `  - ${column.Field}: ${column.Type}${suffix}`;
}

function formatTableSchema(tableName: string, columns: TableColumn[]): string {
  if (columns.length === 0) {
    return `表: ${tableName}\n  - (无字段信息)`;
  }

  return [`表: ${tableName}`, ...columns.map(formatColumnSchema)].join('\n');
}

export function formatDatabaseSchema(tables: Array<{ tableName: string; columns: TableColumn[] }>): string {
  if (tables.length === 0) {
    return '当前数据库未发现任何表结构。';
  }

  return tables.map((table) => formatTableSchema(table.tableName, table.columns)).join('\n\n');
}

async function buildDatabaseSchemaText(env: Env, connection: DatabaseConnection): Promise<string> {
  return withDatabaseService(env, connection, async (dbService) => {
    const tables = await dbService.getTables();
    const tableNames = [...tables].sort((a, b) => a.localeCompare(b));

    const schemas: Array<{ tableName: string; columns: TableColumn[] }> = [];
    for (const tableName of tableNames) {
      const columns = await dbService.getTableSchema(tableName);
      schemas.push({ tableName, columns });
    }

    return formatDatabaseSchema(schemas);
  });
}

export async function getDatabaseSchemaContext(
  env: Env,
  connection: DatabaseConnection,
  options: { forceRefresh?: boolean; now?: number } = {},
): Promise<SchemaContextResult> {
  const now = options.now ?? Date.now();

  if (!options.forceRefresh) {
    const cached = await readSchemaCache(env, connection.id);
    if (cached && isSchemaCacheValid(cached, now)) {
      return {
        schema: cached.schema,
        updatedAt: cached.updatedAt,
        expiresAt: cached.expiresAt,
        cached: true,
      };
    }
  }

  const schema = await buildDatabaseSchemaText(env, connection);
  const entry: SchemaCacheEntry = {
    databaseId: connection.id,
    schema,
    updatedAt: now,
    expiresAt: now + SCHEMA_CACHE_TTL_MS,
  };
  await upsertSchemaCache(env, entry);

  return {
    schema,
    updatedAt: entry.updatedAt,
    expiresAt: entry.expiresAt,
    cached: false,
  };
}

