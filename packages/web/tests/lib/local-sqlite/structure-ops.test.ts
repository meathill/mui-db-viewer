import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeLocalSQLiteQuery } from '@/lib/local-sqlite/sqlite-engine';
import {
  createLocalSQLiteColumn,
  createLocalSQLiteIndex,
  createLocalSQLiteTable,
  getLocalSQLiteStructureEditorContext,
  getLocalSQLiteTableStructure,
  updateLocalSQLiteColumn,
  updateLocalSQLiteIndex,
} from '@/lib/local-sqlite/structure-ops';

vi.mock('@/lib/local-sqlite/sqlite-engine', () => ({
  executeLocalSQLiteQuery: vi.fn(),
}));

describe('local-sqlite structure-ops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLocalSQLiteStructureEditorContext 应返回 sqlite 方言上下文', async () => {
    const result = await getLocalSQLiteStructureEditorContext();

    expect(result.dialect).toBe('sqlite');
    expect(result.capabilities.canCreateTable).toBe(true);
    expect(result.typeSuggestions).toContain('INTEGER');
  });

  it('getLocalSQLiteTableStructure 应返回列、索引和建表语句', async () => {
    vi.mocked(executeLocalSQLiteQuery)
      .mockResolvedValueOnce({
        rows: [{ sql: 'CREATE TABLE "users" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)' }],
        total: 1,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [
          { name: 'id', type: 'INTEGER', notnull: 1, pk: 1, dflt_value: null },
          { name: 'name', type: 'TEXT', notnull: 0, pk: 0, dflt_value: "'guest'" },
        ],
        total: 2,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [
          { name: 'sqlite_autoindex_users_1', unique: 1, origin: 'pk' },
          { name: 'idx_users_name', unique: 0, origin: 'c' },
        ],
        total: 2,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [{ seqno: 0, name: 'name' }],
        total: 1,
        columns: [],
      });

    const result = await getLocalSQLiteTableStructure('local-sqlite:1', 'users');

    expect(result.tableName).toBe('users');
    expect(result.createStatement).toContain('CREATE TABLE "users"');
    expect(result.columns).toEqual([
      {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        defaultExpression: null,
        primaryKey: true,
        primaryKeyOrder: 1,
        autoIncrement: true,
      },
      {
        name: 'name',
        type: 'TEXT',
        nullable: true,
        defaultExpression: "'guest'",
        primaryKey: false,
        primaryKeyOrder: null,
        autoIncrement: false,
      },
    ]);
    expect(result.indexes).toEqual([
      { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
      { name: 'idx_users_name', columns: ['name'], unique: false, primary: false },
    ]);
  });

  it('createLocalSQLiteTable 应执行建表与建索引 SQL', async () => {
    vi.mocked(executeLocalSQLiteQuery).mockResolvedValue({
      rows: [],
      total: 0,
      columns: [],
    });

    const result = await createLocalSQLiteTable('local-sqlite:1', {
      tableName: 'users',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          nullable: false,
          primaryKey: true,
          autoIncrement: true,
        },
      ],
      indexes: [{ name: 'idx_users_id', columns: ['id'], unique: true }],
    });

    expect(result).toEqual({ tableName: 'users' });
    expect(executeLocalSQLiteQuery).toHaveBeenCalledWith(
      'local-sqlite:1',
      expect.stringContaining('CREATE TABLE "users"'),
    );
    expect(executeLocalSQLiteQuery).toHaveBeenCalledWith(
      'local-sqlite:1',
      expect.stringContaining('CREATE UNIQUE INDEX "idx_users_id" ON "users" ("id")'),
    );
  });

  it('createLocalSQLiteColumn 应执行 ADD COLUMN SQL', async () => {
    vi.mocked(executeLocalSQLiteQuery).mockResolvedValue({
      rows: [],
      total: 0,
      columns: [],
    });

    await createLocalSQLiteColumn('local-sqlite:1', 'users', {
      name: 'email',
      type: 'TEXT',
      nullable: true,
      defaultExpression: null,
      primaryKey: false,
      autoIncrement: false,
    });

    expect(executeLocalSQLiteQuery).toHaveBeenCalledWith(
      'local-sqlite:1',
      'ALTER TABLE "users" ADD COLUMN "email" TEXT;',
    );
  });

  it('updateLocalSQLiteColumn 仅重命名时应执行 RENAME COLUMN', async () => {
    vi.mocked(executeLocalSQLiteQuery)
      .mockResolvedValueOnce({
        rows: [{ sql: 'CREATE TABLE "users" ("name" TEXT)' }],
        total: 1,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [{ name: 'name', type: 'TEXT', notnull: 0, pk: 0, dflt_value: null }],
        total: 1,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [],
        total: 0,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [],
        total: 0,
        columns: [],
      });

    await updateLocalSQLiteColumn('local-sqlite:1', 'users', 'name', {
      name: 'display_name',
      type: 'TEXT',
      nullable: true,
      defaultExpression: null,
      primaryKey: false,
      autoIncrement: false,
    });

    expect(executeLocalSQLiteQuery).toHaveBeenLastCalledWith(
      'local-sqlite:1',
      'ALTER TABLE "users" RENAME COLUMN "name" TO "display_name";',
    );
  });

  it('createLocalSQLiteIndex 与 updateLocalSQLiteIndex 应执行索引 SQL', async () => {
    vi.mocked(executeLocalSQLiteQuery)
      .mockResolvedValueOnce({
        rows: [],
        total: 0,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [{ sql: 'CREATE TABLE "users" ("id" INTEGER PRIMARY KEY, "name" TEXT)' }],
        total: 1,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [
          { name: 'id', type: 'INTEGER', notnull: 1, pk: 1, dflt_value: null },
          { name: 'name', type: 'TEXT', notnull: 0, pk: 0, dflt_value: null },
        ],
        total: 2,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [{ name: 'idx_users_name', unique: 0, origin: 'c' }],
        total: 1,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [{ seqno: 0, name: 'name' }],
        total: 1,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [],
        total: 0,
        columns: [],
      });

    await createLocalSQLiteIndex('local-sqlite:1', 'users', {
      name: 'idx_users_name',
      columns: ['name'],
      unique: false,
    });
    await updateLocalSQLiteIndex('local-sqlite:1', 'users', 'idx_users_name', {
      name: 'idx_users_name_2',
      columns: ['name'],
      unique: true,
    });

    expect(executeLocalSQLiteQuery).toHaveBeenNthCalledWith(
      1,
      'local-sqlite:1',
      'CREATE INDEX "idx_users_name" ON "users" ("name");',
    );
    expect(executeLocalSQLiteQuery).toHaveBeenLastCalledWith(
      'local-sqlite:1',
      'DROP INDEX IF EXISTS "idx_users_name";\nCREATE UNIQUE INDEX "idx_users_name_2" ON "users" ("name");',
    );
  });
});
