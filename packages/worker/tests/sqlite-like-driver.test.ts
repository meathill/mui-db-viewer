import { describe, expect, it, vi } from 'vitest';
import type { TableStructure } from '@/types';
import { SqliteLikeDriver } from '@/services/drivers/sqlite-like-driver';

class TestSqliteLikeDriver extends SqliteLikeDriver {
  queryResults = new Map<string, Array<Record<string, unknown>>>();
  writeStatements: string[][] = [];

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  protected async executeQuery(query: string): Promise<Array<Record<string, unknown>>> {
    return this.queryResults.get(query) || [];
  }

  protected async executeWriteStatements(statements: string[]): Promise<void> {
    this.writeStatements.push(statements);
  }
}

function createTableStructure(): TableStructure {
  return {
    tableName: 'users',
    dialect: 'sqlite',
    columns: [
      {
        name: 'name',
        type: 'TEXT',
        nullable: true,
        defaultExpression: null,
        primaryKey: false,
        primaryKeyOrder: null,
        autoIncrement: false,
      },
    ],
    indexes: [{ name: 'idx_users_name', columns: ['name'], unique: false, primary: false }],
    createStatement: 'CREATE TABLE "users" ("name" TEXT)',
  };
}

describe('sqlite-like-driver', () => {
  it('getTableStructure 应映射 pragma 结果', async () => {
    const driver = new TestSqliteLikeDriver();
    driver.queryResults.set('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?', [
      { sql: 'CREATE TABLE "users" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)' },
    ]);
    driver.queryResults.set('PRAGMA table_info("users")', [
      { name: 'id', type: 'INTEGER', notnull: 1, pk: 1, dflt_value: null },
      { name: 'name', type: 'TEXT', notnull: 0, pk: 0, dflt_value: "'guest'" },
    ]);
    driver.queryResults.set('PRAGMA index_list("users")', [{ name: 'idx_users_name', unique: 0, origin: 'c' }]);
    driver.queryResults.set('PRAGMA index_info("idx_users_name")', [{ seqno: 0, name: 'name' }]);

    const result = await driver.getTableStructure('users');

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

  it('createTable 应写入建表与建索引语句', async () => {
    const driver = new TestSqliteLikeDriver();

    await driver.createTable({
      tableName: 'users',
      columns: [{ name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true }],
      indexes: [{ name: 'idx_users_id', columns: ['id'], unique: true }],
    });

    expect(driver.writeStatements[0]).toEqual([
      'CREATE TABLE "users" (\n  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL\n)',
      'CREATE UNIQUE INDEX "idx_users_id" ON "users" ("id")',
    ]);
  });

  it('updateColumn 仅重命名时应执行 ALTER TABLE RENAME COLUMN', async () => {
    const driver = new TestSqliteLikeDriver();
    vi.spyOn(driver, 'getTableStructure').mockResolvedValue(createTableStructure());

    await driver.updateColumn('users', 'name', {
      name: 'display_name',
      type: 'TEXT',
      nullable: true,
      defaultExpression: null,
      primaryKey: false,
      autoIncrement: false,
    });

    expect(driver.writeStatements[0]).toEqual(['ALTER TABLE "users" RENAME COLUMN "name" TO "display_name"']);
  });

  it('updateIndex 应先删除再创建索引', async () => {
    const driver = new TestSqliteLikeDriver();
    vi.spyOn(driver, 'getTableStructure').mockResolvedValue(createTableStructure());

    await driver.updateIndex('users', 'idx_users_name', {
      name: 'idx_users_name_unique',
      columns: ['name'],
      unique: true,
    });

    expect(driver.writeStatements[0]).toEqual([
      'DROP INDEX IF EXISTS "idx_users_name"',
      'CREATE UNIQUE INDEX "idx_users_name_unique" ON "users" ("name")',
    ]);
  });
});
