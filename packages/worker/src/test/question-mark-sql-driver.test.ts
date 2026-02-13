import { describe, expect, it } from 'vitest';
import type { TableColumn } from '../types';
import { QuestionMarkSqlDriver } from '../services/drivers/question-mark-sql-driver';

type QueryRows = Array<Record<string, unknown>>;

class MockQuestionMarkSqlDriver extends QuestionMarkSqlDriver {
  public connectCount = 0;
  public disconnectCount = 0;
  public queryCalls: Array<{ query: string; params: unknown[] | undefined }> = [];
  private resultQueue: QueryRows[] = [];

  queueResult(rows: QueryRows) {
    this.resultQueue.push(rows);
  }

  async connect() {
    this.connectCount += 1;
  }

  async disconnect() {
    this.disconnectCount += 1;
  }

  protected async executeQuery(query: string, params?: unknown[]) {
    this.queryCalls.push({ query, params });
    return this.resultQueue.shift() ?? [];
  }
}

function createSchema(withPrimaryKey: boolean = true): TableColumn[] {
  return [
    {
      Field: 'id',
      Type: 'int',
      Key: withPrimaryKey ? 'PRI' : '',
    },
    {
      Field: 'name',
      Type: 'varchar(255)',
      Key: '',
    },
  ];
}

function toQueryRows(columns: TableColumn[]): QueryRows {
  return columns.map((column) => ({
    Field: column.Field,
    Type: column.Type,
    Key: column.Key,
  }));
}

describe('question-mark-sql-driver', () => {
  it('getTables 返回表名并触发连接', async () => {
    const driver = new MockQuestionMarkSqlDriver();
    driver.queueResult([{ Tables_in_app: 'users' }, { Tables_in_app: 'orders' }]);

    const tables = await driver.getTables();

    expect(driver.connectCount).toBe(1);
    expect(tables).toEqual(['users', 'orders']);
    expect(driver.queryCalls).toEqual([
      {
        query: 'SHOW TABLES',
        params: undefined,
      },
    ]);
  });

  it('getTableSchema 使用 DESCRIBE 读取结构', async () => {
    const driver = new MockQuestionMarkSqlDriver();
    driver.queueResult(toQueryRows(createSchema()));

    const schema = await driver.getTableSchema('users');

    expect(schema).toEqual(createSchema());
    expect(driver.queryCalls[0]?.query).toBe('DESCRIBE `users`');
  });

  it('getTableData 生成分页查询和总数查询', async () => {
    const driver = new MockQuestionMarkSqlDriver();
    driver.queueResult([{ id: 6, name: 'Alice' }]);
    driver.queueResult([{ total: '12' }]);

    const result = await driver.getTableData('users', {
      page: 2,
      pageSize: 5,
      sortField: 'id',
      sortOrder: 'desc',
      filters: {
        status: 'active',
      },
    });

    expect(result).toEqual({
      data: [{ id: 6, name: 'Alice' }],
      total: 12,
      page: 2,
      pageSize: 5,
      totalPages: 3,
    });

    expect(driver.queryCalls).toEqual([
      {
        query: 'SELECT * FROM `users` WHERE `status` = ? ORDER BY `id` DESC LIMIT ? OFFSET ?',
        params: ['active', 5, 5],
      },
      {
        query: 'SELECT COUNT(*) as total FROM `users` WHERE `status` = ?',
        params: ['active'],
      },
    ]);
  });

  it('deleteRows 按主键批量删除', async () => {
    const driver = new MockQuestionMarkSqlDriver();
    driver.queueResult(toQueryRows(createSchema()));
    driver.queueResult([]);

    const result = await driver.deleteRows('users', [1, 2, 3]);

    expect(result).toEqual({ success: true, count: 3 });
    expect(driver.queryCalls).toEqual([
      {
        query: 'DESCRIBE `users`',
        params: undefined,
      },
      {
        query: 'DELETE FROM `users` WHERE `id` IN (?,?,?)',
        params: [1, 2, 3],
      },
    ]);
  });

  it('deleteRows 无主键时返回错误', async () => {
    const driver = new MockQuestionMarkSqlDriver();
    driver.queueResult(toQueryRows(createSchema(false)));

    await expect(driver.deleteRows('users', [1])).rejects.toThrow('Table users does not have a primary key');
  });

  it('insertRow 生成 INSERT 语句', async () => {
    const driver = new MockQuestionMarkSqlDriver();
    driver.queueResult([]);

    const result = await driver.insertRow('users', {
      name: 'Alice',
      age: 18,
    });

    expect(result).toEqual({ success: true });
    expect(driver.queryCalls).toEqual([
      {
        query: 'INSERT INTO `users` (`name`,`age`) VALUES (?,?)',
        params: ['Alice', 18],
      },
    ]);
  });

  it('updateRows 跳过空 data 并保留返回计数兼容行为', async () => {
    const driver = new MockQuestionMarkSqlDriver();
    driver.queueResult(toQueryRows(createSchema()));
    driver.queueResult([]);

    const result = await driver.updateRows('users', [
      {
        pk: 1,
        data: {
          name: 'Alice',
        },
      },
      {
        pk: 2,
        data: {},
      },
    ]);

    expect(result).toEqual({ success: true, count: 2 });
    expect(driver.queryCalls).toEqual([
      {
        query: 'DESCRIBE `users`',
        params: undefined,
      },
      {
        query: 'UPDATE `users` SET `name` = ? WHERE `id` = ?',
        params: ['Alice', 1],
      },
    ]);
  });
});
