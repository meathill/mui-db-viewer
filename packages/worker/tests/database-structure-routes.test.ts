import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/routes/database-shared', () => ({
  findConnectionById: vi.fn(),
  withDatabaseService: vi.fn(),
  getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  },
}));

vi.mock('@/services/schema-cache', () => ({
  deleteSchemaCache: vi.fn(),
}));

import { databaseStructureRoutes } from '@/routes/database-structure-routes';
import { findConnectionById, withDatabaseService } from '@/routes/database-shared';
import { deleteSchemaCache } from '@/services/schema-cache';

type MockEnv = Pick<CloudflareBindings, 'DB' | 'OPENAI_API_KEY' | 'HSM_SECRET' | 'HSM_URL'>;

function createEnv(): MockEnv {
  return {
    DB: {} as CloudflareBindings['DB'],
    OPENAI_API_KEY: 'test-key',
    HSM_SECRET: 'test-secret',
    HSM_URL: 'https://hsm.example.com',
  };
}

function createConnection() {
  const now = new Date().toISOString();

  return {
    id: 'db-1',
    name: 'test-db',
    type: 'sqlite' as const,
    host: '',
    port: '',
    database: 'test.db',
    username: '',
    keyPath: '',
    createdAt: now,
    updatedAt: now,
  };
}

function createApp() {
  const app = new Hono<{ Bindings: MockEnv }>();
  app.route('/databases', databaseStructureRoutes);
  return app;
}

describe('database structure routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /editor-context 成功返回结构编辑上下文', async () => {
    vi.mocked(findConnectionById).mockResolvedValue(createConnection());
    vi.mocked(withDatabaseService).mockImplementation(async (_env, _connection, execute) =>
      execute({
        getStructureEditorContext: async () => ({
          dialect: 'sqlite',
          typeSuggestions: ['INTEGER'],
          keywordSuggestions: ['NULL'],
          capabilities: {
            canCreateTable: true,
            canEditColumns: true,
            canEditIndexes: true,
            canRenameColumns: true,
            canEditColumnType: true,
            canEditColumnNullability: true,
            canEditColumnDefault: true,
            supportsPrimaryKey: true,
            supportsAutoIncrement: true,
            canEditColumnPrimaryKey: false,
            canEditColumnAutoIncrement: false,
          },
        }),
      } as never),
    );

    const res = await createApp().request('/databases/db-1/editor-context', undefined, createEnv());
    const json = (await res.json()) as { success: boolean; data?: { dialect: string } };

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data?.dialect).toBe('sqlite');
  });

  it('GET /tables/:tableName/structure 在连接不存在时返回 404', async () => {
    vi.mocked(findConnectionById).mockResolvedValue(null);

    const res = await createApp().request('/databases/db-1/tables/users/structure', undefined, createEnv());
    const json = (await res.json()) as { success: boolean; error?: string };

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('数据库连接不存在');
  });

  it('POST /tables 成功创建表并清理 schema cache', async () => {
    vi.mocked(findConnectionById).mockResolvedValue(createConnection());
    vi.mocked(withDatabaseService).mockImplementation(async (_env, _connection, execute) =>
      execute({
        createTable: async () => undefined,
      } as never),
    );
    vi.mocked(deleteSchemaCache).mockResolvedValue(undefined);

    const res = await createApp().request(
      '/databases/db-1/tables',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: 'users',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true }],
        }),
      },
      createEnv(),
    );
    const json = (await res.json()) as { success: boolean; data?: { tableName: string } };

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ tableName: 'users' });
    expect(deleteSchemaCache).toHaveBeenCalledWith(createEnv(), 'db-1');
  });

  it('PUT /columns/:columnName 参数非法时返回 400', async () => {
    const res = await createApp().request(
      '/databases/db-1/tables/users/columns/name',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column: { name: '', type: 'TEXT', nullable: true },
        }),
      },
      createEnv(),
    );
    const json = (await res.json()) as { success: boolean; error?: string };

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBeTruthy();
  });

  it('POST /columns 应调用新增列接口', async () => {
    vi.mocked(findConnectionById).mockResolvedValue(createConnection());
    vi.mocked(deleteSchemaCache).mockResolvedValue(undefined);

    const createColumn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(withDatabaseService).mockImplementation(async (_env, _connection, execute) =>
      execute({
        createColumn,
      } as never),
    );

    const res = await createApp().request(
      '/databases/db-1/tables/users/columns',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column: { name: 'email', type: 'TEXT', nullable: true, defaultExpression: null },
        }),
      },
      createEnv(),
    );

    expect(res.status).toBe(200);
    expect(createColumn).toHaveBeenCalledWith('users', {
      name: 'email',
      type: 'TEXT',
      nullable: true,
      defaultExpression: null,
      primaryKey: false,
      autoIncrement: false,
    });
    expect(deleteSchemaCache).toHaveBeenCalledWith(createEnv(), 'db-1');
  });

  it('POST /indexes 与 PUT /indexes/:indexName 应调用索引写接口', async () => {
    vi.mocked(findConnectionById).mockResolvedValue(createConnection());
    vi.mocked(deleteSchemaCache).mockResolvedValue(undefined);

    const createIndex = vi.fn().mockResolvedValue(undefined);
    const updateIndex = vi.fn().mockResolvedValue(undefined);
    vi.mocked(withDatabaseService).mockImplementation(async (_env, _connection, execute) =>
      execute({
        createIndex,
        updateIndex,
      } as never),
    );

    const app = createApp();

    const createResponse = await app.request(
      '/databases/db-1/tables/users/indexes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index: { name: 'idx_users_name', columns: ['name'], unique: false },
        }),
      },
      createEnv(),
    );

    const updateResponse = await app.request(
      '/databases/db-1/tables/users/indexes/idx_users_name',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index: { name: 'idx_users_name_unique', columns: ['name'], unique: true },
        }),
      },
      createEnv(),
    );

    expect(createResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(createIndex).toHaveBeenCalledWith('users', { name: 'idx_users_name', columns: ['name'], unique: false });
    expect(updateIndex).toHaveBeenCalledWith('users', 'idx_users_name', {
      name: 'idx_users_name_unique',
      columns: ['name'],
      unique: true,
    });
    expect(deleteSchemaCache).toHaveBeenCalledTimes(2);
  });
});
