import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../routes/database-shared', () => ({
  withDatabaseService: vi.fn(),
}));

import { withDatabaseService } from '../routes/database-shared';
import { getDatabaseSchemaContext, SCHEMA_CACHE_TTL_MS } from '../services/schema-context';
import type { DatabaseConnection, Env, TableColumn } from '../types';

interface MockD1BoundStatement {
  run: () => Promise<{ success: boolean }>;
  first: () => Promise<Record<string, unknown> | null>;
}

interface MockD1PreparedStatement {
  bind: (...values: unknown[]) => MockD1BoundStatement;
}

interface MockD1Database {
  prepare: (query: string) => MockD1PreparedStatement;
}

function createMockEnvWithSchemaCache(): Env {
  let cacheRow:
    | {
        database_id: string;
        schema_text: string;
        updated_at: number;
        expires_at: number;
      }
    | null = null;

  const db: MockD1Database = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              if (query.includes('INSERT INTO database_schema_cache')) {
                const [databaseId, schemaText, updatedAt, expiresAt] = values;
                cacheRow = {
                  database_id: String(databaseId),
                  schema_text: String(schemaText),
                  updated_at: Number(updatedAt),
                  expires_at: Number(expiresAt),
                };
              } else if (query.includes('DELETE FROM database_schema_cache')) {
                cacheRow = null;
              }
              return { success: true };
            },
            async first() {
              if (!query.includes('FROM database_schema_cache')) {
                return null;
              }
              return cacheRow ? { ...cacheRow } : null;
            },
          };
        },
      };
    },
  };

  return {
    HSM_URL: 'https://hsm.example.com',
    HSM_SECRET: 'test-secret',
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    DB: db as unknown as Env['DB'],
  };
}

function createMockEnvWithoutSchemaCacheTable(): Env {
  const db: MockD1Database = {
    prepare(query: string) {
      if (query.includes('database_schema_cache')) {
        throw new Error('no such table: database_schema_cache');
      }

      return {
        bind() {
          return {
            async run() {
              return { success: true };
            },
            async first() {
              return null;
            },
          };
        },
      };
    },
  };

  return {
    HSM_URL: 'https://hsm.example.com',
    HSM_SECRET: 'test-secret',
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    DB: db as unknown as Env['DB'],
  };
}

function createMockConnection(overrides: Partial<DatabaseConnection> = {}): DatabaseConnection {
  const now = new Date().toISOString();
  return {
    id: 'db-1',
    name: 'test',
    type: 'mysql',
    host: '127.0.0.1',
    port: '3306',
    database: 'app',
    username: 'root',
    keyPath: 'vibedb/databases/db-1/password',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('schema context', () => {
  beforeEach(() => {
    vi.mocked(withDatabaseService).mockReset();
  });

  it('首次获取应生成 schema 并写入缓存，二次获取命中缓存', async () => {
    const env = createMockEnvWithSchemaCache();
    const connection = createMockConnection();

    const columns: TableColumn[] = [
      { Field: 'id', Type: 'int', Null: 'NO', Key: 'PRI' },
      { Field: 'name', Type: 'varchar(255)', Null: 'YES' },
    ];

    vi.mocked(withDatabaseService).mockImplementation(async (_env, _connection, execute) => {
      const dbService = {
        async getTables() {
          return ['users'];
        },
        async getTableSchema(_tableName: string) {
          return columns;
        },
      };

      return execute(dbService as unknown as import('../services/db').DatabaseService);
    });

    const first = await getDatabaseSchemaContext(env, connection, { now: 1000 });
    expect(first.cached).toBe(false);
    expect(first.updatedAt).toBe(1000);
    expect(first.expiresAt).toBe(1000 + SCHEMA_CACHE_TTL_MS);
    expect(first.schema).toContain('表: users');
    expect(first.schema).toContain('- id: int');

    const second = await getDatabaseSchemaContext(env, connection, { now: 2000 });
    expect(second.cached).toBe(true);
    expect(second.schema).toBe(first.schema);

    expect(withDatabaseService).toHaveBeenCalledTimes(1);
  });

  it('缓存过期后应自动刷新', async () => {
    const env = createMockEnvWithSchemaCache();
    const connection = createMockConnection();

    vi.mocked(withDatabaseService).mockImplementation(async (_env, _connection, execute) => {
      const dbService = {
        async getTables() {
          return ['users'];
        },
        async getTableSchema(_tableName: string) {
          return [{ Field: 'id', Type: 'int', Null: 'NO', Key: 'PRI' }] as TableColumn[];
        },
      };

      return execute(dbService as unknown as import('../services/db').DatabaseService);
    });

    const first = await getDatabaseSchemaContext(env, connection, { now: 0 });
    expect(first.cached).toBe(false);

    const second = await getDatabaseSchemaContext(env, connection, { now: SCHEMA_CACHE_TTL_MS + 1 });
    expect(second.cached).toBe(false);
    expect(second.updatedAt).toBe(SCHEMA_CACHE_TTL_MS + 1);

    expect(withDatabaseService).toHaveBeenCalledTimes(2);
  });

  it('forceRefresh 应无视缓存强制刷新', async () => {
    const env = createMockEnvWithSchemaCache();
    const connection = createMockConnection();

    vi.mocked(withDatabaseService).mockImplementation(async (_env, _connection, execute) => {
      const dbService = {
        async getTables() {
          return ['users'];
        },
        async getTableSchema(_tableName: string) {
          return [{ Field: 'id', Type: 'int', Null: 'NO', Key: 'PRI' }] as TableColumn[];
        },
      };

      return execute(dbService as unknown as import('../services/db').DatabaseService);
    });

    const first = await getDatabaseSchemaContext(env, connection, { now: 1 });
    expect(first.cached).toBe(false);

    const forced = await getDatabaseSchemaContext(env, connection, { now: 2, forceRefresh: true });
    expect(forced.cached).toBe(false);
    expect(forced.updatedAt).toBe(2);

    expect(withDatabaseService).toHaveBeenCalledTimes(2);
  });

  it('schema cache 表不存在时应自动降级为无缓存模式', async () => {
    const env = createMockEnvWithoutSchemaCacheTable();
    const connection = createMockConnection();

    vi.mocked(withDatabaseService).mockImplementation(async (_env, _connection, execute) => {
      const dbService = {
        async getTables() {
          return ['users'];
        },
        async getTableSchema(_tableName: string) {
          return [{ Field: 'id', Type: 'int', Null: 'NO', Key: 'PRI' }] as TableColumn[];
        },
      };

      return execute(dbService as unknown as import('../services/db').DatabaseService);
    });

    const result = await getDatabaseSchemaContext(env, connection, { now: 1 });
    expect(result.cached).toBe(false);
    expect(result.schema).toContain('表: users');
    expect(withDatabaseService).toHaveBeenCalledTimes(1);
  });
});
