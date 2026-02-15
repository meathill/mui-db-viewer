import { createMockDatabaseConnectionRow, type MockDatabaseConnectionRow } from './database-route-test-utils';

interface MockD1BoundStatement {
  run: () => Promise<{ success: boolean }>;
  all: () => Promise<{ results: Array<Record<string, unknown>> }>;
  first: () => Promise<Record<string, unknown> | null>;
}

interface MockD1PreparedStatement {
  bind: (...values: unknown[]) => MockD1BoundStatement;
  all: () => Promise<{ results: Array<Record<string, unknown>> }>;
}

interface MockD1Database {
  prepare: (query: string) => MockD1PreparedStatement;
}

export interface MockSchemaCacheRow {
  database_id: string;
  schema_text: string;
  updated_at: number;
  expires_at: number;
}

interface CreateMockDbOptions {
  connectionRow: MockDatabaseConnectionRow | null;
  schemaCacheRow: MockSchemaCacheRow | null;
}

export function createQueryRouteMockDb(options: CreateMockDbOptions): MockD1Database {
  let schemaCacheRow = options.schemaCacheRow;

  return {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              if (query.includes('INSERT INTO database_schema_cache')) {
                const [databaseId, schemaText, updatedAt, expiresAt] = values;
                schemaCacheRow = {
                  database_id: String(databaseId),
                  schema_text: String(schemaText),
                  updated_at: Number(updatedAt),
                  expires_at: Number(expiresAt),
                };
              }
              return { success: true };
            },
            async all() {
              return { results: [] as Array<Record<string, unknown>> };
            },
            async first() {
              const [id] = values;
              if (query.includes('FROM database_connections')) {
                if (options.connectionRow && String(id) === options.connectionRow.id) {
                  return { ...options.connectionRow };
                }
                return null;
              }

              if (query.includes('FROM database_schema_cache')) {
                if (schemaCacheRow && String(id) === schemaCacheRow.database_id) {
                  return { ...schemaCacheRow };
                }
                return null;
              }

              return null;
            },
          };
        },
        async all() {
          return { results: [] as Array<Record<string, unknown>> };
        },
      };
    },
  };
}

export function createDefaultQueryRouteConnectionRow(
  overrides: Partial<MockDatabaseConnectionRow> = {},
): MockDatabaseConnectionRow {
  return createMockDatabaseConnectionRow({
    id: 'test-db-id',
    type: 'mysql',
    ...overrides,
  });
}
