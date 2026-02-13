import { Hono } from 'hono';
import { vi } from 'vitest';
import { databaseRoutes } from '../routes/database';

interface MockD1BoundStatement {
  run: () => Promise<{ success: boolean }>;
  all: () => Promise<{ results: Array<Record<string, unknown>> }>;
  first: () => Promise<MockDatabaseConnectionRow | null>;
}

interface MockD1PreparedStatement {
  bind: (...values: unknown[]) => MockD1BoundStatement;
  all: () => Promise<{ results: Array<Record<string, unknown>> }>;
}

interface MockD1Database {
  prepare: (query: string) => MockD1PreparedStatement;
}

interface TestBindings {
  HSM_URL: string;
  HSM_SECRET: string;
  OPENAI_API_KEY: string;
  DB: MockD1Database;
}

interface TestRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface MockDatabaseConnectionRow {
  id: string;
  name: string;
  type: 'mysql' | 'postgres' | 'tidb' | 'd1';
  host: string;
  port: string;
  database_name: string;
  username: string;
  key_path: string;
  created_at: string;
  updated_at: string;
}

function createMockD1Database(getFirstResult: () => MockDatabaseConnectionRow | null): MockD1Database {
  return {
    prepare: vi.fn((_query: string) => ({
      bind: vi.fn((..._values: unknown[]) => ({
        run: vi.fn(async () => ({ success: true })),
        all: vi.fn(async () => ({ results: [] as Array<Record<string, unknown>> })),
        first: vi.fn(async () => getFirstResult()),
      })),
      all: vi.fn(async () => ({ results: [] as Array<Record<string, unknown>> })),
    })),
  };
}

export function createMockDatabaseConnectionRow(
  overrides: Partial<MockDatabaseConnectionRow> = {},
): MockDatabaseConnectionRow {
  const now = new Date().toISOString();

  return {
    id: 'test-id',
    name: 'test-db',
    type: 'tidb',
    host: 'localhost',
    port: '3306',
    database_name: 'test_db',
    username: 'root',
    key_path: 'vibedb/databases/test-id/password',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function createDatabaseRouteTestClient() {
  let currentConnectionRow: MockDatabaseConnectionRow | null = null;

  const env: TestBindings = {
    HSM_URL: 'https://hsm.example.com',
    HSM_SECRET: 'test-secret',
    OPENAI_API_KEY: 'test-key',
    DB: createMockD1Database(() => currentConnectionRow),
  };

  const app = new Hono<{ Bindings: TestBindings }>();
  app.route('/databases', databaseRoutes);

  return {
    setConnectionRow(row: MockDatabaseConnectionRow | null) {
      currentConnectionRow = row;
    },
    request(path: string, init?: TestRequestInit) {
      return app.request(path, init, env);
    },
  };
}
