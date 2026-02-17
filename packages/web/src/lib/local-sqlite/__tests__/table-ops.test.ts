import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeLocalSQLiteQuery } from '../sqlite-engine';
import {
  deleteLocalSQLiteRows,
  getLocalSQLiteTableData,
  getLocalSQLiteTables,
  updateLocalSQLiteRows,
} from '../table-ops';

vi.mock('../sqlite-engine', () => ({
  executeLocalSQLiteQuery: vi.fn(),
}));

describe('local-sqlite table-ops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLocalSQLiteTables 应返回 sqlite_schema 查询到的表名', async () => {
    vi.mocked(executeLocalSQLiteQuery).mockResolvedValue({
      rows: [{ name: 'users' }, { name: 'orders' }],
      total: 2,
      columns: [],
    });

    const tables = await getLocalSQLiteTables('local-sqlite:1');

    expect(tables).toEqual(['orders', 'users']);
    expect(executeLocalSQLiteQuery).toHaveBeenCalledWith(
      'local-sqlite:1',
      "SELECT name AS table_name FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;",
    );
  });

  it('getLocalSQLiteTables 在主查询为空时应回退到 sqlite_master 和 PRAGMA table_list', async () => {
    vi.mocked(executeLocalSQLiteQuery)
      .mockResolvedValueOnce({
        rows: [],
        total: 0,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [],
        total: 0,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [
          { schema: 'main', name: 'users', type: 'table' },
          { schema: 'main', name: 'sqlite_sequence', type: 'table' },
          { schema: 'temp', name: 'tmp_data', type: 'table' },
          { schema: 'main', name: 'v_users', type: 'view' },
          { schema: 'main', name: 'orders', type: 'table' },
        ],
        total: 5,
        columns: [],
      });

    const tables = await getLocalSQLiteTables('local-sqlite:1');

    expect(tables).toEqual(['orders', 'users', 'v_users']);
    expect(executeLocalSQLiteQuery).toHaveBeenNthCalledWith(
      2,
      'local-sqlite:1',
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;",
    );
    expect(executeLocalSQLiteQuery).toHaveBeenNthCalledWith(3, 'local-sqlite:1', 'PRAGMA table_list;');
  });

  it('getLocalSQLiteTableData 应按分页/排序/过滤生成查询', async () => {
    vi.mocked(executeLocalSQLiteQuery)
      .mockResolvedValueOnce({
        rows: [
          { name: 'id', type: 'INTEGER', notnull: 1, pk: 1, dflt_value: null },
          { name: 'name', type: 'TEXT', notnull: 0, pk: 0, dflt_value: null },
        ],
        total: 2,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [{ total: 3 }],
        total: 1,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Alice' }],
        total: 1,
        columns: [],
      });

    const result = await getLocalSQLiteTableData('local-sqlite:1', 'users', {
      page: 2,
      pageSize: 10,
      sortField: 'id',
      sortOrder: 'desc',
      filters: { _search: 'Ali' },
    });

    expect(result.total).toBe(3);
    expect(result.rows).toEqual([{ id: 2, name: 'Alice' }]);
    expect(result.columns).toEqual([
      {
        Field: 'id',
        Type: 'INTEGER',
        Null: 'NO',
        Key: 'PRI',
        Default: null,
        Extra: '',
      },
      {
        Field: 'name',
        Type: 'TEXT',
        Null: 'YES',
        Key: '',
        Default: null,
        Extra: '',
      },
    ]);

    expect(executeLocalSQLiteQuery).toHaveBeenNthCalledWith(
      2,
      'local-sqlite:1',
      expect.stringContaining('SELECT COUNT(*) AS total FROM "users"'),
    );
    expect(executeLocalSQLiteQuery).toHaveBeenNthCalledWith(
      3,
      'local-sqlite:1',
      expect.stringContaining('ORDER BY "id" DESC LIMIT 10 OFFSET 10'),
    );
  });

  it('deleteLocalSQLiteRows 无主键时应报错', async () => {
    vi.mocked(executeLocalSQLiteQuery).mockResolvedValue({
      rows: [{ name: 'name', type: 'TEXT', notnull: 0, pk: 0, dflt_value: null }],
      total: 1,
      columns: [],
    });

    await expect(deleteLocalSQLiteRows('local-sqlite:1', 'users', [1])).rejects.toThrow(
      '表 users 不存在主键，暂不支持更新/删除',
    );
  });

  it('updateLocalSQLiteRows 应转义值并返回变更数', async () => {
    vi.mocked(executeLocalSQLiteQuery)
      .mockResolvedValueOnce({
        rows: [
          { name: 'id', type: 'INTEGER', notnull: 1, pk: 1, dflt_value: null },
          { name: 'name', type: 'TEXT', notnull: 0, pk: 0, dflt_value: null },
        ],
        total: 2,
        columns: [],
      })
      .mockResolvedValueOnce({
        rows: [{ affected: 2 }],
        total: 1,
        columns: [],
      });

    const result = await updateLocalSQLiteRows('local-sqlite:1', 'users', [
      { pk: 1, data: { name: "O'Hara" } },
      { pk: 2, data: { name: 'Bob' } },
    ]);

    expect(result).toEqual({ success: true, count: 2 });
    expect(executeLocalSQLiteQuery).toHaveBeenNthCalledWith(
      2,
      'local-sqlite:1',
      expect.stringContaining(`UPDATE "users" SET "name" = 'O''Hara' WHERE "id" = 1;`),
    );
    expect(executeLocalSQLiteQuery).toHaveBeenNthCalledWith(
      2,
      'local-sqlite:1',
      expect.stringContaining('SELECT total_changes() AS affected;'),
    );
  });
});
