import { describe, expect, it, vi } from 'vitest';
import type { TableColumn, TableStructure } from '@/types';
import { MySqlCompatibleDriver } from '@/services/drivers/mysql-compatible-driver';

class TestMySqlCompatibleDriver extends MySqlCompatibleDriver {
  schema: TableColumn[] = [];
  showIndexRows: Array<Record<string, unknown>> = [];
  showCreateTableRows: Array<Record<string, unknown>> = [];
  executedQueries: string[] = [];

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async getTableSchema(): Promise<TableColumn[]> {
    return this.schema;
  }

  protected async executeQuery(query: string): Promise<Array<Record<string, unknown>>> {
    this.executedQueries.push(query);

    if (query.startsWith('SHOW INDEX')) {
      return this.showIndexRows;
    }

    if (query.startsWith('SHOW CREATE TABLE')) {
      return this.showCreateTableRows;
    }

    return [];
  }
}

function createTableStructure(): TableStructure {
  return {
    tableName: 'users',
    dialect: 'mysql',
    columns: [
      {
        name: 'name',
        type: 'varchar(255)',
        nullable: true,
        defaultExpression: null,
        primaryKey: false,
        primaryKeyOrder: null,
        autoIncrement: false,
      },
    ],
    indexes: [{ name: 'idx_users_name', columns: ['name'], unique: false, primary: false }],
    createStatement: 'CREATE TABLE `users` (`name` varchar(255))',
  };
}

describe('mysql-compatible-driver', () => {
  it('getTableStructure 应映射列、索引和建表语句', async () => {
    const driver = new TestMySqlCompatibleDriver();
    driver.schema = [
      { Field: 'id', Type: 'bigint', Null: 'NO', Key: 'PRI', Default: null, Extra: 'auto_increment' },
      { Field: 'name', Type: 'varchar(255)', Null: 'YES', Key: '', Default: 'guest', Extra: '' },
    ];
    driver.showIndexRows = [
      { Key_name: 'PRIMARY', Column_name: 'id', Non_unique: 0, Seq_in_index: 1 },
      { Key_name: 'idx_users_name', Column_name: 'name', Non_unique: 1, Seq_in_index: 1 },
    ];
    driver.showCreateTableRows = [{ Table: 'users', 'Create Table': 'CREATE TABLE `users` (...)' }];

    const result = await driver.getTableStructure('users');

    expect(result.columns).toEqual([
      {
        name: 'id',
        type: 'bigint',
        nullable: false,
        defaultExpression: null,
        primaryKey: true,
        primaryKeyOrder: 1,
        autoIncrement: true,
      },
      {
        name: 'name',
        type: 'varchar(255)',
        nullable: true,
        defaultExpression: 'guest',
        primaryKey: false,
        primaryKeyOrder: null,
        autoIncrement: false,
      },
    ]);
    expect(result.indexes).toEqual([
      { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
      { name: 'idx_users_name', columns: ['name'], unique: false, primary: false },
    ]);
    expect(result.createStatement).toBe('CREATE TABLE `users` (...)');
  });

  it('createTable 应执行建表与建索引 SQL', async () => {
    const driver = new TestMySqlCompatibleDriver();

    await driver.createTable({
      tableName: 'users',
      columns: [{ name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true }],
      indexes: [{ name: 'idx_users_id', columns: ['id'], unique: true }],
    });

    expect(driver.executedQueries[0]).toContain('CREATE TABLE `users`');
    expect(driver.executedQueries[1]).toBe('CREATE UNIQUE INDEX `idx_users_id` ON `users` (`id`)');
  });

  it('createColumn 应生成 ADD COLUMN SQL', async () => {
    const driver = new TestMySqlCompatibleDriver();

    await driver.createColumn('users', {
      name: 'email',
      type: 'TEXT',
      nullable: true,
      defaultExpression: null,
      primaryKey: false,
      autoIncrement: false,
    });

    expect(driver.executedQueries[0]).toBe('ALTER TABLE `users` ADD COLUMN `email` TEXT NULL');
  });

  it('updateColumn 应生成 CHANGE COLUMN SQL', async () => {
    const driver = new TestMySqlCompatibleDriver();
    vi.spyOn(driver, 'getTableStructure').mockResolvedValue(createTableStructure());

    await driver.updateColumn('users', 'name', {
      name: 'display_name',
      type: 'VARCHAR(255)',
      nullable: false,
      defaultExpression: "'guest'",
      primaryKey: false,
      autoIncrement: false,
    });

    expect(driver.executedQueries[0]).toBe(
      "ALTER TABLE `users` CHANGE COLUMN `name` `display_name` VARCHAR(255) NOT NULL DEFAULT 'guest'",
    );
  });

  it('updateIndex 应先删除再创建索引', async () => {
    const driver = new TestMySqlCompatibleDriver();
    vi.spyOn(driver, 'getTableStructure').mockResolvedValue(createTableStructure());

    await driver.updateIndex('users', 'idx_users_name', {
      name: 'idx_users_name_unique',
      columns: ['name'],
      unique: true,
    });

    expect(driver.executedQueries).toEqual([
      'ALTER TABLE `users` DROP INDEX `idx_users_name`',
      'CREATE UNIQUE INDEX `idx_users_name_unique` ON `users` (`name`)',
    ]);
  });
});
